import { expect } from 'vitest';
import { Component } from '../src/native/component.ts';
import type { NativePack } from '../src/native/component.ts';
import type { DecodedResult, Window } from '../src/native/decode.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { PilotDocument } from '../src/native/owner.ts';
import { nativeScopes } from '../src/native/adapter.ts';

export const roots = [
  { language: 'javascript', root: 'source.js', suffix: '.js' },
  { language: 'jsx', root: 'source.js.jsx', suffix: '.js.jsx' },
] as const;
export type Root = typeof roots[number];

export async function usingRoot(identity: Root, source: string,
  action: (pack: NativePack, owner: PilotDocument) => void | Promise<void>): Promise<void> {
  const component = await Component.load(), baseline = component.liveAllocations();
  const pack = await loadLanguagePack(identity.language);
  try {
    const owner = await PilotDocument.open(identity.language, source);
    try { await action(pack, owner); } finally { owner.dispose(); }
  } finally { pack.dispose(); }
  expect(component.liveAllocations()).toBe(baseline);
}

export function decoded(pack: NativePack, owner: PilotDocument, window?: Window): DecodedResult {
  const result = nativeScopes(pack, owner, window);
  if (result.status !== 0) throw new Error(`Failed experimental scope pass: ${JSON.stringify(result)}`);
  return result;
}

export function intervals(pack: NativePack, result: DecodedResult) {
  return Array.from({ length: result.segments.length / 3 }, (_, index) => ({
    from: result.segments[index * 3], to: result.segments[index * 3 + 1],
    scopes: result.paths[result.segments[index * 3 + 2]].map(id => pack.scopes[id]),
  }));
}

export function pathAt(pack: NativePack, result: DecodedResult, offset: number): readonly string[] {
  const row = intervals(pack, result).find(row => row.from <= offset && row.to > offset);
  if (!row) throw new Error(`Missing unit at ${offset}`);
  return row.scopes;
}

export function clip(pack: NativePack, owner: PilotDocument, full: DecodedResult, window: Window): void {
  const expected = intervals(pack, full).filter(row => row.from < window.end && row.to > window.start)
    .map(row => ({ ...row, from: Math.max(row.from, window.start), to: Math.min(row.to, window.end) }));
  expect(intervals(pack, decoded(pack, owner, window))).toEqual(window.start === window.end ? [] : expected);
}

export function scoped(identity: Root, names: readonly string[]): readonly string[] {
  const root: readonly string[] = [identity.root];
  return root.concat(names.map(name => `${name}${identity.suffix}`));
}
