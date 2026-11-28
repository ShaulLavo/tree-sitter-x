import { ScopeCompatError } from './types.ts';
import type { ScopeWindow } from './types.ts';

export const NONE = 0xffffffff;
export const DEFAULT_THEME_PACKET_BYTES = 16 * 1024 * 1024;
export const DEFAULT_THEME_COMPILE_STEPS = 4_000_000;
export const DEFAULT_THEME_TRIE_NODES = 131_072;
export const DEFAULT_THEME_CONTEXT_RULES = 262_144;
export const DEFAULT_THEME_OWNED_BYTES = 32 * 1024 * 1024;
export const DEFAULT_THEME_RESOLVE_STEPS = 4_000_000;
export const DEFAULT_THEME_OUTPUT_BYTES = 8 * 1024 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const diagnosticDecoder = new TextDecoder('utf-8', { fatal: false });

const SCOPE_LAYOUT: readonly number[] = [
  26, 60, 4,
  0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56,
  24, 4,
  0, 4, 8, 12, 16, 20,
];

const THEME_LAYOUT: readonly number[] = [
  30, 24, 4, 0, 4, 8, 12, 16, 20,
  12, 4, 0, 4, 8,
  24, 4, 0, 4, 8, 12, 16, 20,
  24, 4, 0, 4, 8, 12, 16, 20,
];

export interface NativeThemeRule {
  readonly tail: number;
  readonly contexts: readonly { readonly atom: number; readonly immediate: boolean }[];
  readonly rule: number;
  readonly alternative: number;
  readonly present: number;
  readonly foreground: number;
  readonly background: number;
  readonly fontMask: number;
}

export interface EncodedPathPacket {
  readonly bytes: Uint8Array;
  readonly pathIds: Uint32Array;
  readonly count: number;
}

export interface DecodedScopePass {
  readonly segments: Uint32Array;
  readonly paths: readonly (readonly number[])[];
}

export interface DecodedThemeStyles {
  readonly foregrounds: Uint32Array;
  readonly backgrounds: Uint32Array;
  readonly fontMasks: Uint8Array;
}

export function u32(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > NONE) {
    throw new RangeError(`Invalid wasm32 integer ${value}`);
  }
  return value;
}

export function address(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -0x80000000 || value > NONE) {
    throw new RangeError('Invalid returned wasm32 address');
  }
  return value >>> 0;
}

export function checkSpan(heap: Uint8Array, pointer: number, count: number, width: number, alignment = 4): number {
  u32(pointer);
  u32(count);
  if (pointer % alignment !== 0 || count > Math.floor(NONE / width)) {
    throw new RangeError('Unaligned or overflowing wasm32 span');
  }
  const bytes = count * width;
  if (pointer > heap.length || bytes > heap.length - pointer || (count > 0 && pointer === 0)) {
    throw new RangeError('Unreadable wasm32 span');
  }
  return bytes;
}

export function checkSourceSpan(heap: Uint8Array, pointer: number, length: number): void {
  checkSpan(heap, pointer, length, 2, 2);
  if (!pointer || length > Math.floor(NONE / 2)) {
    throw new RangeError('Invalid UTF-16 source span');
  }
}

export function readU32Words(heap: Uint8Array, pointer: number, count: number): Uint32Array {
  checkSpan(heap, pointer, count, 4, 4);
  return new Uint32Array(heap.buffer, heap.byteOffset + pointer, count);
}

export function readCString(heap: Uint8Array, pointer: number, maximum = 256, diagnostic = false): string {
  checkSpan(heap, pointer, 1, 1, 1);
  const available = Math.min(maximum + 1, heap.length - pointer);
  const bytes = heap.subarray(pointer, pointer + available);
  const end = bytes.indexOf(0);
  if (end < 0) throw new RangeError('Unterminated native string');
  // Copy out of Wasm memory because WebAssembly.Memory.toResizableBuffer() returns a resizable
  // ArrayBuffer, which TextDecoder.decode() rejects in browsers.
  return (diagnostic ? diagnosticDecoder : decoder).decode(bytes.slice(0, end));
}

export function validateScopeLayout(heap: Uint8Array, pointer: number): void {
  const layout = readU32Words(heap, pointer, SCOPE_LAYOUT.length);
  for (let i = 0; i < SCOPE_LAYOUT.length; i++) {
    if (layout[i] !== SCOPE_LAYOUT[i]) throw new Error('scope-compat ABI layout mismatch');
  }
}

export function validateThemeLayout(heap: Uint8Array, pointer: number): void {
  const layout = readU32Words(heap, pointer, THEME_LAYOUT.length);
  for (let i = 0; i < THEME_LAYOUT.length; i++) {
    if (layout[i] !== THEME_LAYOUT[i]) throw new Error('scope-compat theme ABI layout mismatch');
  }
}

function decodePaths(data: Uint32Array, count: number, scopeCount: number): readonly (readonly number[])[] {
  if (count === 0 || data[0] !== NONE || data[1] !== NONE) {
    throw new Error('Invalid empty scope path sentinel');
  }
  const paths: (readonly number[])[] = [Object.freeze([])];
  for (let i = 1; i < count; i++) {
    const parent = data[i * 2];
    const scope = data[i * 2 + 1];
    if (parent >= i || scope >= scopeCount || (parent === 0 && scope !== 0)) {
      throw new Error('Invalid scope path parent or scope ID');
    }
    paths.push(Object.freeze(paths[parent].concat([scope])));
  }
  return Object.freeze(paths);
}

function assertValidSegments(segments: Uint32Array, pathCount: number, window: ScopeWindow): void {
  let cursor = window.start;
  let previous = NONE;
  for (let i = 0; i < segments.length; i += 3) {
    const from = segments[i];
    const to = segments[i + 1];
    const path = segments[i + 2];
    if (from !== cursor || to <= from || to > window.end || path >= pathCount || path === previous) {
      throw new Error('Invalid native scope segment tiling');
    }
    cursor = to;
    previous = path;
  }
  if (cursor !== window.end) throw new Error('Truncated native scope segment tiling');
}

export function decodeScopeResult(heap: Uint8Array, pointer: number, window: ScopeWindow, scopeCount: number): DecodedScopePass {
  if (!pointer) throw new ScopeCompatError('Native scope result allocation failed', 4, 0);
  const header = readU32Words(heap, pointer, 15);
  if (header[0] !== 1) throw new Error('Invalid scope-compat result ABI version');
  if (header[1] !== 0) {
    throw new ScopeCompatError(
      `Native scope pass failed (status ${header[1]}, detail ${header[2]}, value ${header[3]})`,
      header[1],
      header[2],
      header[3],
    );
  }
  if (header[4] !== window.start || header[5] !== window.end) {
    throw new Error('Returned scope window differs from request');
  }
  const segCount = header[6];
  const segPtr = header[7];
  const pathCount = header[8];
  const pathPtr = header[9];
  const segments = segCount ? readU32Words(heap, segPtr, segCount * 3).slice() : new Uint32Array(0);
  const paths = decodePaths(readU32Words(heap, pathPtr, pathCount * 2), pathCount, scopeCount);
  assertValidSegments(segments, paths.length, window);
  return { segments, paths };
}

function writeWords(view: DataView, offset: number, values: readonly number[]): void {
  for (let i = 0; i < values.length; i++) {
    view.setUint32(offset + i * 4, values[i], true);
  }
}

function writeStringTable(view: DataView, bytes: Uint8Array, offset: number, strings: readonly Uint8Array[]): void {
  let cursor = offset + strings.length * 8;
  for (let i = 0; i < strings.length; i++) {
    const item = strings[i];
    writeWords(view, offset + i * 8, [cursor, item.length]);
    bytes.set(item, cursor);
    cursor += item.length;
  }
}

export function encodeThemePacket(atoms: readonly string[], rules: readonly NativeThemeRule[], maxBytes: number): Uint8Array {
  const strings = atoms.map(atom => encoder.encode(atom));
  let contextCount = 0;
  for (const rule of rules) contextCount += rule.contexts.length;
  const rulesAt = rules.length ? 48 : 0;
  const contextsAt = contextCount ? 48 + rules.length * 36 : 0;
  const namesAt = 48 + rules.length * 36 + contextCount * 8;
  const stringsAt = namesAt + atoms.length * 8;
  let stringBytes = 0;
  for (const item of strings) stringBytes += item.length;
  const total = stringsAt + stringBytes;
  if (total > maxBytes) {
    throw new ScopeCompatError(`Theme packet exceeds limit (${total} > ${maxBytes})`, 2, 119, maxBytes);
  }
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  writeWords(view, 0, [
    0x31544853, 1, total,
    rules.length, rulesAt,
    atoms.length, atoms.length ? namesAt : 0,
    contextCount, contextsAt,
    stringBytes, stringBytes ? stringsAt : 0,
    0,
  ]);
  let contextIndex = 0;
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    writeWords(view, 48 + i * 36, [
      rule.tail,
      rule.contexts.length ? contextIndex : 0,
      rule.contexts.length,
      rule.rule,
      rule.alternative,
      rule.present,
      rule.foreground,
      rule.background,
      rule.fontMask,
    ]);
    for (const edge of rule.contexts) {
      writeWords(view, contextsAt + contextIndex * 8, [edge.atom, edge.immediate ? 1 : 0]);
      contextIndex++;
    }
  }
  writeStringTable(view, bytes, namesAt, strings);
  return bytes;
}

function internPath(
  path: readonly number[],
  scopes: readonly string[],
  names: Map<string, number>,
  pairs: number[],
  prefixes: Map<string, number>,
): number {
  let parent = 0;
  for (const scopeId of path) {
    const name = scopes[scopeId];
    if (!name || /[\x00-\x20\x7f]/.test(name)) {
      throw new ScopeCompatError(`Invalid scope name at index ${scopeId}`, 3, 105, scopeId);
    }
    let nameId = names.get(name);
    if (nameId === undefined) {
      nameId = names.size;
      names.set(name, nameId);
    }
    const key = `${parent}:${nameId}`;
    const known = prefixes.get(key);
    if (known !== undefined) {
      parent = known;
      continue;
    }
    const id = pairs.length / 2;
    pairs.push(parent, nameId);
    prefixes.set(key, id);
    parent = id;
  }
  return parent;
}

export function encodePathPacket(
  paths: readonly (readonly number[])[],
  scopes: readonly string[],
  maxBytes: number,
): EncodedPathPacket {
  if (paths.length === 0) {
    if (36 > maxBytes) {
      throw new ScopeCompatError(`Path packet exceeds limit (36 > ${maxBytes})`, 2, 119, maxBytes);
    }
    const empty = new Uint8Array(36);
    writeWords(new DataView(empty.buffer), 0, [0x31504853, 1, 36, 0, 0, 0, 0, 0, 0]);
    return { bytes: empty, pathIds: new Uint32Array(0), count: 0 };
  }
  const names = new Map<string, number>();
  const pairs: number[] = [NONE, NONE];
  const prefixes = new Map<string, number>();
  const pathIds = new Uint32Array(paths.length);
  for (let i = 0; i < paths.length; i++) {
    pathIds[i] = internPath(paths[i], scopes, names, pairs, prefixes);
  }
  const strings = Array.from(names.keys(), name => encoder.encode(name));
  const namesAt = 36 + pairs.length * 4;
  const stringsAt = namesAt + strings.length * 8;
  let stringBytes = 0;
  for (const item of strings) stringBytes += item.length;
  const total = stringsAt + stringBytes;
  if (total > maxBytes) {
    throw new ScopeCompatError(`Path packet exceeds limit (${total} > ${maxBytes})`, 2, 119, maxBytes);
  }
  const bytes = new Uint8Array(total);
  const view = new DataView(bytes.buffer);
  const count = pairs.length / 2;
  writeWords(view, 0, [
    0x31504853, 1, total,
    names.size, names.size ? namesAt : 0,
    count, 36,
    stringBytes, stringBytes ? stringsAt : 0,
  ]);
  writeWords(view, 36, pairs);
  writeStringTable(view, bytes, namesAt, strings);
  return { bytes, pathIds, count };
}

export function decodeThemeResult(heap: Uint8Array, pointer: number, expectedCount: number): DecodedThemeStyles {
  if (!pointer) throw new ScopeCompatError('Native theme resolve allocation failed', 4, 120);
  const header = readU32Words(heap, pointer, 6);
  if (header[0] !== 1) throw new Error('Invalid theme result ABI version');
  if (header[1] !== 0) {
    throw new ScopeCompatError(
      `Native theme resolve failed (status ${header[1]}, detail ${header[2]}, value ${header[3]})`,
      header[1],
      header[2],
      header[3],
    );
  }
  const count = header[4];
  const records = header[5];
  if (count !== expectedCount || (count === 0 && records !== 0)) {
    throw new Error('Invalid native theme result header');
  }
  const foregrounds = new Uint32Array(count);
  const backgrounds = new Uint32Array(count);
  const fontMasks = new Uint8Array(count);
  if (count === 0) return { foregrounds, backgrounds, fontMasks };
  const raw = readU32Words(heap, records, count * 3);
  for (let i = 0; i < count; i++) {
    const base = i * 3;
    const fontMask = raw[base + 2];
    if (fontMask > 15) throw new Error('Invalid native theme font mask');
    foregrounds[i] = raw[base];
    backgrounds[i] = raw[base + 1];
    fontMasks[i] = fontMask;
  }
  return { foregrounds, backgrounds, fontMasks };
}
