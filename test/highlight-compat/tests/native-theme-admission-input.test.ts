import { createHash } from 'node:crypto'
import { expect, it, vi } from 'vitest'
import { loadAdmissionSuite } from '../src/oracles/theme-admission/load.ts'
import type { AdmissionFixture, Observation } from '../src/oracles/theme-admission/schema.ts'
import { normalizeTheme, normalizedPacket, snapshotInput } from '../src/native/theme-input.ts'
import type { AcquiredInput, InputLimits, OperationalFailure, Outcome, Profile } from '../src/native/theme-contract.ts'
import { NativeTheme } from '../src/native/theme.ts'
import { Component } from '../src/native/component.ts'
import { encodePathPacket } from '../src/native/theme-packet.ts'
import * as rawAdapter from '../src/oracles/raw.ts'
import * as productAdapter from '../src/oracles/product/theme.ts'
import { appliedStyle, namedStyle } from '../src/native/theme-projection.ts'

const suite = loadAdmissionSuite()
const target = JSON.stringify(suite.targets)
const profiles: readonly Profile[] = ['raw', 'product']
function value<T>(outcome: Outcome<T> | OperationalFailure): T {
  if (outcome.kind !== 'ok') throw new Error(JSON.stringify(outcome))
  return outcome.value
}
function acquired(fixture: AdmissionFixture): AcquiredInput {
  return { root: fixture.input.root, edges: fixture.input.edges, resources: fixture.input.resources.map(resource => ({
    id: resource.id, format: 'json', bytes: new TextEncoder().encode(resource.bytes),
  })) }
}
function input(document: unknown): AcquiredInput {
  return { root: 'theme', resources: [{ id: 'theme', format: 'json', bytes: new TextEncoder().encode(JSON.stringify(document)) }], edges: [] }
}
function normalize(document: unknown, profile: Profile = 'raw', options: Partial<InputLimits> = {}) {
  return normalizeTheme(value(snapshotInput(input(document))), profile, target, options)
}
function fixture(id: string): AdmissionFixture {
  const found = suite.fixtures.find(fixture => fixture.input.id === id)
  if (!found) throw new Error(`Missing admission fixture ${id}`)
  return found
}
function compare(theme: NativeTheme, profile: Profile, observation: Observation): void {
  const paths = value(encodePathPacket([observation.scopes]))
  const effective = value(theme.resolve(paths))[paths.ids[0]]
  expect(namedStyle(effective)).toEqual(observation.effective)
  expect(appliedStyle(profile, effective)).toEqual(observation.applied)
  const prefixes = value(encodePathPacket(observation.scopes.map((_, index) => observation.scopes.slice(0, index + 1))))
  for (const [index, trace] of observation.trace.entries()) {
    const partial = value(theme.match(prefixes, prefixes.ids[index])).style
    expect(partial.fontMask).toEqual(trace.partial.fontMask)
    expect(partial.foreground).toEqual(field(trace.partial.foreground))
    expect(partial.background).toEqual(field(trace.partial.background))
  }
}
function field(value: Observation['trace'][number]['partial']['foreground']) {
  return value.kind === 'inherit' ? value : { kind: 'set', value: parseInt(value.value.slice(1), 16) }
}

it('pins the corrected independent supplement and authored admission authority', () => {
  expect(suite.identity).toBe('52c35e0d87980332373dc0924f2f2faaa3fdb2b661daef06ba3eb1569c41c931')
  expect(suite.fixtures).toHaveLength(132)
  expect(new Set(suite.fixtures.map(fixture => fixture.input.contract.authority))).toEqual(new Set(['authored-design-010-parent-amendment/2026-11-08']))
})

it.each(suite.fixtures)('matches authored admission and independent native style/presence observations for $input.id', async fixture => {
  const expected = fixture.input.contract.admission
  for (const profile of profiles) await compareFixture(fixture, profile, expected)
})
async function compareFixture(fixture: AdmissionFixture, profile: Profile, expected: AdmissionFixture['input']['contract']['admission']): Promise<void> {
  const normalized = normalizeTheme(value(snapshotInput(acquired(fixture))), profile, target)
  if (expected.kind !== 'ok') { expect(normalized).toEqual(expected); return }
  expect(normalized.kind).toBe('ok')
  if (normalized.kind !== 'ok') throw new Error(JSON.stringify(normalized))
  expect(normalized.warnings).toEqual(expected.warnings)
  const reference = fixture.attempts.find(attempt => attempt.profile === profile && attempt.view === 'full')?.result
  if (reference?.kind !== 'observed') throw new Error('Missing independent observation')
  const component = await Component.load(), baseline = component.liveAllocations()
  const theme = value(await NativeTheme.compile(normalized.value))
  try { for (const observation of reference.cases) compare(theme, profile, observation) }
  finally { theme.dispose() }
  expect(component.liveAllocations()).toBe(baseline)
}

function ruleWords(packet: Uint8Array): readonly number[][] {
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength), offset = view.getUint32(16, true), count = view.getUint32(12, true)
  return Array.from({ length: count }, (_, index) => Array.from({ length: 9 }, (_, word) => view.getUint32(offset + index * 36 + word * 4, true)))
}
it.each(profiles)('keeps selected property-only alternatives, normalized ordinals and budgets in %s', profile => {
  const document = { settings: [{ scope: ['a b', 'c b'], settings: { content: 'only' } }], tokenColors: [{ scope: '*', settings: { content: 'unselected' } }] }
  const normalized = value(normalize(document, profile))
  const words = ruleWords(normalizedPacket(normalized))
  expect(words).toHaveLength(3)
  expect(words.slice(1).map(rule => rule.slice(3, 6))).toEqual([[1, 0, 0], [1, 1, 0]])
  for (const [options, code] of bounded) checkBound(document, profile, options, code)
  expect(normalize(document, profile, { rules: 3, atoms: 3, contextEdges: 2, contextAtomsPerSelector: 1, atomBytes: 1 })).toMatchObject({ kind: 'ok' })
  const packetBytes = normalizedPacket(normalized).length
  expect(normalize(document, profile, { packetBytes })).toMatchObject({ kind: 'ok' })
  expect(normalize(document, profile, { packetBytes: packetBytes - 1 })).toMatchObject({ kind: 'budget', code: 'packet-bytes', limit: packetBytes - 1 })
  expect(normalize({ settings: [], tokenColors: document.tokenColors }, profile, { rules: 1, atoms: 0, contextEdges: 0 })).toMatchObject({ kind: 'ok' })
})
const bounded = [
  [{ rules: 0 }, 'rules'], [{ rules: 2 }, 'rules'], [{ atoms: 0 }, 'atoms'], [{ atoms: 2 }, 'atoms'],
  [{ contextEdges: 0 }, 'context-edges'], [{ contextEdges: 1 }, 'context-edges'],
  [{ contextAtomsPerSelector: 0 }, 'context-atoms'], [{ atomBytes: 0 }, 'atom-bytes'], [{ packetBytes: 0 }, 'packet-bytes'],
] satisfies readonly [Partial<InputLimits>, string][]
function checkBound(document: unknown, profile: Profile, options: Partial<InputLimits>, code: string): void {
  expect(normalize(document, profile, options)).toEqual({ kind: 'budget', code, limit: Object.values(options)[0], location: { kind: 'request' } })
}

it('charges every acquired UI/auxiliary byte before projection, including the four MiB boundary', () => {
  const empty = input({ colors: { 'a~/b': null }, tokenColors: [{ settings: { content: '' } }] })
  const padding = 4 * 1024 * 1024 - empty.resources[0].bytes.length
  const exact = input({ colors: { 'a~/b': null }, tokenColors: [{ settings: { content: 'x'.repeat(padding) } }] })
  expect(exact.resources[0].bytes.length).toBe(4 * 1024 * 1024)
  const snapshot = value(snapshotInput(exact))
  expect(normalizeTheme(snapshot, 'product', target)).toMatchObject({ kind: 'ok' })
  expect(normalizeTheme(snapshot, 'product', target, { inputBytes: exact.resources[0].bytes.length - 1 })).toMatchObject({ kind: 'budget', code: 'input-bytes' })
  const over = { ...exact, resources: exact.resources.map(resource => ({ ...resource, bytes: Buffer.concat([resource.bytes, Buffer.from(' ')]) })) }
  expect(snapshotInput(over)).toMatchObject({ kind: 'budget', code: 'input-bytes', limit: 4 * 1024 * 1024 })
})

it('preserves warning encounter order across arrays, properties and old location-less warnings', () => {
  const result = normalize({ settings: [{ settings: { 'text-decoration': '', content: '', '-webkit-font-smoothing': '' } }],
    tokenColors: [{ settings: { content: '' } }], semanticHighlighting: true, colors: { 'a~/b': null, old: 'var(--x)' } })
  expect(result.kind).toBe('ok')
  if (result.kind !== 'ok') throw new Error('Admission failed')
  expect(result.warnings.map(warning => warning.property)).toEqual(['text-decoration', 'content', '-webkit-font-smoothing', 'content', 'semanticHighlighting', 'colors/a~/b', 'colors/old'])
  expect(result.warnings[4]).toEqual({ kind: 'outside-score', resource: 'theme', property: 'semanticHighlighting' })
  expect(result.warnings[6]).toEqual({ kind: 'outside-score', resource: 'theme', property: 'colors/old' })
  expect(JSON.stringify(result.warnings)).not.toContain('<normalized>')
})

it.each(['\u00a0italic', 'italic\u00a0', ' \u00a0italic ', '\u2028italic', '\u0085', 'bold\titalic', 'bold\nitalic'])('does not collapse non-ASCII/control font spelling %j', fontStyle => {
  const expected = fontStyle === '\u0085' ? 'unsupported' : 'invalid'
  expect(normalize({ tokenColors: [{ settings: { fontStyle } }] })).toMatchObject({ kind: expected, code: 'font-style' })
})

it.each(['editor.foreground', 'editor.background', 'terminal.ansi', 'terminal.ansiBogus'])('never projects consumed nonstring key %s', key => {
  for (const entry of [null, [], ['#fff'], false, {}, 1]) expect(normalize({ colors: { [key]: entry } })).toEqual({ kind: 'invalid', code: 'schema', location: { kind: 'resource', resource: 'theme', jsonPointer: `/colors/${key}`, byteOffset: null } })
})
it.each(['a,', 'a  b', 'a\tb', '*', 'a | b', 'a & b', '(a)', 'L:a', 'a - b', 'a.__proto__'])('does not exempt auxiliary-only selector %j', scope => {
  const result = normalize({ tokenColors: [{ scope, settings: { content: '' } }] })
  expect(result.kind).not.toBe('ok')
  if (result.kind === 'ok') throw new Error('Unsupported selector admitted')
  expect(result).toMatchObject({ location: { kind: 'setting', resource: 'theme', rule: 0, alternative: 0, property: 'scope' } })
})

function digest(domain: string, fields: readonly (string | Uint8Array)[]): string {
  const hash = createHash('sha256')
  const all: readonly (string | Uint8Array)[] = [domain]
  for (const field of all.concat(fields)) {
    const bytes = typeof field === 'string' ? Buffer.from(field) : field
    const length = Buffer.alloc(4); length.writeUInt32LE(bytes.length)
    hash.update(length); hash.update(bytes)
  }
  return hash.digest('hex')
}
it('rekeys the global normalized domain while preserving acquisition and packet domains and defensive ownership', () => {
  const source = acquired(fixture('included-both-arrays-content'))
  const snapshot = value(snapshotInput(source)), normalized = value(normalizeTheme(snapshot, 'raw', target))
  const packet = normalizedPacket(normalized)
  const acquisitionFields: (string | Uint8Array)[] = [source.root]
  const resources = source.resources.flatMap(resource => [resource.id, resource.bytes])
  const edges = source.edges.flatMap(edge => [edge.from, edge.to, String(edge.ordinal)])
  expect(snapshot.acquisitionRevision).toBe(digest('scope-compat/acquisition-1', acquisitionFields.concat(resources, edges)))
  expect(normalized.normalizedPacketDigest).toBe(digest('scope-compat/theme-packet-1', [packet]))
  const fields = [snapshot.acquisitionRevision, 'raw', target, 'base-first-1', packet]
  expect(normalized.contentRevision).toBe(digest('scope-compat/normalized-theme-2', fields))
  expect(normalized.contentRevision).not.toBe(digest('scope-compat/normalized-theme-1', fields))
  source.resources[0].bytes.fill(32); packet.fill(0)
  expect(normalizedPacket(value(normalizeTheme(snapshot, 'raw', target)))).toEqual(normalizedPacket(normalized))
  const alias = value(normalizeTheme(value(snapshotInput(acquired(fixture('included-byte-alias')))), 'raw', target))
  expect(alias.acquisitionRevision).not.toBe(normalized.acquisitionRevision)
  expect(alias.contentRevision).not.toBe(normalized.contentRevision)
  expect(normalizedPacket(alias)).toEqual(normalizedPacket(normalized))
  expect(value(normalizeTheme(snapshot, 'raw', target + '2')).contentRevision).not.toBe(normalized.contentRevision)
  expect(value(normalizeTheme(snapshot, 'product', target)).contentRevision).not.toBe(normalized.contentRevision)
})

it.each(['foreground', 'background'])('keeps raw palette spelling accounting for superseded and transparent %s', property => {
  const colors = { 'editor.foreground': '#000000', 'editor.background': '#ffffff' }
  const tokenColors = Array.from({ length: 252 }, (_, index) => ({ scope: 'same', settings: { [property]: `#${(index + 1).toString(16).padStart(6, '0')}` } }))
  const exact = tokenColors.concat([{ scope: 'same', settings: { [property]: '#0000', content: 'last' } }])
  expect(normalize({ colors, tokenColors: exact })).toMatchObject({ kind: 'ok' })
  const over = exact.concat([{ scope: 'unreached', settings: { [property]: '#00000000' } }])
  expect(normalize({ colors, tokenColors: over })).toMatchObject({ kind: 'unsupported', code: 'raw-palette' })
  expect(normalize({ colors, tokenColors: over }, 'product')).toMatchObject({ kind: 'ok' })
})

it.each(profiles)('forwards original admitted font/auxiliary strings and only the proved UI projection to %s', profile => {
  const raw = vi.spyOn(rawAdapter, 'vscodeRawTheme'), product = vi.spyOn(productAdapter, 'workerThemeRegistration')
  const settings = { content: 'synthetic', 'text-decoration': 'underline', '-webkit-font-smoothing': 'antialiased', fontStyle: ' normal  italic ', foreground: '#0000' }
  try {
    expect(normalize({ tokenColors: [{ scope: 'variable', settings }], colors: { nullable: null, list: ['red', ''], empty: [], string: 'var(--synthetic)' } }, profile)).toMatchObject({ kind: 'ok' })
    const forwarded = profile === 'raw' ? raw.mock.calls.at(-1)?.[0] : product.mock.calls.at(-1)?.[0]
    expect(forwarded?.settings).toEqual([{ scope: 'variable', settings }])
    expect(forwarded?.colors).toEqual({ string: 'var(--synthetic)' })
  } finally { raw.mockRestore(); product.mockRestore() }
})
