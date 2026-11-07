export const LANES = ['cold-open', 'shared-tree', 'end-to-end-adapter'] as const;
export type Lane = typeof LANES[number];
export interface Request {
  readonly lane: Lane;
  readonly language: string;
  readonly source: string;
  readonly repetitions: number;
  readonly warmups: number;
}
export const unsupported = (reason: string) => ({ kind: 'unsupported', reason } as const);
export const observed = <T>(value: T) => ({ kind: 'observed', value } as const);

export function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected measurement object');
  return value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function integer(value: unknown, maximum = 100): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > maximum) throw new Error('Invalid bounded measurement count');
  return value;
}

export function parseRequest(value: unknown): Request {
  const input = record(value);
  const lane = LANES.find(lane => lane === input.lane);
  if (!lane || typeof input.language !== 'string' || typeof input.source !== 'string') throw new Error('Invalid measurement request');
  const repetitions = integer(input.repetitions);
  if (!repetitions) throw new Error('Repetitions must be positive');
  return { lane, language: input.language, source: input.source, repetitions, warmups: integer(input.warmups) };
}

export function distribution(values: readonly number[]) {
  if (!values.length || values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid duration samples');
  const sorted = values.toSorted((a, b) => a - b);
  return { count: sorted.length, min: sorted[0], p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted[sorted.length - 1], unit: 'ms', method: 'nearest-rank' };
}

export const LIMITS = {
  incrementalEdits: unsupported('PilotDocument is immutable; no native incremental implementation or edit replay is measured.'),
  nativeThemeResolution: unsupported('The adapter uses the pinned development reference matcher.'),
  bytesScanned: unsupported('Source coverage is known, but native scanning bytes are not instrumented.'),
  invalidationExtent: unsupported('Full-pass prototype has no invalidation API.'),
  sourceSuffixMovement: unsupported('No source edit is performed.'),
  ownedCacheBytes: unsupported('Source/tree/scope/style cache ownership sizes are not exposed.'),
  downstreamDelivery: unsupported('JSON encoding is measured; worker transport, rendering, overlays and LSP are absent.'),
  currentIncrementalShiki: unsupported('Current same-host consumer controls are an external release-evaluation prerequisite.'),
  nativePeakBytes: unsupported('Allocator observation covers routed requests, not all runtime internals or allocator overhead.'),
  themeSwitch: unsupported('No native theme cache or theme-switch lifecycle exists in this command.'),
  multipleDocuments: unsupported('One document at a time; no simultaneous-document scenario.'),
  viewport: unsupported('All lanes request full-document output; first-viewport latency is not measured.'),
  maximumUiStall: unsupported('No event-loop delay or UI sampling; maximum reported latency is an operation duration.'),
  runtimeBuildFlags: unsupported('Only the component has a checked compiler/flags manifest; the runtime is identified by its loaded artifact hash.'),
};
