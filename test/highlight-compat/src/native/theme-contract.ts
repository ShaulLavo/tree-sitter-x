export type Profile = 'raw' | 'product';
export interface AcquiredResource { readonly id: string; readonly format: 'json' | 'jsonc' | 'plist'; readonly bytes: Uint8Array }
export interface IncludeEdge { readonly from: string; readonly to: string; readonly ordinal: number }
export interface AcquiredInput { readonly root: string; readonly resources: readonly AcquiredResource[]; readonly edges: readonly IncludeEdge[] }
export type Location = { readonly kind: 'resource'; readonly resource: string; readonly jsonPointer: string; readonly byteOffset: number | null }
  | { readonly kind: 'setting'; readonly resource: string; readonly rule: number; readonly alternative: number | null; readonly property: string }
  | { readonly kind: 'packet'; readonly byteOffset: number }
  | { readonly kind: 'request' };
export type InvalidCode = 'json' | 'schema' | 'include-graph' | 'include-authority' | 'selector' | 'color' | 'font-style' | 'packet';
export type UnsupportedCode = 'input-format' | 'profile' | 'selector' | 'trie-tail-atom' | 'color-format' | 'syntax-property' | 'font-style' | 'raw-palette';
export type BudgetCode = 'input-bytes' | 'resources' | 'include-depth' | 'rules' | 'atoms' | 'context-edges' | 'packet-bytes'
  | 'resource-id-bytes' | 'atom-bytes' | 'context-atoms' | 'paths' | 'compile-steps' | 'trie-nodes' | 'context-rules' | 'owned-bytes' | 'resolve-steps' | 'output-bytes';
export type Failure = { readonly kind: 'invalid'; readonly code: InvalidCode; readonly location: Location }
  | { readonly kind: 'unsupported'; readonly code: UnsupportedCode; readonly location: Location }
  | { readonly kind: 'budget'; readonly code: BudgetCode; readonly limit: number; readonly location: Location }
  | { readonly kind: 'no-memory'; readonly code: 'allocation'; readonly location: Location };
export interface OutsideScore { readonly kind: 'outside-score'; readonly resource: string; readonly property: string }
export type Outcome<T> = { readonly kind: 'ok'; readonly value: T; readonly warnings: readonly OutsideScore[] } | Failure;
export interface OperationalFailure { readonly kind: 'error'; readonly code: 'acquisition-failed' | 'runtime-failed'; readonly location: { readonly kind: 'request' } }
export interface InputLimits {
  readonly resources: number; readonly includeDepth: number; readonly inputBytes: number; readonly rules: number;
  readonly atoms: number; readonly contextEdges: number; readonly atomBytes: number; readonly packetBytes: number;
  readonly contextAtomsPerSelector: number; readonly paths: number; readonly resourceIdBytes: number;
}
export interface CompileLimits { readonly steps: number; readonly trieNodes: number; readonly contextRules: number; readonly ownedBytes: number }
export interface ResolveLimits { readonly steps: number; readonly outputBytes: number }
export const INPUT_DEFAULTS: InputLimits = Object.freeze({ resources:64, includeDepth:16, inputBytes:4*1024*1024,
  rules:65536, atoms:65536, contextEdges:262144, atomBytes:256, packetBytes:16*1024*1024,
  contextAtomsPerSelector:64, paths:262144, resourceIdBytes:4096 });
export const COMPILE_DEFAULTS: CompileLimits = Object.freeze({ steps:8388608, trieNodes:65536, contextRules:262144, ownedBytes:32*1024*1024 });
export const RESOLVE_DEFAULTS: ResolveLimits = Object.freeze({ steps:1048576, outputBytes:16*1024*1024 });
export const NATIVE_DETAIL = Object.freeze({ none:0, packet:100, utf8:101, selectorAtom:102, context:103, property:104, path:105,
  inputBytes:106, rules:107, atoms:108, contextEdges:109, atomBytes:110, contextAtoms:111, compileSteps:112,
  trieNodes:113, contextRules:114, ownedBytes:115, resolveSteps:116, outputBytes:117, paths:118, packetBytes:119, allocation:120, notCompiled:121 });
export interface EffectiveStyle { readonly foreground: number; readonly background: number; readonly fontMask: number }
export type Field<T> = { readonly kind: 'inherit' } | { readonly kind: 'set'; readonly value: T };
export interface PartialStyle { readonly foreground: Field<number>; readonly background: Field<number>; readonly fontMask: Field<number> }
export interface PartialMatch { readonly style: PartialStyle; readonly rule: number; readonly alternative: number }
export interface NativeRule {
  readonly tail: number; readonly contexts: readonly { readonly atom: number; readonly immediate: boolean }[];
  readonly rule: number; readonly alternative: number; readonly present: number;
  readonly foreground: number; readonly background: number; readonly fontMask: number;
}
export const NONE = 0xffff_ffff;

export class InputFailure extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) { super(`${failure.kind}/${failure.code}`); this.failure = failure; }
}
export function reject(failure: Failure): never { throw new InputFailure(failure); }
export function attempt<T>(action: () => T, warnings: readonly OutsideScore[] = []): Outcome<T> {
  try { return { kind:'ok', value:action(), warnings }; }
  catch (error) { return inputFailure(error); }
}
function inputFailure(error: unknown): Failure {
  if (error instanceof InputFailure) return error.failure;
  throw error;
}
export function limits<T extends object>(defaults: T, options: Partial<T>, ceiling = false): T {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) reject({kind:'invalid',code:'schema',location:{kind:'request'}});
  const result = { ...defaults };
  for (const [key, value] of Object.entries(options)) {
    if (!Object.hasOwn(defaults,key) || typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > NONE)
      reject({kind:'invalid', code:'schema', location:{kind:'request'}});
    Object.assign(result, { [key]:value });
  }
  if (!ceiling) return result;
  for (const key in result) {
    if (result[key] > defaults[key]) reject({kind:'invalid', code:'schema', location:{kind:'request'}});
  }
  return result;
}
export function cap(value: number, limit: number, code: BudgetCode, location: Location = {kind:'request'}): void {
  if (value > limit) reject({kind:'budget', code, limit, location});
}
