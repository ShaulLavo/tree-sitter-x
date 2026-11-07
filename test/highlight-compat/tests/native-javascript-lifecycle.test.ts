import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Component } from '../src/native/component.ts';
import { Runtime, invoke } from '../src/native/runtime.ts';
import type { Foreign } from '../src/native/runtime.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { decodedSnapshot } from '../src/native/scope-output.ts';
import { ThemePresentation } from '../src/native/theme-presentation.ts';
import { baselineScopes } from '../src/baselines/run.ts';
import { loadHistoricalPacks } from '../src/experiment-007.ts';
import { observeRuntimeAllocations } from './native-observer.ts';
import { observe } from './native-theme-presentation-controls.ts';
import { theme } from './native-product-controls.ts';
import type { Root } from './native-javascript-root-controls.ts';
import { roots, usingRoot, decoded } from './native-javascript-root-controls.ts';

const allocations = observeRuntimeAllocations();
let observer: Foreign | undefined;
beforeAll(async () => {
  const runtime = await Runtime.load();
  observer = await runtime.extension(new WebAssembly.Module(await readFile(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))));
  invoke(observer, 'scope_test_install');
});
afterAll(() => {
  try { if (observer) invoke(observer, 'scope_test_reset'); } finally { allocations.restore(); }
});

it.each(roots)('keeps $language classification on the borrowed tree and frees repeated owner cycles', async identity => {
  const component = await Component.load();
  await component.runtime.language(identity.language);
  const counts = await observe(), baseline = allocations.live();
  try {
    await baselineScopes('baseline:captures', identity.language, 'const sample = 8;');
    expect(counts.read().parse).toBe(1);
    const warmed = allocations.live();
    for (let index = 0; index < 20; index++) await cycle(identity, () => counts.read().parse);
    expect(counts.read()).toMatchObject({ parse: 21, classify: 40, resolver: 0 });
    expect(allocations.live()).toBe(warmed);
    expect(allocations.live()).toBeGreaterThanOrEqual(baseline);
  } finally { counts.restore(); }
});

it.each(roots)('keeps $language product framing on generation-bound leases and rethemes without scope work', async identity => {
  const source = ' '.repeat(20001) + '\r\nconst next = 2;\r';
  await usingRoot(identity, source, async (pack, owner) => {
    const session = ScopeSession.attach(owner, new Map([[identity.language, pack]])), presentation = new ThemePresentation(session);
    const view = session.attachView({ from: 4, to: 9 }); session.flushOne();
    const lease = session.acquireFull(view);
    if (!lease) throw new Error('Missing full root lease');
    const counts = await observe();
    try {
      expect(lease.snapshot.sourceFacts.oversized).toEqual([{ from: 0, to: 20001 }]);
      expect(decodedSnapshot(lease.projectFraming('identity-v1').snapshot)[0].scopes).toEqual([identity.root]);
      expect(decodedSnapshot(lease.projectFraming('future010-product-lines-v1').snapshot)[0].scopes).toEqual([]);
      await checkThemes(presentation, view);
      expect(counts.read()).toEqual({ parse: 0, classify: 0, resolver: 0 });
      expect((await owner.applyEdits({ base: owner.key(), edits: [{ from: 0, to: 1, insert: '\n' }] })).kind).toBe('ready');
      session.flushOne();
      checkCurrentFacts(session, view);
      owner.dispose();
      expect(lease.projectFraming('future010-product-lines-v1').snapshot.sourceFacts.oversized).toEqual([{ from: 0, to: 20001 }]);
      expect(lease.snapshot.sourceLength).toBe(source.length);
    } finally { counts.restore(); lease.release(); presentation.dispose(); session.dispose(); }
    expect(session.retainedBytes()).toBe(0);
  });
});

async function checkThemes(presentation: ThemePresentation, view: Parameters<ThemePresentation['select']>[0]): Promise<void> {
  for (const color of ['#102030', '#405060', '#708090']) {
    expect((await presentation.select(view, async () => theme(color), { framing: 'future010-product-lines-v1' })).kind).toBe('complete');
    const styled = presentation.acquire(view);
    if (!styled) throw new Error('Missing actual native style lease');
    try {
      expect(styled.snapshot.runs).toEqual([{ from: 4, to: 9, style: { foreground: `${color}ff`, fontMask: 0, fontStyle: 'reset' } }]);
      expect(styled.snapshot.metadata).toBeNull();
    } finally { styled.release(); }
  }
}

function checkCurrentFacts(session: ScopeSession, view: Parameters<ScopeSession['acquireFull']>[0]): void {
  const current = session.acquireFull(view);
  if (!current) throw new Error('Missing edited root lease');
  try { expect(current.snapshot.sourceFacts.oversized).toEqual([]); } finally { current.release(); }
}

it('loads real new roots without admitting them to fixed 007', async () => {
  const packs = await loadHistoricalPacks();
  try { expect(Array.from(packs.keys())).toEqual(['json', 'typescript', 'tsx']); }
  finally { for (const pack of packs.values()) pack.dispose(); }
});

async function cycle(identity: Root, parseCount: () => number): Promise<void> {
  await usingRoot(identity, 'const sample = `🧭${invoke(8)}`;', (pack, owner) => {
    const before = parseCount(), result = decoded(pack, owner);
    expect(decoded(pack, owner)).toEqual(result);
    expect(parseCount()).toBe(before);
  });
}
