import { afterEach, beforeAll, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { ResultBuilder } from '../src/build.ts'
import { readJsJsxSplit, materializeJsJsxRows } from '../src/fixtures/js-jsx-wave.ts'
import { acquireWaveTheme, collectNativeWaveDocument, parseNativeWaveAnswer } from '../src/native/wave-document.ts'
import type { NativeWaveAnswer, NativeWaveRequest } from '../src/native/wave-document.ts'
import { checkWaveFiles, hash, loadReference, readWaveSource, renderCollection, REFERENCE_ORIGIN, STYLE_PROJECTION, superviseWorker } from '../src/wave-collection.ts'
import type { Execution } from '../src/wave-collection.ts'
import type { CompleteResult } from '../src/schema.ts'
import { PINS, pinLabel } from '../src/oracles/pins.ts'

const owned: string[] = []
const dev = readJsJsxSplit('development')
function directory(): string {
  const path = mkdtempSync('/work/tmp/wave010-integrity-')
  owned.push(path)
  mkdirSync(resolve(path, 'documents'))
  writeFileSync(resolve(path, 'scope-rows.json'), '[]')
  return path
}
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }) })
let request: NativeWaveRequest
let answer: Extract<NativeWaveAnswer, { kind: 'scopes-complete' }>
beforeAll(async () => {
  const input = dev.inputs.find(input => input.path.endsWith('/javascript/line-limit.js'))
  if (!input) throw new Error('Missing DEV input')
  const row = materializeJsJsxRows(dev).scopeRows.find(row => row.fixture === input.id && row.profile === 'product')
  if (!row) throw new Error('Missing DEV row')
  request = { row, source: readWaveSource(input), themes: ['light-plus'], selectionSha256: dev.selectionSha256 }
  const result = await collectNativeWaveDocument(request, new AbortController().signal)
  if (result.kind !== 'scopes-complete') throw new Error('Missing native answer')
  answer = result
  expect(answer.themes[0].kind).toBe('complete')
  expect(parseNativeWaveAnswer(answer, request).kind).toBe('scopes-complete')
}, 30000)

const source = 'x'
const row = { key: 'tiny', fixture: 'tiny', language: 'javascript', profile: 'raw', split: 'development', state: 'fresh-full', utf16Units: 1 } as const
const input = { id: 'tiny', languageId: 'javascript', split: 'development', path: 'tiny', sha256: hash(source), utf16Units: 1, storage: 'wave-packet', derivationFamilies: [] } as const
const engine = { grammars: pinLabel(PINS.langs), themes: pinLabel(PINS.themes), textmate: pinLabel(PINS.vscodeTextmate), textmateCommit: PINS.vscodeTextmate.commit,
  oniguruma: pinLabel(PINS.vscodeOniguruma), onigurumaCommit: PINS.vscodeOniguruma.commit, onigurumaWasmSha256: PINS.vscodeOniguruma.wasmSha256 }
function referenceDocument(): CompleteResult {
  return new ResultBuilder({ profileId: 'raw', languageId: 'javascript', engine }, source).scope(0, 1, ['test.original']).style('constructor', 0, 1, {}).complete()
}
it.each(['scope', 'style'] as const)('rejects changed retained %s content against its original supplied inventory', track => {
  const path = directory(), original = referenceDocument()
  const entry = { document: 'documents/tiny.json.gz', scopeSha256: hash(JSON.stringify({ scopeNames: original.scopeNames, paths: original.paths, spans: original.spans })), styleSha256: hash(JSON.stringify(original.styles ?? {})) }
  const changed = track === 'scope' ? { ...original, scopeNames: ['test.changed'] }
    : new ResultBuilder(original, source).scope(0, 1, ['test.original']).style('constructor', 0, 1, { foreground: '#123456' }).complete()
  writeFileSync(resolve(path, entry.document), gzipSync(JSON.stringify(original)))
  expect(loadReference(path, entry, row, input, source, ['constructor']).kind).toBe('valid')
  writeFileSync(resolve(path, entry.document), gzipSync(JSON.stringify(changed)))
  expect(loadReference(path, entry, row, input, source, ['constructor']).kind).toBe('invalid')
})
it.each(['resourceDigest', 'acquisitionRevision', 'contentRevision', 'normalizedPacketDigest', 'assetDigest', 'targetIdentity'] as const)('binds successful theme %s to the pinned requested registration and policy', field => {
  const themes = answer.themes.map(theme => ({ ...theme, [field]: '0'.repeat(64) }))
  expect(() => parseNativeWaveAnswer({ ...answer, themes }, request)).toThrow()
})
it.each(['wrong-theme', 'wrong-profile'] as const)('rejects successful normalization evidence from %s', async mode => {
  const acquired = await acquireWaveTheme(mode === 'wrong-theme' ? 'dark-plus' : 'light-plus', mode === 'wrong-profile' ? 'raw' : 'product')
  expect(acquired.outcome.kind).toBe('ok')
  if (acquired.outcome.kind !== 'ok') throw new Error('Missing normalized control theme')
  const normalized = acquired.outcome.value
  const themes = [{ kind: 'complete', theme: 'light-plus', warnings: acquired.outcome.warnings,
    contentRevision: normalized.contentRevision, acquisitionRevision: normalized.acquisitionRevision, targetIdentity: normalized.targetIdentity,
    normalizedPacketDigest: normalized.normalizedPacketDigest, resourceDigest: acquired.resourceDigest, assetDigest: acquired.assetDigest }]
  expect(() => parseNativeWaveAnswer({ ...answer, themes }, request)).toThrow()
})
function replaceScopes(original: CompleteResult, scopes: CompleteResult, text: string): CompleteResult {
  const builder = new ResultBuilder(original, text)
  for (let i = 0; i < scopes.spans.length; i += 3) builder.scope(scopes.spans[i], scopes.spans[i + 1], scopes.paths[scopes.spans[i + 2]].map(id => scopes.scopeNames[id]))
  for (const [theme, track] of Object.entries(original.styles ?? {})) copyStyles(builder, theme, track)
  return builder.complete()
}
function copyStyles(builder: ResultBuilder, theme: string, track: NonNullable<CompleteResult['styles']>[string]): void {
  for (let i = 0; i < track.spans.length; i += 3) builder.style(theme, track.spans[i], track.spans[i + 1], track.styles[track.spans[i + 2]])
}
it('rejects raw-full scopes carrying a product-projection label', () => {
  expect(answer.rawFull.spans).not.toEqual(answer.presented.spans)
  const presented = replaceScopes(answer.presented, answer.rawFull, request.source)
  expect(() => parseNativeWaveAnswer({ ...answer, presented }, request)).toThrow()
})
it.each([19999, 20000, 20001])('validates real product projection at %i UTF-16 units with BOM, CRLF and terminal CR', async length => {
  const text = '\ufeff' + 'x'.repeat(length - 1) + '\r\nx\r'
  const fixture = `test-owned-boundary-${length}`
  const selected = { ...request, source: text, row: { ...request.row, fixture, key: JSON.stringify(['javascript', fixture, 'product', 'fresh-full']), utf16Units: text.length } }
  const actual = await collectNativeWaveDocument(selected, new AbortController().signal)
  expect(actual.kind).toBe('scopes-complete')
  if (actual.kind !== 'scopes-complete') throw new Error('Missing boundary scopes')
  expect(parseNativeWaveAnswer(actual, selected).kind).toBe('scopes-complete')
  expect(actual.rawFull.scopeNames[actual.rawFull.paths[actual.rawFull.spans[2]][0]]).toBe('source.js')
  const changed = replaceScopes(actual.presented, actual.rawFull, text)
  expect(() => parseNativeWaveAnswer({ ...actual, presented: changed }, selected)).toThrow()
})
const workerUrl = new URL('./wave-supervisor-worker.ts', import.meta.url)
function validate(value: unknown): true {
  if (typeof value !== 'object' || value === null || !('ok' in value) || value.ok !== true) throw new Error('Wrong candidate document identity')
  return true
}
it.each(['malformed', 'duplicate', 'oversized', 'wrong-identity', 'throw', 'nonzero'] as const)('retains worker %s as the correct integrity or operational exit through readback', async mode => {
  const validateAnswer = mode === 'wrong-identity' ? () => { throw new Error('Wrong candidate engine identity') } : validate
  const outcome = await superviseWorker({ url: workerUrl, data: mode === 'oversized' || mode === 'wrong-identity' ? 'success' : mode, validate: validateAnswer, ...(mode === 'oversized' ? { maxReplyBytes: 2 } : {}) })
  expect(outcome.reaped).toBe(true)
  if (outcome.kind === 'complete') throw new Error('Invalid worker result accepted')
  const references = directory(), out = directory()
  const tiny = { ...dev, inputs: dev.inputs.filter(input => input.path.endsWith('/javascript/empty.js')), profiles: ['product'] as const }
  const identity = { revision: 'test-owned', implementationDigest: hash('test-owned'), packFiles: [], referenceOrigin: REFERENCE_ORIGIN, styleProjection: STYLE_PROJECTION }
  const execution: Execution = { schema: '010-native-wave-collection-1', split: 'development', identity, selectionSha256: tiny.selectionSha256, themes: tiny.themes,
    requests: materializeJsJsxRows(tiny).scopeRows.map(row => ({ row, state: { kind: outcome.kind, reason: outcome.reason, dispatched: outcome.dispatched, ownership: outcome.ownership } })), finished: true, interrupted: null, elapsedMs: 1 }
  const expectedExit = mode === 'throw' || mode === 'nonzero' ? 1 : 3
  const rendered = renderCollection(tiny, references, out, execution)
  expect(rendered.exitCode).toBe(expectedExit)
  writeFileSync(resolve(out, 'execution.json'), JSON.stringify(execution))
  writeFileSync(resolve(out, 'scope-rows.json'), JSON.stringify(rendered.rows, null, 2) + '\n')
  writeFileSync(resolve(out, 'theme-rows.tsv'), rendered.tsv)
  writeFileSync(resolve(out, 'REPORT.md'), rendered.report)
  expect(checkWaveFiles({ split: 'development', references, out }, tiny, identity)).toBe(expectedExit)
})
it.each(['SIGINT', 'SIGTERM'] as const)('preserves %s collection exits', signal => {
  const references = directory(), out = directory(), tiny = { ...dev, inputs: dev.inputs.filter(input => input.path.endsWith('/javascript/empty.js')), profiles: ['product'] as const }
  const identity = { revision: 'test-owned', implementationDigest: hash('test-owned'), packFiles: [], referenceOrigin: REFERENCE_ORIGIN, styleProjection: STYLE_PROJECTION }
  const execution: Execution = { schema: '010-native-wave-collection-1', split: 'development', identity, selectionSha256: tiny.selectionSha256, themes: tiny.themes,
    requests: materializeJsJsxRows(tiny).scopeRows.map(row => ({ row, state: { kind: 'canceled', reason: 'signal', dispatched: true, ownership: 'process-discarded' } })), finished: true, interrupted: signal, elapsedMs: 1 }
  expect(renderCollection(tiny, references, out, execution).exitCode).toBe(signal === 'SIGINT' ? 130 : 143)
})
