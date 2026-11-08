import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { loadAdmissionSuite } from '../src/oracles/theme-admission/load.ts'
import { ResultBuilder } from '../src/build.ts'
import { serializeResult } from '../src/serialize.ts'
import { loadLanguagePack } from '../src/native/packs.ts'
import { Component } from '../src/native/component.ts'
import { PilotDocument } from '../src/native/owner.ts'
import { NativeTheme } from '../src/native/theme.ts'
import { normalizeTheme, snapshotInput } from '../src/native/theme-input.ts'
import { acquireWaveTheme, parseNativeWaveAnswer } from '../src/native/wave-document.ts'
import type { NativeWaveAnswer, NativeWaveRequest, ThemeAttempt } from '../src/native/wave-document.ts'
import type { JsJsxIntake } from '../src/fixtures/js-jsx-wave.ts'
import { hash, list, object, planWave, renderCollection, retainAnswer, REFERENCE_ORIGIN, STYLE_PROJECTION } from '../src/wave-collection.ts'
import type { Execution } from '../src/wave-collection.ts'

const suite = loadAdmissionSuite(), controls = object(suite.transport)
const successes = list(controls.successes).map(object), locations = list(controls.validLocationUnion), malformed = list(controls.rejectedLocations)
const owned: string[] = []
afterAll(() => { vi.restoreAllMocks(); for (const path of owned.reverse()) rmSync(path, { recursive: true, force: true }) })
function directory(): string {
  const path = mkdtempSync(resolve(tmpdir(), 'theme-warning-'))
  owned.push(path)
  return path
}
let request: NativeWaveRequest, intake: JsJsxIntake, answer: NativeWaveAnswer, references: string
const sourceId = 'synthetic-theme-warning-empty'
beforeAll(async () => {
  const path = 'fixtures/original/json/empty.json'
  expect(readFileSync(new URL(`../${path}`, import.meta.url))).toHaveLength(0)
  const themes = ['light-plus'].concat(Array.from({ length: 64 }, (_, index) => `synthetic-failure-${index}`))
  intake = { selectionSha256: hash('synthetic-warning-transport'), inputs: [{ id: sourceId, languageId: 'javascript', split: 'development', path, sha256: hash(''), utf16Units: 0, storage: 'existing-repository', derivationFamilies: [] }],
    profiles: ['raw'], themes, requiredTracks: [], metadataAvailability: 'unavailable', nonPassing: [] }
  request = { row: planWave(intake).scopeRows[0], source: '', themes, selectionSha256: intake.selectionSha256 }
  const pack = await loadLanguagePack('javascript')
  try { answer = await syntheticAnswer(pack.engine) }
  finally { pack.dispose() }
  references = directory(); writeFileSync(resolve(references, 'scope-rows.json'), '[]')
  vi.spyOn(Component, 'load').mockImplementation(() => { throw new Error('Native load during warning transport') })
  vi.spyOn(PilotDocument, 'open').mockImplementation(() => { throw new Error('Native owner during warning transport') })
  vi.spyOn(NativeTheme, 'compile').mockImplementation(() => { throw new Error('Native compile during warning transport') })
})
async function syntheticAnswer(metadata: Readonly<Record<string, string>>): Promise<NativeWaveAnswer> {
  const acquired = await acquireWaveTheme('light-plus', 'raw')
  if (acquired.outcome.kind !== 'ok') throw new Error('Missing positive normalization control')
  const normalized = acquired.outcome.value
  const engine = { ...metadata, requestedProfile: 'raw', framing: 'identity-v1', styleProjection: STYLE_PROJECTION, selectionSha256: request.selectionSha256 }
  const document = new ResultBuilder({ profileId: 'native', languageId: 'javascript', engine }, '').complete()
  const complete: ThemeAttempt[] = [{ kind: 'complete', theme: 'light-plus', contentRevision: normalized.contentRevision, acquisitionRevision: normalized.acquisitionRevision,
    normalizedPacketDigest: normalized.normalizedPacketDigest, targetIdentity: normalized.targetIdentity, resourceDigest: acquired.resourceDigest, assetDigest: acquired.assetDigest, warnings: [] }]
  const themes = complete.concat(request.themes.slice(1).map(theme => ({ kind: 'failed', theme, outcome: { kind: 'canceled' }, warnings: [] })))
  const input: unknown = { kind: 'scopes-complete', rawFull: document, presented: document, themes, evidence: {
    requestedProfile: 'raw', framing: 'identity-v1', scopeIdentity: { owner: { epoch: 1, revision: 0, syntax: 0 }, work: { epoch: 1, revision: 0, syntax: 0, request: 1 }, generation: 1 },
    scopeFailure: null, rawFullDigest: hash(serializeResult(document)), nativePresentationDigests: { 'light-plus': hash('synthetic-empty') },
    selectionsAttempted: request.themes.length, normalizationAttempts: 1, retainedBytesAfterDispose: 0, allocations: { kind: 'observed', beforePack: 0, afterDispose: 0 }, cleanupErrors: [],
    observations: 'parse/classify/compile/resolve/peak-memory/scan-bytes unavailable; selections and normalization callbacks counted',
  } }
  return parseNativeWaveAnswer(input, request)
}
function withWarnings(status: unknown, warnings: unknown) {
  if (answer.kind !== 'scopes-complete') throw new Error('Missing synthetic scopes')
  return { ...answer, themes: answer.themes.map(theme => theme.kind === status ? { ...theme, warnings } : theme) }
}
function roundtrip(input: unknown): NativeWaveAnswer { return parseNativeWaveAnswer(JSON.parse(JSON.stringify(input)), request) }
function warningList(answer: NativeWaveAnswer, status: unknown): unknown {
  if (answer.kind !== 'scopes-complete') throw new Error('Missing synthetic attempts')
  return answer.themes.find(theme => theme.kind === status)?.warnings
}
function retain(parsed: NativeWaveAnswer) {
  const out = directory(); mkdirSync(resolve(out, 'documents'))
  const state = retainAnswer(out, 0, parsed, Buffer.byteLength(JSON.stringify(parsed)))
  const identity = { revision: 'synthetic-warning-test', implementationDigest: hash('synthetic-warning-test'), packFiles: [], referenceOrigin: REFERENCE_ORIGIN, styleProjection: STYLE_PROJECTION }
  const execution: Execution = { schema: '010-native-wave-collection-1', split: 'development', identity, selectionSha256: request.selectionSha256, themes: request.themes,
    requests: [{ row: request.row, state }], finished: true, interrupted: null, elapsedMs: 0 }
  return { out, state, execution }
}
it.each(successes)('preserves authored warning metadata for $status in live replies and actual retained readback', control => {
  const parsed = roundtrip(withWarnings(control.status, control.warnings))
  expect(warningList(parsed, control.status)).toEqual(control.expectedWarnings)
  const retained = retain(parsed), record = object(JSON.parse(readFileSync(resolve(retained.out, retained.state.record), 'utf8')))
  const attempt = list(record.themes).map(object).find(theme => theme.kind === control.status)
  expect(attempt?.warnings).toEqual(control.expectedWarnings)
  const bytes = readFileSync(resolve(retained.out, retained.state.record))
  const rendered = renderCollection(intake, references, retained.out, retained.execution)
  const summary = rendered.rows[0].themes.find(theme => theme.candidateTheme.kind === control.status)?.candidateTheme
  expect(summary && 'warningCount' in summary ? summary.warningCount : undefined).toBe(list(control.expectedWarnings).length)
  expect(readFileSync(resolve(retained.out, retained.state.record))).toEqual(bytes)
})
it.each(['complete', 'failed'])('preserves the complete existing Location union for %s and keeps absent shape identical', status => {
  const old = { kind: 'outside-score', resource: 'admission:/root', property: 'old' }
  const warnings: unknown[] = locations.map(location => ({ ...old, location }))
  warnings.push(old)
  const parsed = roundtrip(withWarnings(status, warnings))
  expect(warningList(parsed, status)).toEqual(warnings)
  const retained = retain(parsed)
  expect(() => renderCollection(intake, references, retained.out, retained.execution)).not.toThrow()
})
it.each(['complete', 'failed'])('rejects malformed present warning locations for %s at live reply and actual retained readback', status => {
  for (const location of malformed.concat([undefined, { kind: 'resource', resource: 'admission:/root', jsonPointer: 'colors/x', byteOffset: null }])) rejectLocation(status, location)
})
function rejectLocation(status: string, location: unknown): void {
  const warning = { kind: 'outside-score', resource: 'admission:/root', property: 'content', location }
  expect(() => parseNativeWaveAnswer(withWarnings(status, [warning]), request)).toThrow()
  const retained = retain(roundtrip(withWarnings(status, [])))
  const path = resolve(retained.out, retained.state.record), record = object(JSON.parse(readFileSync(path, 'utf8')))
  const theme = list(record.themes).map(object).find(theme => theme.kind === status)
  if (!theme) throw new Error('Missing retained test attempt')
  Object.assign(theme, { warnings: [{ ...warning, location: location === undefined ? null : location }] })
  const bytes = JSON.stringify(record); writeFileSync(path, bytes)
  const state = { ...retained.state, sha256: hash(bytes) }
  const execution = { ...retained.execution, requests: [{ row: request.row, state }] }
  expect(() => renderCollection(intake, references, retained.out, execution)).toThrow()
}

it.each(['a~/b', 'terminal.ansi~/b'])('preserves an actual %s schema failure in live replies and retained readback', key => {
  const bytes = new TextEncoder().encode(JSON.stringify({ colors: { [key]: 1 } }))
  const acquired = snapshotInput({ root: 'theme', edges: [], resources: [{ id: 'theme', format: 'json', bytes }] })
  if (acquired.kind !== 'ok' || answer.kind !== 'scopes-complete') throw new Error('Missing failure transport control')
  const outcome = normalizeTheme(acquired.value, 'raw', 'failure-transport-control')
  expect(outcome).toEqual({ kind: 'invalid', code: 'schema', location: { kind: 'resource', resource: 'theme', jsonPointer: `/colors/${key}`, byteOffset: null } })
  const payload = { ...answer, themes: answer.themes.map(theme => theme.kind === 'failed' ? { ...theme, outcome } : theme) }
  const parsed = roundtrip(payload)
  expect(parsed).toEqual(payload)
  const retained = retain(parsed), path = resolve(retained.out, retained.state.record)
  const record = object(JSON.parse(readFileSync(path, 'utf8')))
  expect(list(record.themes).map(object).find(theme => theme.kind === 'failed')?.outcome).toEqual(outcome)
  const original = readFileSync(path)
  expect(() => renderCollection(intake, references, retained.out, retained.execution)).not.toThrow()
  expect(readFileSync(path)).toEqual(original)
})
