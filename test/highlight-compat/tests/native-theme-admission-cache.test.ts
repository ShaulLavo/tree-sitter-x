import { expect, it, vi } from 'vitest'
import { normalizeTheme, normalizedPacket, snapshotInput } from '../src/native/theme-input.ts'
import type { OperationalFailure, Outcome } from '../src/native/theme-contract.ts'
import { NativeTheme } from '../src/native/theme.ts'
import { ThemeCache } from '../src/native/theme-cache.ts'
import { PilotDocument } from '../src/native/owner.ts'
import { ScopeSession } from '../src/native/incremental.ts'
import { loadLanguagePack } from '../src/native/packs.ts'
import { Component } from '../src/native/component.ts'
function value<T>(result: Outcome<T> | OperationalFailure): T {
  if (result.kind !== 'ok') throw new Error(JSON.stringify(result))
  return result.value
}
function normalized(ui: null | readonly string[], fontStyle: string, target = 'synthetic-cache-target') {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: 'same', colors: { 'a~/b': ui }, settings: [{ settings: { foreground: '#123456', background: '#654321', fontStyle } }] }))
  return value(normalizeTheme(value(snapshotInput({ root: 'same', edges: [], resources: [{ id: 'same', format: 'json', bytes }] })), 'raw', target))
}
it('does not memoize by display name or projected packet when source/UI spelling or target changes', async () => {
  const component = await Component.load(), baseline = component.liveAllocations()
  const pack = await loadLanguagePack('json'), owner = await PilotDocument.open('json', '[1]')
  const session = ScopeSession.attach(owner, new Map([['json', pack]])), cache = new ThemeCache()
  const themes: NativeTheme[] = [], pairs: ReturnType<ThemeCache['acquire']>[] = []
  try {
    const view = session.attachView({ from: 0, to: 3 }); session.flushOne()
    const scope = session.acquireFull(view)
    if (!scope) throw new Error('No actual scope snapshot')
    try { await checkMemos(cache, scope, themes, pairs) }
    finally { scope.release(); session.detachView(view) }
  } finally {
    for (const pair of pairs) if (pair.kind === 'ok') pair.value.release()
    for (const theme of themes) theme.dispose()
    session.dispose(); owner.dispose(); pack.dispose(); vi.restoreAllMocks()
  }
  expect(component.liveAllocations()).toBe(baseline)
})
async function checkMemos(cache: ThemeCache, scope: Parameters<ThemeCache['acquire']>[0], themes: NativeTheme[], pairs: ReturnType<ThemeCache['acquire']>[]): Promise<void> {
  const variants = [normalized(null, 'normal'), normalized([], 'normal'), normalized(null, 'none'), normalized(null, 'normal', 'other-target')]
  for (const variant of variants) expect(normalizedPacket(variant)).toEqual(normalizedPacket(variants[0]))
  expect(new Set(variants.map(variant => variant.contentRevision)).size).toBe(4)
  for (const variant of variants) themes.push(value(await NativeTheme.compile(variant)))
  for (const [index, variant] of variants.entries()) {
    const spy = vi.spyOn(themes[index], 'resolve')
    const first = cache.acquire(scope, variant, themes[index], {}, {}), second = cache.acquire(scope, variant, themes[index], {}, {})
    pairs.push(first, second)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(value(first).runs).toBe(value(second).runs)
    expect(value(first).runs.length).toBeGreaterThan(0)
  }
}
