import { expect, it } from 'vitest';
import { PilotDocument } from '../src/native/owner.ts';
import { ScopeSession } from '../src/native/incremental.ts';
import { loadLanguagePack } from '../src/native/packs.ts';

it('retains the accepted full result and charges presentation storage without scheduling classification', async () => {
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1,2]\r\n');
  const session = ScopeSession.attach(owner, new Map([['json', pack]]));
  try {
    const view = session.attachView({ from: 1, to: 2 }); session.flushOne();
    const clipped = session.acquire(view), full = session.acquireFull(view);
    expect(full?.snapshot.coverage).toEqual({ from: 0, to: 7 });
    expect(full?.snapshot.dictionary).toBe(clipped?.snapshot.dictionary);
    expect(full?.snapshot.separators).toEqual([{ from: 5, to: 7 }]);
    if (!full) throw new Error('Missing accepted scopes');
    const before = session.retainedBytes(), release = full.reserve(100);
    expect(session.retainedBytes()).toBe(before + 100);
    session.selectTheme(view);
    expect(session.presentationCurrent(full)).toBe(false);
    const next = session.acquireFull(view);
    expect(next?.snapshot).toBe(full.snapshot);
    full.release(); release(); expect(session.retainedBytes()).toBe(before);
    next?.release(); clipped?.release(); session.detachView(view);
    expect(session.retainedBytes()).toBe(0);
    expect(() => full.snapshot).toThrow('Released scope lease');
  } finally { session.dispose(); owner.dispose(); pack.dispose(); }
});
