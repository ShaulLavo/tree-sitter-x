/// <reference lib="dom" />
export const NONE = 0xffffffff;
export interface Window { readonly start: number; readonly end: number }
export interface Failure { readonly status: 1 | 2 | 3 | 4; readonly detail: number; readonly value: number }
export interface DecodedResult {
  readonly status: 0;
  readonly segments: Uint32Array;
  readonly paths: readonly (readonly number[])[];
  readonly statistics: readonly number[];
}
export type PassResult = Failure | DecodedResult;
export type ExplainResult = Failure | { readonly status: 0; readonly intervals: Uint32Array };

export function u32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > NONE) throw new RangeError(`Invalid wasm32 integer ${value}`);
  return value;
}

export function address(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -0x80000000 || value > NONE) throw new RangeError('Invalid returned address');
  return value >>> 0;
}

export function span(heap: Uint8Array, pointer: number, count: number, width: number, alignment = 4): number {
  u32(pointer); u32(count);
  if (pointer % alignment || count > Math.floor(NONE / width)) throw new RangeError('Unaligned or overflowing span');
  const bytes = count * width;
  if (pointer > heap.length || bytes > heap.length - pointer || (count > 0 && !pointer)) throw new RangeError('Unreadable native span');
  return bytes;
}

export function sourceSpan(heap: Uint8Array, pointer: number, length: number): void {
  span(heap, pointer, length, 2, 2);
  if (!pointer || length > Math.floor(NONE / 2)) throw new RangeError('Invalid source span');
}

function words(heap: Uint8Array, pointer: number, count: number): Uint32Array {
  span(heap, pointer, count, 4);
  return new Uint32Array(heap.buffer, heap.byteOffset + pointer, count);
}

export function validateLayout(heap: Uint8Array, pointer: number): void {
  const layout = words(heap, pointer, 26);
  const expected = [26, 60, 4].concat(Array.from({ length: 15 }, (_, i) => i * 4), [24, 4], Array.from({ length: 6 }, (_, i) => i * 4));
  if (expected.some((value, i) => value !== layout[i])) throw new Error('Native ABI layout mismatch');
}

export function nativeString(heap: Uint8Array, pointer: number, maximum = 256, diagnostic = false): string {
  span(heap, pointer, 1, 1, 1);
  const available = Math.min(maximum + 1, heap.length - pointer);
  const bytes = heap.subarray(pointer, pointer + available);
  const end = bytes.indexOf(0);
  if (end < 0) throw new RangeError('Unterminated native string');
  return new TextDecoder('utf-8', { fatal: !diagnostic }).decode(bytes.subarray(0, end));
}

function failure(header: Uint32Array): Failure | undefined {
  if (header[0] !== 1) throw new Error('Invalid result ABI');
  const status = header[1];
  if (status === 0) {
    if (header[2] || header[3]) throw new Error('Error detail on successful result');
    return undefined;
  }
  if (status !== 1 && status !== 2 && status !== 3 && status !== 4) throw new Error('Unknown native status');
  const details = status === 1 ? [16] : status === 2 ? [22,23,24] : status === 3 ? [0,3,7,17,18,19,20,21] : [0];
  if (!details.includes(header[2]) || (status === 4 && header[3])) throw new Error('Invalid native failure detail');
  return { status, detail: header[2], value: header[3] };
}

function decodePaths(data: Uint32Array, count: number, scopes: number): readonly (readonly number[])[] {
  if (!count || data[0] !== NONE || data[1] !== NONE) throw new Error('Invalid empty path sentinel');
  const paths: number[][] = [[]];
  const pairs = new Set<string>();
  for (let i = 1; i < count; ++i) {
    const parent = data[i * 2], scope = data[i * 2 + 1];
    if (parent >= i || scope >= scopes || (!parent && scope !== 0) || pairs.has(`${parent}:${scope}`)) throw new Error('Invalid path parent, scope or duplicate');
    paths.push(paths[parent].concat([scope]));
    pairs.add(`${parent}:${scope}`);
  }
  return paths;
}

function segmentsValid(segments: Uint32Array, paths: number, window: Window): void {
  let position = window.start, previous = NONE;
  for (let i = 0; i < segments.length; i += 3) {
    const from = segments[i], to = segments[i + 1], path = segments[i + 2];
    if (from !== position || to <= from || to > window.end || path >= paths || path === previous) throw new Error('Invalid segment tiling or coalescing');
    position = to; previous = path;
  }
  if (position !== window.end) throw new Error('Truncated segment tiling');
}

export function decodeResult(heap: Uint8Array, pointer: number, window: Window, scopes: number): PassResult {
  if (!pointer) throw new Error('Native result header allocation failed');
  u32(window.start); u32(window.end); u32(scopes);
  if (window.start > window.end || !scopes) throw new Error('Invalid requested window or scope table');
  const h = words(heap, pointer, 15);
  if (h[4] !== window.start || h[5] !== window.end) throw new Error('Returned window differs');
  const failed = failure(h);
  if (failed) {
    if (h.subarray(6).some(value => value !== 0)) throw new Error('Partial failure result');
    return failed;
  }
  if ((!h[6] && h[7]) || (h[6] && !h[7])) throw new Error('Invalid segment pointer');
  span(heap, h[7], h[6], 12);
  span(heap, h[9], h[8], 8);
  const segments = words(heap, h[7], h[6] * 3).slice();
  const paths = decodePaths(words(heap, h[9], h[8] * 2), h[8], scopes);
  segmentsValid(segments, paths.length, window);
  return { status: 0, segments, paths, statistics: Array.from(h.subarray(10)) };
}

export function decodeExplain(heap: Uint8Array, pointer: number, window: Window, scopes: number, patterns: number): ExplainResult {
  if (!pointer) throw new Error('Native explain header allocation failed');
  u32(window.start); u32(window.end); u32(scopes); u32(patterns);
  if (window.start > window.end || !scopes) throw new Error('Invalid explain window or scope table');
  const h = words(heap, pointer, 6);
  const failed = failure(h);
  if (failed) {
    if (h[4] || h[5]) throw new Error('Partial failure explain');
    return failed;
  }
  if ((!h[4] && h[5]) || (h[4] && !h[5])) throw new Error('Invalid explain pointer');
  span(heap, h[5], h[4], 32);
  const intervals = words(heap, h[5], h[4] * 8).slice();
  for (let i = 0; i < intervals.length; i += 8) {
    if (intervals[i] < window.start || intervals[i + 1] > window.end || intervals[i] > intervals[i + 1] ||
        intervals[i + 2] >= scopes || intervals[i + 3] >= patterns || intervals[i + 4] > 1000 || intervals[i + 7] > 3) throw new Error('Malformed explain interval');
  }
  return { status: 0, intervals };
}
