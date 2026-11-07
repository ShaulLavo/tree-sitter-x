import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { checkWaveFiles, renderCollection, planWave, REFERENCE_ORIGIN, STYLE_PROJECTION, retainAnswer } from '../src/wave-collection.ts'
import type { Execution } from '../src/wave-collection.ts'
import { readJsJsxSplit } from '../src/fixtures/js-jsx-wave.ts'
import { parseWaveArgs } from '../src/cli/collect-wave.ts'
import { Component } from '../src/native/component.ts'
import { collectNativeWaveDocument } from '../src/native/wave-document.ts'
import { readWaveSource } from '../src/wave-collection.ts'
import { NativeTheme } from '../src/native/theme.ts'
import { PilotDocument } from '../src/native/owner.ts'
const owned: string[] = []
afterEach(() => { vi.restoreAllMocks(); for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }) })
const dev = readJsJsxSplit('development')
const intake = { ...dev, inputs: dev.inputs.filter(input => input.path.endsWith('/javascript/ordinary.js') || input.path.endsWith('/javascript/empty.js')) }
function control() {
  const root = mkdtempSync('/work/tmp/wave010-check-'); owned.push(root)
  writeFileSync(resolve(root, 'scope-rows.json'), '[]')
  const identity = { revision: 'test-owned', implementationDigest: 'a'.repeat(64), packFiles: [], referenceOrigin: REFERENCE_ORIGIN, styleProjection: STYLE_PROJECTION, retainAnswer }
  const execution: Execution = { schema: '010-native-wave-collection-1', split: 'development', identity, selectionSha256: intake.selectionSha256, themes: intake.themes,
    requests: planWave(intake).scopeRows.map(row => ({ row, state: { kind: 'timeout', reason: 'test-owned timeout', dispatched: true, ownership: 'process-discarded' } })), finished: true, interrupted: null, elapsedMs: 1 }
  const options = { split: 'development' as const, references: root, out: root }
  return { root, identity, execution, options }
}
it('checks failure accounting read-only without creating any native owner/runtime', () => {
  const current = control()
  // Reference and candidate output live in separate partitions, even in this tiny control.
  const references = mkdtempSync('/work/tmp/wave010-check-references-'); owned.push(references)
  writeFileSync(resolve(references, 'scope-rows.json'), '[]')
  current.options.references = references
  const rendered = renderCollection(intake, references, current.root, current.execution)
  writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify(current.execution))
  writeFileSync(resolve(current.root, 'scope-rows.json'), JSON.stringify(rendered.rows, null, 2) + '\n')
  writeFileSync(resolve(current.root, 'theme-rows.tsv'), rendered.tsv)
  writeFileSync(resolve(current.root, 'REPORT.md'), rendered.report)
  const before = readFileSync(resolve(current.root, 'scope-rows.json'))
  vi.spyOn(Component, 'load').mockImplementation(() => { throw new Error('Native runtime opened during check') })
  vi.spyOn(PilotDocument, 'open').mockImplementation(() => { throw new Error('Native owner opened during check') })
  expect(checkWaveFiles(current.options, intake, current.identity)).toBe(1)
  expect(readFileSync(resolve(current.root, 'scope-rows.json'))).toEqual(before)
  expect(rendered.rows).toHaveLength(10)
  expect(rendered.rows.flatMap(row => row.themes)).toHaveLength(650)
})
it.each(['rows', 'themes', 'report', 'identity', 'duplicate', 'unfinished'] as const)('rejects altered %s in retained check', mode => {
  const current = control(), references = mkdtempSync('/work/tmp/wave010-check-ref-'); owned.push(references)
  writeFileSync(resolve(references, 'scope-rows.json'), '[]'); current.options.references = references
  const rendered = renderCollection(intake, references, current.root, current.execution)
  writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify(current.execution))
  writeFileSync(resolve(current.root, 'scope-rows.json'), JSON.stringify(rendered.rows, null, 2) + '\n')
  writeFileSync(resolve(current.root, 'theme-rows.tsv'), rendered.tsv); writeFileSync(resolve(current.root, 'REPORT.md'), rendered.report)
  if (mode === 'rows') writeFileSync(resolve(current.root, 'scope-rows.json'), '[]')
  if (mode === 'themes') writeFileSync(resolve(current.root, 'theme-rows.tsv'), '')
  if (mode === 'report') writeFileSync(resolve(current.root, 'REPORT.md'), 'stale')
  if (mode === 'identity') writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify({ ...current.execution, identity: { ...current.identity, revision: 'wrong' } }))
  if (mode === 'duplicate') writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify({ ...current.execution, requests: current.execution.requests.concat([current.execution.requests[0]]) }))
  if (mode === 'unfinished') writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify({ ...current.execution, finished: false }))
  expect(() => checkWaveFiles(current.options, intake, current.identity)).toThrow()
})
it('requires explicit paths/split and rejects selectors, recollection, duplicate flags and missing values', () => {
  expect(parseWaveArgs(['--split', 'development', '--references', '/work/ref', '--out', '/work/out', '--check']).check).toBe(true)
  for (const args of [[], ['--split', 'all'], ['--theme', 'x'], ['--out'], ['--check', '--check'], ['--recollect']]) expect(() => parseWaveArgs(args)).toThrow()
})

it('rechecks a real partial-theme native document without invoking a native owner, compiler or worker', async () => {
  const current = control(), references = mkdtempSync('/work/tmp/wave010-check-real-ref-'); owned.push(references)
  writeFileSync(resolve(references, 'scope-rows.json'), '[]')
  const selected = dev.inputs.find(input => input.path.endsWith('/javascript/ordinary.js'))
  if (!selected) throw new Error('Missing DEV control')
  const tiny = { ...dev, inputs: [selected], profiles: ['product'] as const }
  const planned = planWave(tiny).scopeRows[0]
  const request = { row: planned, source: readWaveSource(selected), themes: tiny.themes, selectionSha256: tiny.selectionSha256 }
  const answer = await collectNativeWaveDocument(request, new AbortController().signal)
  expect(answer.kind).toBe('scopes-complete')
  if (answer.kind !== 'scopes-complete') throw new Error('Missing native scopes')
  expect(answer.themes.some(theme => theme.kind === 'failed')).toBe(true)
  mkdirSync(resolve(current.root, 'documents'))
  const state = retainAnswer(current.root, 0, answer, Buffer.byteLength(JSON.stringify(answer)))
  const execution: Execution = { ...current.execution, requests: [{ row: planned, state }] }
  const rendered = renderCollection(tiny, references, current.root, execution)
  writeFileSync(resolve(current.root, 'execution.json'), JSON.stringify(execution))
  writeFileSync(resolve(current.root, 'scope-rows.json'), JSON.stringify(rendered.rows, null, 2) + '\n')
  writeFileSync(resolve(current.root, 'theme-rows.tsv'), rendered.tsv); writeFileSync(resolve(current.root, 'REPORT.md'), rendered.report)
  const recordBefore = readFileSync(resolve(current.root, state.record))
  vi.spyOn(Component, 'load').mockImplementation(() => { throw new Error('Native runtime during check') })
  vi.spyOn(PilotDocument, 'open').mockImplementation(() => { throw new Error('Native owner during check') })
  vi.spyOn(NativeTheme, 'compile').mockImplementation(() => { throw new Error('Native compile during check') })
  expect(checkWaveFiles({ ...current.options, references }, tiny, current.identity)).toBe(1)
  expect(readFileSync(resolve(current.root, state.record))).toEqual(recordBefore)
})
