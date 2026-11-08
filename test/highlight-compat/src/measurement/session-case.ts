import { prepareEdits } from '../native/edit-batch.ts';
import type { Edit, NumericLimits } from '../native/edit-batch.ts';
import { record, integer, LANES } from './model.ts';
import type { Lane } from './model.ts';
import { addBytes, boundedJson } from './bounds.ts';

export const SESSION_LIMITS = Object.freeze({ caseFileBytes: 8 * 1048576, workerInputBytes: 16 * 1048576,
  sourceUnits: 1048576, insertionUnits: 1048576, edits: 16, themeBytes: 65536,
  checkpointBytes: 4 * 1048576, reportBytes: 16 * 1048576 });
export type SessionLimits = typeof SESSION_LIMITS;
export type Bounds = { readonly [K in keyof SessionLimits]: number };
const numeric = new WeakMap<Bounds, NumericLimits>();
export function numericLimits(bounds: Bounds = SESSION_LIMITS): NumericLimits {
  let found = numeric.get(bounds);
  if (!found) { found = Object.freeze({ index: bounds.sourceUnits, column: bounds.sourceUnits, row: bounds.sourceUnits }); numeric.set(bounds, found); }
  return found;
}
export interface SessionCase {
  readonly language: 'json'; readonly source: string; readonly edits: readonly Edit[];
  readonly themeJson: readonly [string, string]; readonly profile: 'product'; readonly framing: 'identity-v1';
}
export const CHECKPOINT_RETENTION = 'release-initial-hold-edited-a-through-b-1';
export const BUILTIN_CASE: SessionCase = Object.freeze({ language: 'json', source: '[1,2]\n',
  edits: Object.freeze([Object.freeze({ from: 1, to: 2, insert: '3' })]),
  themeJson: Object.freeze([themeJson('#123456'), themeJson('#abcdef')] satisfies [string, string]), profile: 'product', framing: 'identity-v1' });
function themeJson(foreground: string): string { return JSON.stringify({ name: 'measurement', tokenColors: [{ settings: { foreground, fontStyle: '' } }] }); }
export function exactKeys(input: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(input).some(key => !keys.includes(key)) || keys.some(key => !(key in input))) throw new Error('Invalid session measurement fields');
}
function edit(value: unknown): Edit {
  const item = record(value); exactKeys(item, ['from', 'to', 'insert']);
  if (typeof item.insert !== 'string') throw new Error('Invalid session edit');
  return Object.freeze({ from: integer(item.from, SESSION_LIMITS.sourceUnits), to: integer(item.to, SESSION_LIMITS.sourceUnits), insert: item.insert });
}
function theme(value: unknown, bounds: Bounds): string {
  if (typeof value !== 'string') throw new Error('Invalid session theme');
  addBytes(0, Buffer.byteLength(value), bounds.themeBytes);
  if ('include' in record(JSON.parse(value))) throw new Error('Session themes cannot include resources');
  return value;
}
export function parseSessionCase(value: unknown, bounds: Bounds = SESSION_LIMITS): SessionCase {
  const input = record(value); exactKeys(input, ['language', 'source', 'edits', 'themeJson', 'profile', 'framing']);
  if (input.language !== 'json' || input.profile !== 'product' || input.framing !== 'identity-v1' || typeof input.source !== 'string') throw new Error('Unsupported session case policy');
  addBytes(0, input.source.length, bounds.sourceUnits);
  if (!Array.isArray(input.edits) || !input.edits.length || input.edits.length > bounds.edits) throw new Error('Invalid session edit count');
  const edits = input.edits.map(edit); let inserted = 0;
  for (const item of edits) inserted = addBytes(inserted, item.insert.length, bounds.insertionUnits);
  if (!Array.isArray(input.themeJson) || input.themeJson.length !== 2) throw new Error('Exactly two session themes required');
  const themeJson: readonly [string, string] = Object.freeze([theme(input.themeJson[0], bounds), theme(input.themeJson[1], bounds)]);
  prepareEdits(input.source, edits, numericLimits(bounds));
  return Object.freeze({ language: 'json', source: input.source, edits: Object.freeze(edits), themeJson, profile: 'product', framing: 'identity-v1' });
}
export interface SessionRequest {
  readonly adapter: 'session-native'; readonly lane: Lane; readonly case: SessionCase;
  readonly repetitions: number; readonly warmups: number; readonly reportBudget: number;
}
export function parseSessionRequest(value: unknown, bounds: Bounds = SESSION_LIMITS): SessionRequest {
  const input = record(value); exactKeys(input, ['adapter', 'lane', 'case', 'repetitions', 'warmups', 'reportBudget']);
  const lane = LANES.find(lane => lane === input.lane);
  if (input.adapter !== 'session-native' || !lane) throw new Error('Invalid session worker adapter/lane');
  const repetitions = integer(input.repetitions), warmups = integer(input.warmups), reportBudget = integer(input.reportBudget, bounds.reportBytes);
  if (!repetitions || !reportBudget || lane === 'cold-open' && (repetitions !== 1 || warmups !== 0)) throw new Error('Invalid session worker counts/budget');
  return { adapter: 'session-native', lane, case: parseSessionCase(input.case, bounds), repetitions, warmups, reportBudget };
}
export function serializeSessionRequest(request: SessionRequest, bounds: Bounds = SESSION_LIMITS): string {
  return boundedJson(parseSessionRequest(request, bounds), bounds.workerInputBytes);
}
