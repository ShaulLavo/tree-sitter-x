import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { collectNativeWaveDocument, parseNativeWaveAnswer, wavePolicy } from '../src/native/wave-document.ts'
import { readJsJsxSplit, materializeJsJsxRows } from '../src/fixtures/js-jsx-wave.ts'
import { readWaveSource, same } from '../src/wave-collection.ts'
import { Runtime, foreign, invoke } from '../src/native/runtime.ts'
import { Component } from '../src/native/component.ts'
import { observeRuntimeAllocations } from './native-markdown-observer.ts'
import type { Foreign } from '../src/native/runtime.ts'
const allocations = observeRuntimeAllocations()
let coreObserver: Foreign | undefined
beforeAll(async () => {
  const runtime = await Runtime.load()
  coreObserver = await runtime.extension(new WebAssembly.Module(readFileSync(new URL('../../../lib/scope-compat/build/scope-test-observer.wasm', import.meta.url))))
  invoke(coreObserver, 'scope_test_install')
})
afterAll(() => { try { if (coreObserver) invoke(coreObserver, 'scope_test_reset') } finally { allocations.restore() } })
const intake = readJsJsxSplit('development')
const declarations = materializeJsJsxRows(intake).scopeRows
function request(language: 'javascript' | 'jsx', lane: string, profile: 'raw' | 'product' = 'product', all = false) {
  const input = intake.inputs.find(input => input.languageId === language && input.path.endsWith(`/${lane}.${language === 'jsx' ? 'jsx' : 'js'}`))
  if (!input) throw new Error('Missing DEV fixture')
  const row = declarations.find(row => row.fixture === input.id && row.profile === profile)
  if (!row) throw new Error('Missing declaration')
  return { row, source: readWaveSource(input), themes: all ? intake.themes : ['github-dark', 'light-plus'], selectionSha256: intake.selectionSha256 }
}
it('maps every reference profile without impersonating cold/warm performance', () => {
  expect(intake.profiles.map(profile => wavePolicy(profile))).toEqual([
    { normalization: 'raw', framing: 'identity-v1' }, { normalization: 'raw', framing: 'identity-v1' },
    { normalization: 'product', framing: 'identity-v1' }, { normalization: 'product', framing: 'future010-product-lines-v1' }, { normalization: 'product', framing: 'future010-product-lines-v1' },
  ])
})
it.each(['javascript', 'jsx'] as const)('uses actual %s owners and native presentation for ordinary, empty, UTF16 and line-limit DEV', async language => {
  for (const lane of ['ordinary', 'empty', 'utf16', 'delimiter', 'line-limit']) {
    const input = request(language, lane)
    const answer = await collectNativeWaveDocument(input, new AbortController().signal)
    expect(answer.kind, JSON.stringify(answer.evidence)).toBe('scopes-complete')
    const validated = parseNativeWaveAnswer(JSON.parse(JSON.stringify(answer)), input)
    expect(validated.evidence.retainedBytesAfterDispose).toBe(0)
    if (answer.kind !== 'scopes-complete') throw new Error('No scopes')
    expect(answer.rawFull.profileId).toBe('native')
    expect(answer.evidence.scopeIdentity?.owner.revision).toBe(0)
    expect(answer.themes).toHaveLength(2)
    expect(answer.themes.some(theme => theme.kind === 'complete')).toBe(true)
    expect(Object.keys(answer.presented.styles ?? {}).length).toBe(input.source.length ? answer.themes.filter(theme => theme.kind === 'complete').length : 0)
    if (lane === 'utf16') expect(answer.rawFull.scopeNames[answer.rawFull.paths[answer.rawFull.spans[2]][0]]).toBe(language === 'jsx' ? 'source.js.jsx' : 'source.js')
  }
}, 30000)
it('observes exactly one parse/classification and no extra work over all 65 actual locked themes', async () => {
  const runtime = await Runtime.load(), component = await Component.load()
  await runtime.language('javascript')
  const baseline = component.liveAllocations(), runtimeBaseline = allocations.live()
  const proto = foreign(foreign(runtime.binding.Parser).prototype), parse = proto.parse, call = Component.prototype.call
  let parses = 0, classifications = 0
  if (typeof parse !== 'function') throw new Error('Missing Parser.parse')
  Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: function(this: unknown, ...args: unknown[]) { parses++; return Reflect.apply(parse, this, args) } })
  Component.prototype.call = function(name, args = []) { if (name === 'scope_compat_run' || name === 'scope_compat_explain') classifications++; return call.call(this, name, args) }
  try {
    const input = request('javascript', 'ordinary', 'product', true)
    const result = await collectNativeWaveDocument(input, new AbortController().signal)
    expect(result.kind).toBe('scopes-complete')
    expect(parses).toBe(1); expect(classifications).toBe(1)
    expect(result.evidence.selectionsAttempted).toBe(65)
    if (result.kind !== 'scopes-complete') throw new Error('Missing complete scopes')
    expect(result.themes).toHaveLength(65)
    expect(result.themes.some(theme => theme.kind === 'complete')).toBe(true)
    expect(result.themes.some(theme => theme.kind === 'failed')).toBe(true)
    expect(result.evidence.retainedBytesAfterDispose).toBe(0)
    same(component.liveAllocations(), baseline, 'Component baseline changed')
    expect(allocations.live()).toBe(runtimeBaseline)
  } finally {
    Object.defineProperty(proto, 'parse', { configurable: true, writable: true, value: parse }); Component.prototype.call = call
  }
}, 30000)
it('cancellation retains explicit failure and no owned native objects', async () => {
  const input = request('javascript', 'ordinary'), answer = await collectNativeWaveDocument(input, AbortSignal.abort())
  expect(answer.kind).toBe('scope-failed')
  expect(answer.presented.status).toBe('canceled')
  expect(answer.evidence.cleanupErrors).toEqual([])
})

it('runs one real finite fixture/profile worker with every locked theme and validates its post-cleanup reply', async () => {
  const { superviseWorker } = await import('../src/wave-collection.ts')
  const input = request('jsx', 'ordinary', 'product', true)
  const result = await superviseWorker({ url: new URL('../src/native/wave-worker.ts', import.meta.url), data: input, validate: value => parseNativeWaveAnswer(value, input) })
  expect(result.kind).toBe('complete')
  expect(result.reaped).toBe(true)
  if (result.kind !== 'complete') throw new Error(JSON.stringify(result))
  expect(result.value.kind).toBe('scopes-complete')
  expect(result.value.evidence.selectionsAttempted).toBe(65)
}, 30000)
it('projects raw native named styles to harness resolved styles without background or zero-flag reset', async () => {
  const input = { ...request('javascript', 'ordinary', 'raw'), themes: ['light-plus'] }
  const answer = await collectNativeWaveDocument(input, new AbortController().signal)
  expect(answer.kind).toBe('scopes-complete')
  if (answer.kind !== 'scopes-complete') throw new Error('No raw scopes')
  expect(answer.themes[0]?.kind).toBe('complete')
  expect(answer.evidence.framing).toBe('identity-v1')
  expect(answer.rawFull.spans).toEqual(answer.presented.spans)
  for (const track of Object.values(answer.presented.styles ?? {})) for (const style of track.styles) {
    expect(style.background).toBeUndefined()
    expect(style.fontStyle === 'reset').toBe(false)
  }
})

it('rejects missing/duplicate theme attempts, extra metadata, invalid engine identities and malformed native schema documents', async () => {
  const input = { ...request('javascript', 'ordinary'), themes: ['light-plus'] }
  const answer = await collectNativeWaveDocument(input, new AbortController().signal)
  if (answer.kind !== 'scopes-complete') throw new Error('Missing actual native answer')
  for (const presented of [
    { ...answer.presented, profileId: 'raw' }, { ...answer.presented, documentRevision: 1 },
    { ...answer.presented, styles: {} }, { ...answer.presented, spans: [0, input.source.length + 1, 0] },
    { ...answer.presented, engine: { ...answer.presented.engine, componentSha256: '0'.repeat(64) } },
    { ...answer.presented, metadata: { languageIds: ['javascript'], spans: [0, input.source.length, 0] } },
  ]) expect(() => parseNativeWaveAnswer({ ...answer, presented }, input)).toThrow()
  expect(() => parseNativeWaveAnswer({ ...answer, themes: [] }, input)).toThrow()
  expect(() => parseNativeWaveAnswer({ ...answer, themes: answer.themes.concat(answer.themes) }, input)).toThrow()
  expect(() => parseNativeWaveAnswer({ ...answer, evidence: { ...answer.evidence, retainedBytesAfterDispose: 1 } }, input)).toThrow()
})
