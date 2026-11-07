import { sameOwner } from './owner-state.ts';
import { Component } from './component.ts';
import type { NativePack } from './component.ts';
import { Runtime, foreign, release } from './runtime.ts';
import { PilotDocument } from './owner.ts';
import type { Borrowed } from './borrow.ts';

export interface IntervalEvidence {
  readonly from: number; readonly to: number; readonly pattern: number;
  readonly scope: string; readonly capture: string; readonly priority: number;
  readonly disposition: string; readonly location: string;
}
export async function explainDocument(pack: NativePack, owner: PilotDocument): Promise<readonly IntervalEvidence[]> {
  const key = owner.key();
  return explainSource(pack, owner.languageId, owner.source.length, action => {
    if (!sameOwner(key, owner.key())) throw new Error('Stale native explanation');
    return owner.borrow(pack.sameLanguage, action);
  });
}
export async function explainSource(pack: NativePack, languageId: string, length: number,
  borrow: <T>(action: (borrowed: Borrowed) => T) => T, start = 0, end = length): Promise<readonly IntervalEvidence[]> {
  pack.assertLanguage(languageId);
  const releasePack = pack.retain();
  try { return await explainRetained(pack, languageId, borrow, start, end); } finally { releasePack(); }
}
async function explainRetained(pack: NativePack, languageId: string, borrow: <T>(action: (borrowed: Borrowed) => T) => T, start: number, end: number): Promise<readonly IntervalEvidence[]> {
  const runtime = await Runtime.load(), component = await Component.load();
  const query = runtime.construct('Query', [await runtime.language(languageId), pack.spec.files.map(file => file.query).join('\n')]);
  try {
    const captureNames = foreign(query).captureNames;
    if (!Array.isArray(captureNames) || !captureNames.every((name): name is string => typeof name === 'string')) throw new Error('Invalid capture names');
    const result = borrow(borrowed => pack.explain(borrowed, { start, end }));
    if (result.status !== 0) throw new Error(`Native explain failed: ${result.status}, detail ${result.detail}`);
    const locations = Array.from({ length: pack.patterns }, (_, pattern) => patternLocation(pack,
      pack.withHandle(handle => component.number('scope_compat_pack_pattern_start', [handle, pattern]))));
    return Array.from({ length: result.intervals.length / 8 }, (_, index) => {
      const record = result.intervals.subarray(index * 8, index * 8 + 8);
      const scope = pack.scopes[record[2]];
      const base = scope.endsWith(pack.spec.suffix) ? scope.slice(0, -pack.spec.suffix.length) : scope;
      const capture = pack.engine.selectedOrderPolicy === 'contained-span-order-1' ? `interval ordinal ${record[5]}` :
        captureNames[record[5]] === base ? `@${base}` : `make-range ${base}`;
      return { from: record[0], to: record[1], scope, pattern: record[3], priority: record[4],
        capture,
        disposition: ['kept', 'empty', 'exclusive', 'duplicate'][record[7]], location: locations[record[3]] };
    });
  } finally { release(query); }
}
function patternLocation(pack: NativePack, offset: number): string {
  let start = 0;
  for (const file of pack.spec.files) {
    const bytes = new TextEncoder().encode(file.query);
    if (offset < start + bytes.length + 1) return `${file.path}:${1 + bytes.subarray(0, offset - start).filter(byte => byte === 10).length}`;
    start += bytes.length + 1;
  }
  throw new Error('Invalid native pattern source offset');
}
