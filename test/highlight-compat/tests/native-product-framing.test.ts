import { expect, it, vi } from 'vitest';
import { PilotDocument } from '../src/native/owner.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { loadLanguagePack } from '../src/native/packs.ts';
import { clipSnapshot, decodedSnapshot } from '../src/native/scope-output.ts';
import { clipStyles } from '../src/native/theme-cache.ts';
import { context, full, product, styled, theme, pathAt, flush, resources } from './native-product-controls.ts';
import * as framing from '../src/native/scope-framing.ts';
import { observe } from './native-theme-presentation-controls.ts';

it('captures immutable full-generation facts before publishing even a full-window clip', async () => {
  const source = 'x'.repeat(20001) + '\r\nZ\r', pack = await loadLanguagePack('typescript');
  const owner = await PilotDocument.open('typescript', source), session = ScopeSession.attach(owner, new Map([['typescript', pack]]));
  const held = resources();
  try {
    const view = session.attachView({ from: 0, to: source.length }); session.flushOne();
    const full = session.acquireFull(view), clipped = session.acquire(view);
    if (!full || !clipped) throw new Error('Missing complete scopes');
    held.hold(full); held.hold(clipped);
    const facts = full.snapshot.sourceFacts;
    expect(facts).toMatchObject({
      owner: full.snapshot.owner, generation: full.snapshot.generation, sourceLength: source.length,
      oversized: [{ from: 0, to: 20001 }], separators: [{ from: 20001, to: 20003 }], finalCr: { from: 20004, to: 20005 }
    });
    expect(facts.separators).toBe(full.snapshot.separators); expect(clipped.snapshot.sourceFacts).toBe(facts);
    expect(Object.isFrozen(facts)).toBe(true); expect(Object.isFrozen(facts.oversized[0])).toBe(true);
    expect(() => clipped.projectFraming('future010-product-lines-v1')).toThrow('Raw full');
    const product = full.projectFraming('future010-product-lines-v1');
    expect(decodedSnapshot(product.snapshot)[0].scopes).toEqual([]);
    expect(product.snapshot.sourceFacts).toBe(facts);
    expect(full.projectFraming('identity-v1').snapshot).toBe(full.snapshot);
  } finally { held.release(); session.dispose(); owner.dispose(); pack.dispose(); }
  expect(session.retainedBytes()).toBe(0);
});

it.each(['', '\n', '\r\n', '\r'])('uses strict full UTF-16 line thresholds before %j', async ending => {
  const source = 'a'.repeat(19999) + '\n' + 'b'.repeat(20000) + '\n' + 'c'.repeat(20001) + ending;
  const current = await context(source), lease = full(current), held = resources();
  try {
    expect(lease.snapshot.sourceFacts.oversized).toEqual([{ from: 40001, to: 60002 }]);
    expect((await current.presentation.select(current.view, async () => theme(), { framing: product })).kind).toBe('complete');
    const output = held.hold(styled(current));
    expect(pathAt(output.snapshot.scopes, 19998)).toContain('source.ts');
    expect(pathAt(output.snapshot.scopes, 39999)).toContain('source.ts');
    expect(pathAt(output.snapshot.scopes, 40001)).toEqual([]);
    expect(output.snapshot.runs.find(run => run.from <= 40001 && run.to > 40001)?.style).toEqual({ foreground: '#102030ff', fontMask: 0, fontStyle: 'reset' });
    expect(output.snapshot.runs.find(run => run.from <= 0 && run.to > 0)?.style).toEqual({ foreground: '#aabbccff', fontMask: 2, fontStyle: { bold: true } });
    expect(output.snapshot.runs.find(run => run.from <= 19999 && run.to > 19999)?.style).toEqual({});
    if (ending) expect(output.snapshot.runs.at(-1)?.style).toEqual({});
    expect(output.snapshot.runs.reduce((sum, run) => sum + run.to - run.from, 0)).toBe(source.length);
  } finally { held.release(); lease.release(); current.dispose(); }
});

const thresholds = [19999, 20000, 20001].flatMap(size => ['', '\n', '\r\n', '\r'].map(ending => ({ size, ending })));
it.each(thresholds)('classifies exactly $size line-text units before $ending', async ({ size, ending }) => {
  const current = await context('x'.repeat(size) + ending), lease = full(current);
  try {
    expect(lease.snapshot.sourceFacts.oversized).toEqual(size > 20000 ? [{ from: 0, to: size }] : []);
    const projected = lease.projectFraming(product);
    if (size > 20000) expect(pathAt(projected.snapshot, size - 1)).toEqual([]);
    else expect(pathAt(projected.snapshot, size - 1)).toContain('source.ts');
    if (ending) expect(pathAt(projected.snapshot, size)).toEqual([]);
  } finally { lease.release(); current.dispose(); }
});

it.each(['', '\r', '\n', '\r\r\n', '\uFEFFx\rY\r\n\nZ\r', '😀'.repeat(10000) + 'e\u0301', 'a'.repeat(19999) + '\rZ'])('preserves exact unit, CR and BOM contracts for case %#', async source => {
  const current = await context(source), lease = full(current);
  try {
    const projected = lease.projectFraming(product), facts = lease.snapshot.sourceFacts;
    expect(facts.sourceLength).toBe(source.length);
    if (projected.kind !== 'product-lines') throw new Error('Wrong policy');
    if (source.startsWith('\uFEFF')) expect(pathAt(projected.snapshot, 0)).toContain('source.ts');
    if (source === '\r\r\n') expect(facts).toMatchObject({ separators: [{ from: 1, to: 3 }], finalCr: null });
    if (source.startsWith('😀')) expect(facts.oversized).toEqual([{ from: 0, to: 20002 }]);
    if (source.startsWith('aaa')) expect(facts.oversized).toEqual([{ from: 0, to: 20001 }]);
    expect(projected.snapshot.segments.filter((_entry, i) => i % 3 === 0).length).toBe(projected.reasons.length);
    expect(projected.snapshot.segments.reduce((sum, entry, i, all) => i % 3 === 1 ? sum + entry - all[i - 1] : sum, 0)).toBe(source.length);
    expect(lease.projectFraming('identity-v1').snapshot).toBe(lease.snapshot);
    if (source.endsWith('\r')) {
      expect(projected.reasons.at(-1)).toBe('separator');
      expect(pathAt(lease.snapshot, source.length - 1)).toContain('source.ts');
    }
  } finally { lease.release(); current.dispose(); }
});

it('projects the complete line before windows inside long text, CRLF, final CR and empty coverage', async () => {
  const source = 'a'.repeat(20001) + '\r\nZ\r', current = await context(source), held = resources(), acquire = async () => theme();
  try {
    await current.presentation.select(current.view, async () => theme(), { framing: product });
    const output = held.hold(styled(current));
    for (const viewport of [{ from: 19999, to: 20002 }, { from: 20002, to: 20003 }, { from: 20004, to: 20005 }, { from: 7, to: 7 }]) {
      current.session.request(current.view, { viewport, theme: 5 }); current.session.flushOne();
      await current.presentation.select(current.view, acquire, { framing: product });
      const window = held.hold(styled(current));
      expect(window.snapshot.scopes).toEqual(clipSnapshot(output.snapshot.scopes, viewport));
      expect(window.snapshot.runs).toEqual(clipStyles(output.snapshot.runs, viewport));
      window.release();
    }
  } finally { held.release(); current.dispose(); }
});

it('retains generation facts after a same-length edit and disposal, never borrowing current source', async () => {
  const source = 'a'.repeat(20001) + '\nZ', current = await context(source), old = full(current), held = resources();
  const replacement = 'a'.repeat(10000) + '\n' + 'b'.repeat(10002);
  try {
    expect(replacement.length).toBe(source.length);
    await current.presentation.select(current.view, async () => theme(), { framing: product });
    const oldStyle = held.hold(styled(current));
    await current.owner.applyEdits({ base: current.owner.key(), edits: [{ from: 0, to: source.length, insert: replacement }] }); flush(current.session, current.owner);
    const next = held.hold(full(current));
    expect(next.snapshot.sourceFacts.oversized).toEqual([]); expect(next.snapshot.sourceFacts).not.toBe(old.snapshot.sourceFacts);
    next.release();
    current.dispose();
    held.watch(vi.spyOn(PilotDocument.prototype, 'source', 'get').mockImplementation(() => { throw new Error('Source read after generation'); }));
    expect(old.projectFraming(product).snapshot.sourceFacts.oversized).toEqual([{ from: 0, to: 20001 }]);
    expect(oldStyle.snapshot.runs[0].style).toMatchObject({ foreground: '#102030ff' });
  } finally { held.release(); old.release(); current.dispose(); }
  expect(current.session.retainedBytes()).toBe(0); expect(() => old.snapshot).toThrow('Released');
});

it('reuses the logical projection across serial themes with executable zero-work observers', async () => {
  const counts = await observe(), scan = vi.spyOn(framing, 'collectSourceFacts'), projection = vi.spyOn(framing, 'buildProduct');
  const current = await context('a'.repeat(20001) + '\nZ'), held = resources(), acquire = async () => theme();
  try {
    expect(counts.read().parse).toBeGreaterThan(0); expect(counts.read().classify).toBeGreaterThan(0); expect(scan).toHaveBeenCalledTimes(1);
    counts.reset();
    const sourceRead = held.watch(vi.spyOn(PilotDocument.prototype, 'source', 'get').mockImplementation(() => { throw new Error('Unexpected theme source read'); }));
    expect(() => current.owner.source).toThrow('Unexpected theme source read'); sourceRead.mockClear();
    await serialThemes(current);
    expect(counts.read()).toEqual({ parse: 0, classify: 0, resolver: 0 }); expect(scan).toHaveBeenCalledTimes(1); expect(projection).toHaveBeenCalledTimes(1);
    expect(sourceRead).not.toHaveBeenCalled();
    sourceRead.mockRestore();
    const markdown = await context('```json\n1\n```\n', {}, true);
    try {
      expect(counts.read().resolver).toBeGreaterThan(0); counts.reset();
      await markdown.presentation.select(markdown.view, acquire, { framing: product });
      expect(counts.read()).toEqual({ parse: 0, classify: 0, resolver: 0 });
    } finally { markdown.dispose(); }
  } finally { held.release(); current.dispose(); counts.restore(); scan.mockRestore(); projection.mockRestore(); }
});
async function serialThemes(current: Awaited<ReturnType<typeof context>>): Promise<void> {
  for (const [foreground, framingPolicy] of [['#102030', product], ['#112233', product], ['#102030', 'identity-v1'], ['#112233', product]] as const) {
    expect((await current.presentation.select(current.view, async () => theme(foreground), { framing: framingPolicy })).kind).toBe('complete');
  }
}
