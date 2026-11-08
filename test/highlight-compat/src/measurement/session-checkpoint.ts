import { digest } from '../native/component-inputs.ts';
import { sourceSha256 } from '../source.ts';
import type { ScopeLease } from '../native/scope-output.ts';
import type { PresentationLease } from '../native/theme-presentation.ts';
import type { NormalizedTheme } from '../native/theme-input.ts';
import { boundedJson, jsonBytes, addBytes } from './bounds.ts';
import { SESSION_LIMITS } from './session-case.ts';

export const CHECKPOINTS = ['initial-a', 'edited-a', 'edited-b'] as const;
export type Checkpoint = typeof CHECKPOINTS[number];
export function sourceIdentity(source: string) {
  return { utf16leSha256: digest(Buffer.from(source, 'utf16le')), wtf8Sha256: sourceSha256(source), length: source.length };
}
function checkpointBudget(ceiling: number) {
  let used = 0;
  return { reserve(value: unknown, delimiter = 0) { used = addBytes(used, jsonBytes(value, ceiling - used) + delimiter, ceiling); },
    growth(previous: number, next: number) { used = addBytes(used, Math.max(0, String(next).length - String(previous).length), ceiling); } };
}
function boundedItems<T>(budget: ReturnType<typeof checkpointBudget>) {
  const items: T[] = [];
  return { items, push(value: T) { budget.reserve(value, items.length ? 1 : 0); items.push(value); } };
}
export function semanticCheckpoint(source: string, scope: ScopeLease, style: PresentationLease, theme: NormalizedTheme,
  checkpoint: Checkpoint, ceiling = SESSION_LIMITS.checkpointBytes) {
  const snapshot = scope.snapshot, painted = style.snapshot;
  if (snapshot !== scope.projectFraming('identity-v1').snapshot || snapshot.generation !== painted.key.generation ||
      snapshot.owner !== painted.key.owner || snapshot.sourceLength !== source.length || snapshot.coverage.from !== 0 || snapshot.coverage.to !== source.length) throw new Error('Mismatched full checkpoint admission');
  const input = sourceIdentity(source);
  const header = { source: input, coverage: snapshot.coverage, complete: true, profile: theme.profile, framing: painted.key.framing,
    theme: theme.contentRevision, segments: [], styles: [], metadata: null };
  const budget = checkpointBudget(ceiling); budget.reserve(header);
  const segments = boundedItems<readonly [number, number, readonly string[]]>(budget);
  let previous: [number, number, readonly string[]] | undefined, previousPath = '';
  for (let index = 0; index < snapshot.segments.length; index += 3) {
    const from = snapshot.segments[index], to = snapshot.segments[index + 1];
    const names = snapshot.dictionary.paths[snapshot.segments[index + 2]].map(id => snapshot.dictionary.names[id]);
    const path = boundedJson(names, ceiling);
    if (previous && previous[1] === from && previousPath === path) { budget.growth(previous[1], to); previous[1] = to; continue; }
    previous = [from, to, names]; previousPath = path; segments.push(previous);
  }
  const styles = boundedItems<{ from: number; to: number; style: PresentationLease['snapshot']['runs'][number]['style'] }>(budget);
  let last: typeof styles.items[number] | undefined, lastStyle = '';
  for (const run of painted.runs) {
    const key = boundedJson(run.style, ceiling);
    if (last && last.to === run.from && lastStyle === key) { budget.growth(last.to, run.to); last.to = run.to; continue; }
    last = { from: run.from, to: run.to, style: run.style }; lastStyle = key; styles.push(last);
  }
  const payload = { ...header, segments: segments.items, styles: styles.items };
  const encoded = boundedJson(payload, ceiling);
  return { checkpoint, sourceUtf16leSha256: input.utf16leSha256, sourceWtf8Sha256: input.wtf8Sha256, sourceLength: source.length,
    coverage: snapshot.coverage, theme: { contentRevision: theme.contentRevision, acquisitionRevision: theme.acquisitionRevision,
      normalizedPacketDigest: theme.normalizedPacketDigest, targetIdentity: theme.targetIdentity, profile: theme.profile },
    framing: 'identity-v1' as const, scope: { owner: snapshot.owner, work: snapshot.work, generation: snapshot.generation },
    presentation: { key: painted.key }, semanticSha256: digest(Buffer.from(encoded)), stylesSha256: digest(Buffer.from(boundedJson(styles.items, ceiling))), serializedPayloadBytes: Buffer.byteLength(encoded),
    scopeSegments: snapshot.segments.length / 3, scopePaths: snapshot.dictionary.paths.length, scopeNames: snapshot.dictionary.names.length,
    styleRuns: painted.runs.length, metadata: null };
}
export type CheckpointRecord = ReturnType<typeof semanticCheckpoint>;
