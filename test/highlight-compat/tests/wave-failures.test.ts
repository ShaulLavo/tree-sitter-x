import { afterEach, expect, it, vi } from 'vitest'
import { Component } from '../src/native/component.ts'
import { ScopeSession } from '../src/native/incremental.ts'
import { PilotDocument } from '../src/native/owner.ts'
import { ThemePresentation } from '../src/native/theme-presentation.ts'
import { NativeTheme } from '../src/native/theme.ts'
import { ResultBuilder } from '../src/build.ts'
import { collectNativeWaveDocument, parseNativeWaveAnswer } from '../src/native/wave-document.ts'
import { readJsJsxSplit, materializeJsJsxRows } from '../src/fixtures/js-jsx-wave.ts'
import { readWaveSource } from '../src/wave-collection.ts'
const intake = readJsJsxSplit('development'), input = intake.inputs.find(input => input.path.endsWith('/javascript/ordinary.js'))
if (!input) throw new Error('Missing ordinary DEV control')
const row = materializeJsJsxRows(intake).scopeRows.find(row => row.fixture === input.id && row.profile === 'product')
if (!row) throw new Error('Missing declaration')
const request = { row, source: readWaveSource(input), themes: intake.themes, selectionSha256: intake.selectionSha256 }
afterEach(() => vi.restoreAllMocks())
it('keeps normalization, native compile/resolve, stale, and missing-lease failures distinct without losing unrelated tracks', async () => {
  const select = ThemePresentation.prototype.select, compile = NativeTheme.compile, resolve = NativeTheme.prototype.resolve, acquire = ThemePresentation.prototype.acquire
  let selects = 0, compiles = 0, resolves = 0, acquisitions = 0
  vi.spyOn(ThemePresentation.prototype, 'select').mockImplementation(function(this: ThemePresentation, view, callback, options) {
    if (++selects === 1) return select.call(this, view, async () => ({ kind: 'unsupported', code: 'selector', location: { kind: 'request' } }), options)
    if (selects === 2) return Promise.resolve({ kind: 'discarded' })
    return select.call(this, view, callback, options)
  })
  vi.spyOn(NativeTheme, 'compile').mockImplementation(function(this: typeof NativeTheme, input, options) {
    if (++compiles === 1) return Promise.resolve({ kind: 'budget', code: 'compile-steps', limit: 0, location: { kind: 'request' } })
    return compile.call(this, input, options)
  })
  vi.spyOn(NativeTheme.prototype, 'resolve').mockImplementation(function(this: NativeTheme, paths, options) {
    if (++resolves === 1) return { kind: 'no-memory', code: 'allocation', location: { kind: 'request' } }
    return resolve.call(this, paths, options)
  })
  vi.spyOn(ThemePresentation.prototype, 'acquire').mockImplementation(function(this: ThemePresentation, view) {
    if (++acquisitions === 2) return undefined
    return acquire.call(this, view)
  })
  const answer = await collectNativeWaveDocument(request, new AbortController().signal)
  expect(answer.kind).toBe('scopes-complete')
  if (answer.kind !== 'scopes-complete') throw new Error(JSON.stringify(answer))
  const failures = answer.themes.filter(theme => theme.kind === 'failed')
  expect(failures.map(theme => theme.outcome.kind)).toEqual(expect.arrayContaining(['unsupported', 'budget', 'no-memory', 'discarded', 'unavailable']))
  expect(answer.themes.some(theme => theme.kind === 'complete')).toBe(true)
  expect(Object.keys(answer.presented.styles ?? {})).toHaveLength(answer.themes.filter(theme => theme.kind === 'complete').length)
  expect(parseNativeWaveAnswer(JSON.parse(JSON.stringify(answer)), request).kind).toBe('scopes-complete')
})
it.each(['component', 'owner', 'session', 'view', 'scope', 'raw-lease', 'serialization', 'presentation', 'cleanup-owner', 'cleanup-session'] as const)('unwinds %s failure without leaking native allocations', async mode => {
  const component = await Component.load(); await component.runtime.language('javascript')
  const baseline = component.liveAllocations()
  inject(mode)
  const answer = await collectNativeWaveDocument({ ...request, themes: ['light-plus'] }, new AbortController().signal)
  expect(answer.kind).toBe('scope-failed')
  expect(answer.presented.status).toBe('error')
  expect(component.liveAllocations()).toBe(baseline)
  if (answer.evidence.retainedBytesAfterDispose !== null) expect(answer.evidence.retainedBytesAfterDispose).toBe(0)
  if (mode.startsWith('cleanup')) expect(answer.evidence.cleanupErrors).not.toEqual([])
})
function inject(mode: string): void {
  const fail = () => { throw new Error('test-owned resource boundary') }
  if (mode === 'component') vi.spyOn(Component, 'load').mockRejectedValue(new Error('test-owned component'))
  if (mode === 'owner') vi.spyOn(PilotDocument, 'open').mockRejectedValue(new Error('test-owned owner'))
  if (mode === 'session') vi.spyOn(ScopeSession, 'attach').mockImplementation(fail)
  if (mode === 'view') vi.spyOn(ScopeSession.prototype, 'attachView').mockImplementation(fail)
  if (mode === 'scope') vi.spyOn(ScopeSession.prototype, 'flushOne').mockImplementation(fail)
  if (mode === 'raw-lease') vi.spyOn(ScopeSession.prototype, 'acquireFull').mockReturnValue(undefined)
  if (mode === 'serialization') vi.spyOn(ResultBuilder.prototype, 'complete').mockImplementationOnce(fail)
  if (mode === 'presentation') vi.spyOn(ThemePresentation.prototype, 'select').mockRejectedValue(new Error('test-owned presentation'))
  if (mode === 'cleanup-owner') {
    const original = PilotDocument.prototype.dispose
    vi.spyOn(PilotDocument.prototype, 'dispose').mockImplementation(function(this: PilotDocument) { original.call(this); fail() })
  }
  if (mode === 'cleanup-session') {
    const original = ScopeSession.prototype.dispose
    vi.spyOn(ScopeSession.prototype, 'dispose').mockImplementation(function(this: ScopeSession) { original.call(this); fail() })
  }
}
it('keeps native budget/no-memory scope reasons rather than relabeling them as wall timeouts', async () => {
  const outcome = ScopeSession.prototype.outcome
  vi.spyOn(ScopeSession.prototype, 'outcome').mockImplementation(function(this: ScopeSession, view) {
    const actual = outcome.call(this, view)
    if (!actual) throw new Error('Missing real work identity')
    return { kind: 'incomplete', reason: 'budget', work: actual.work, diagnostic: 'test-owned budget' }
  })
  const answer = await collectNativeWaveDocument(request, new AbortController().signal)
  expect(answer.kind).toBe('scope-failed')
  expect(answer.presented.status).toBe('error')
  expect(answer.evidence.scopeFailure).toMatchObject({ kind: 'incomplete', reason: 'budget' })
})
it('cancels actual deferred acquisition, preserves every dependent theme row, and disposes the session', async () => {
  const original = ThemePresentation.prototype.select, abort = new AbortController()
  vi.spyOn(ThemePresentation.prototype, 'select').mockImplementation(function(this: ThemePresentation, view, acquire, options) {
    return original.call(this, view, async () => { const value = await acquire(); abort.abort(); return value }, options)
  })
  const answer = await collectNativeWaveDocument({ ...request, themes: ['light-plus', 'vesper'] }, abort.signal)
  expect(answer.kind).toBe('scopes-complete')
  if (answer.kind !== 'scopes-complete') throw new Error('Lost valid scope output')
  expect(answer.themes.map(theme => theme.kind === 'failed' ? theme.outcome.kind : theme.kind)).toEqual(['canceled', 'canceled'])
  expect(answer.presented.styles).toBeUndefined()
  expect(answer.evidence.retainedBytesAfterDispose).toBe(0)
  expect(answer.evidence.cleanupErrors).toEqual([])
})
