import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { harnessRoot } from './manifest.ts'
import { fixtures } from './registry.ts'
import type { FixtureSplit } from './types.ts'
import type { ReferenceProfileId } from '../schema.ts'
import { isReferenceProfile } from '../schema.ts'

const ROOT = 'fixtures/waves/010-js-jsx/'
const WAVE = 'manifest/waves/010-js-jsx-root.json'
const ADDITIONS = 'manifest/fixture-sources.010-js-jsx.json'
const LOCK = '7ca8c0ca9fc2cc29445ecead260a906693fafe62c52a55c55f40f6103312d2bd'
const EXTERNAL_TOOLS = new Set(['prepare-packet.py', 'validate-packet.py'])
const PROFILES = ['raw', 'raw:shiki-fork', 'shiki-api', 'product', 'product:warm']
const TRACKS = ['ordered-scope-path', 'resolved-style', 'metadata']
const FAILURE_CONDITIONS = ['missing', 'error', 'timeout', 'cancel', 'unsupported', 'missing-style', 'missing-metadata', 'invalid-source-identity', 'partial', 'empty-denominator-as-pass']
const THEME_HEADER = 'language\tfixture\tsplit\tprofile\ttheme\tstate\tutf16Units\tmeasurement\tnative\tcaptures\tvscode-ts'
const SCOPE_HEADER = 'language\tfixture\tsplit\tprofile\tstate\tutf16Units\tmeasurement\tnative\tcaptures\tvscode-ts'

export interface WaveInput {
  readonly id: string
  readonly languageId: 'javascript' | 'jsx'
  readonly split: FixtureSplit
  readonly path: string
  readonly sha256: string
  readonly utf16Units: number
  readonly storage: 'existing-repository' | 'wave-packet'
  readonly derivationFamilies: readonly string[]
}

export interface JsJsxIntake {
  readonly selectionSha256: string
  readonly validation?: { readonly selected: FixtureSplit; readonly deferred: FixtureSplit }
  readonly inputs: readonly WaveInput[]
  readonly profiles: readonly ReferenceProfileId[]
  readonly themes: readonly string[]
  readonly requiredTracks: readonly string[]
  readonly metadataAvailability: 'unavailable'
  readonly nonPassing: readonly string[]
}

export interface ScopeRequest {
  readonly key: string
  readonly fixture: string
  readonly language: WaveInput['languageId']
  readonly split: FixtureSplit
  readonly profile: ReferenceProfileId
  readonly state: 'fresh-full'
  readonly utf16Units: number
}

export interface ThemeRequest extends ScopeRequest {
  readonly theme: string
}

type Read = (path: string) => Uint8Array
const sha = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex')
const text = (data: Uint8Array): string => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
const need = (condition: unknown, message: string): void => { if (!condition) throw new Error(message) }
const same = (actual: unknown, expected: unknown, message: string): void => need(JSON.stringify(actual) === JSON.stringify(expected), message)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected an object')
  return value
}

function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected an array')
  return value
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Expected nonnegative integer')
  return value
}

function strings(value: unknown): readonly string[] { return array(value).map(string) }
function records(value: unknown): readonly Record<string, unknown>[] { return array(value).map(object) }
function json(read: Read, path: string): Record<string, unknown> { return object(JSON.parse(text(read(path)))) }

function safePath(path: string): void {
  need(path.length > 0 && path.split('/').every(part => part !== '' && part !== '.' && part !== '..') && !path.includes('\\'), 'Unsafe packet path')
}

function readHarness(path: string): Uint8Array {
  safePath(path)
  let parent = harnessRoot
  for (const part of path.split('/')) {
    parent = new URL(part, parent)
    need(!lstatSync(parent).isSymbolicLink(), 'Symlink packet asset')
    parent = new URL(parent.href + '/')
  }
  return readFileSync(new URL(path, harnessRoot))
}

function packetPath(path: string): string {
  safePath(path)
  if (path === WAVE) return WAVE
  if (path === 'manifest/fixture-sources.additions.json') return ADDITIONS
  return ROOT + path
}

function checkSelection(read: Read): void {
  const bytes = read(ROOT + 'selection-lock.json')
  need(sha(bytes) === LOCK, 'Changed frozen selection identity')
  const lock = object(JSON.parse(text(bytes)))
  for (const [path, digest] of Object.entries(object(lock.files))) {
    if (EXTERNAL_TOOLS.has(path)) continue
    need(sha(read(packetPath(path))) === string(digest), `Changed locked asset: ${path}`)
  }
}

function asset(row: Record<string, unknown>, read: Read, existing = false): string {
  const path = string(row.path)
  safePath(path)
  const data = read(existing ? path : packetPath(path))
  need(data.byteLength === integer(row.bytes) && sha(data) === string(row.sha256), 'Changed source/license/notice bytes')
  return text(data)
}

function parseInput(row: Record<string, unknown>, read: Read, existing: boolean): WaveInput {
  const languageId = row.languageId
  const split = row.split
  if (languageId !== 'javascript' && languageId !== 'jsx') throw new Error('Wrong language')
  if (split !== 'development' && split !== 'evaluation') throw new Error('Wrong split')
  const source = asset(row, read, existing)
  const utf16Units = integer(row.utf16Units)
  need(source.length === utf16Units, 'Changed full UTF-16 denominator')
  if (!existing) checkRegions(row, source)
  return {
    id: string(row.id), languageId, split, path: existing ? string(row.path) : packetPath(string(row.path)),
    sha256: string(row.sha256), utf16Units, storage: existing ? 'existing-repository' : 'wave-packet',
    derivationFamilies: strings(row.derivationFamilies),
  }
}

function checkRegions(row: Record<string, unknown>, source: string): void {
  same(row.roles, ['source-input'], 'Wrong source role')
  same(row.referenceState, 'not-requested', 'Invented reference completion')
  for (const region of records(row.unsupportedRegions)) {
    const from = integer(region.from), to = integer(region.to)
    need(from < to && to <= source.length && source.slice(from, to) === region.text, 'Unsupported region changed')
  }
  if (row.lane === 'line-limit') same(source.split('\n').slice(0, 3).map(line => line.length), [19999, 20000, 20001], 'Changed boundary control')
  if (row.lane === 'utf16') need(source.startsWith('\ufeff') && source.includes('\r\n') && /[\u{10000}-\u{10ffff}]/u.test(source) && !source.endsWith('\n'), 'Changed UTF-16 control')
  if (row.lane === 'recovery') need(source.length > 0 && row.mandatoryExact === true, 'Recovery excluded from denominator')
}

function checkOrigins(row: Record<string, unknown>, licenses: ReadonlySet<string>, read: Read): void {
  const refs = strings(row.licenseRefs)
  need(refs.length > 0 && refs.every(ref => licenses.has(ref)), 'Missing license closure')
  need(string(row.authorship).length > 0, 'Missing authorship')
  const evidencePaths = strings(row.derivationEvidence)
  need(evidencePaths.length > 0, 'Missing ancestry evidence')
  const evidence = evidencePaths.map(path => json(read, packetPath(path)))
  if (row.split !== 'evaluation') return
  const revision = string(row.revision)
  need(row.generated === false && /^[0-9a-f]{40}$/.test(revision), 'Unpinned/generated evaluation source')
  need(string(row.url).endsWith(`/${revision}/${string(row.upstreamPath)}`), 'Unpinned evaluation URL')
  const origins = strings(row.originCommits)
  const additions = evidence.filter(entry => Array.isArray(entry.files) && records(entry.files).some(file => file.status === 'added')).map(entry => string(entry.sha))
  need(origins.length > 0 && origins.every(origin => additions.includes(origin)), 'Missing origin addition')
  need(evidence.filter(entry => 'commits' in entry).every(entry => entry.pagination === null), 'Truncated ancestry')
}

function checkProvenance(wave: Record<string, unknown>, additions: Record<string, unknown>, inputs: readonly WaveInput[], read: Read): void {
  checkSplitDeclarations(wave, additions, inputs)
  const licenses = records(wave.licenses)
  const ids = licenseIds(wave)
  for (const row of licenses) { asset(row, read); JSON.parse(text(read(packetPath(string(row.noticeSurvey))))) }
  for (const row of records(wave.noticeAssets)) asset(row, read)
  for (const row of records(wave.fixtures)) checkOrigins(row, ids, read)
}

function checkPolicy(wave: Record<string, unknown>): void {
  same(wave.schema, 'tree-sitter-x/010-js-jsx-acquisition@1', 'Wrong wave schema')
  same(wave.publicIds, ['javascript', 'jsx'], 'Public roots changed')
  same(wave.rootScopes, { javascript: 'source.js', jsx: 'source.js.jsx' }, 'Root scopes changed')
  same(wave.profiles, PROFILES, 'Profile set changed')
  same(wave.states, ['fresh-full'], 'State expansion')
  const contract = object(wave.rowsContract)
  same(contract.requiredTracks, TRACKS, 'Mandatory track removed')
  same(contract.nonPassing, FAILURE_CONDITIONS, 'Failure condition promoted')
  need(contract.count === 8125 && contract.scopeDeduplicateThemes === true, 'Wrong row denominator')
  same(contract.emptySource, 'zero-unit-lifecycle-N/A; required output lifecycle still checked', 'Empty denominator passing')
  same(contract.recovery, 'nonempty scored; never discard for parse error', 'Recovery denominator removed')
  for (const profile of PROFILES) same(object(wave.referenceTrackAvailability)[profile], { 'ordered-scope-path': 'implemented-unmeasured', 'resolved-style': 'implemented-unmeasured', metadata: 'unavailable' }, 'Invented metadata availability')
  const prerequisite = object(wave.referenceMetadataPrerequisite)
  need(prerequisite.id === '010-reference-metadata' && prerequisite.status === 'unimplemented', 'Missing metadata prerequisite')
  same(prerequisite.affectedProfiles, PROFILES, 'Metadata profile drift')
  const plan = object(wave.referenceRequestPlan)
  need(plan.executeNow === false && plan.exactChildScopes === null, 'Invented child truth or execution')
  same(plan.initialCollectionTracks, TRACKS.slice(0, 2), 'Collection track drift')
  need(plan.metadataCollection === 'blocked-on-010-reference-metadata' && plan.combinedMandatoryAcceptance === 'non-passing-until-independent-metadata', 'Missing metadata promoted')
  const fence = object(wave.markdownFenceAdmission)
  need(fence.newLanguagesEnabled === false, 'Implicit fence expansion')
  same(fence.allowedUnchanged, ['json', 'typescript', 'tsx'], 'Fence defaults changed')
}

function checkInventory(wave: Record<string, unknown>, read: Read): void {
  const inventory = json(read, ROOT + 'inventory-accounting.json')
  const assets = json(read, 'manifest/assets.json')
  const structural = json(read, 'manifest/tree-sitter-languages.json')
  const publicIds = records(assets.grammars).filter(row => row.public === true).map(row => string(row.name)).sort()
  const ids = (key: string) => records(inventory[key]).map(row => string(row.id)).sort()
  same(ids('languages'), publicIds, 'Public inventory incomplete')
  same(ids('structuralRows'), records(structural.languages).map(row => string(row.id)).sort(), 'Structural inventory incomplete')
  same(ids('themes'), records(assets.themes).map(row => string(row.id)).sort(), 'Theme inventory incomplete')
  need(publicIds.length === 242 && ids('structuralRows').length === 23 && ids('themes').length === 65, 'Catalog denominator changed')
  same(records(wave.themes).map(row => row.asset), assets.themes, 'Theme asset identities changed')
  same(ids('unavailableInjectionDependencies'), ['jsdoc', 'phpdoc', 'regex'], 'Missing unavailable injection')
  for (const key of ['languages', 'structuralRows', 'themes']) need(records(inventory[key]).every(row => row.measurement === null), 'Invented catalog result')
  const parser = records(structural.languages).find(row => row.id === 'javascript')
  need(parser !== undefined, 'Missing parser identity')
  same(wave.parser, parser?.source, 'Parser source drift')
  same(wave.parserWasm, parser?.wasm, 'Parser artifact drift')
}

function checkPreserved(read: Read): void {
  const index = json(read, ROOT + 'evidence/preserved-repository-files.json')
  need(Object.keys(index).length === 227, 'Preserved inventory changed')
  for (const [path, value] of Object.entries(index)) {
    need(path.startsWith('test/highlight-compat/'), 'Invalid preserved path')
    const bytes = read(path.slice('test/highlight-compat/'.length))
    const identity = object(value)
    need(sha(bytes) === identity.sha256 && bytes.byteLength === identity.bytes, 'Preserved repository bytes changed')
  }
}

function profile(value: unknown): ReferenceProfileId {
  const name = string(value)
  if (!isReferenceProfile(name)) throw new Error('Invalid reference profile')
  return name
}

export function materializeJsJsxRows(intake = readJsJsxIntake()): { readonly themeRows: readonly ThemeRequest[]; readonly scopeRows: readonly ScopeRequest[] } {
  const scopeRows = intake.inputs.flatMap(input => intake.profiles.map(profile => ({
    key: JSON.stringify([input.languageId, input.id, profile, 'fresh-full']), fixture: input.id,
    language: input.languageId, split: input.split, profile, state: 'fresh-full' as const, utf16Units: input.utf16Units,
  })))
  const themeRows = scopeRows.flatMap(row => intake.themes.map(theme => ({ ...row, theme, key: JSON.stringify([row.key, theme]) })))
  return { scopeRows, themeRows }
}

function rowFields(row: ScopeRequest): readonly string[] {
  return [row.language, row.fixture, row.split, row.profile, row.state, String(row.utf16Units), row.utf16Units === 0 ? 'N/A-zero-unit-lifecycle' : 'unmeasured', 'unmeasured', row.language === 'javascript' ? 'unmeasured-outer-tree-only' : 'unsupported-unimplemented', 'N/A-language']
}

function checkRows(intake: JsJsxIntake, read: Read): void {
  const { themeRows, scopeRows } = materializeJsJsxRows(intake)
  need(themeRows.length === 8125 && scopeRows.length === 125 && new Set(scopeRows.map(row => row.key)).size === 125, 'Expected key completeness')
  const scope = SCOPE_HEADER + '\n' + scopeRows.map(row => rowFields(row).join('\t')).join('\n') + '\n'
  const theme = THEME_HEADER + '\n' + themeRows.map(row => {
    const fields = rowFields(row)
    return fields.slice(0, 4).concat([row.theme], fields.slice(4)).join('\t')
  }).join('\n') + '\n'
  same(text(read(ROOT + 'scope-requests.tsv')), scope, 'Missing/extra/wrong scope requests or denominators')
  same(text(read(ROOT + 'expected-rows.tsv')), theme, 'Missing/extra/wrong theme rows or denominators')
}

/** Offline source intake only. Does not import fixture code, collect references, or judge results. */
export function readJsJsxIntake(read: Read = readHarness): JsJsxIntake {
  checkSelection(read)
  const wave = json(read, WAVE)
  checkPolicy(wave)
  checkInventory(wave, read)
  const existing = records(wave.existingDevelopment)
  const selected = records(wave.fixtures)
  const inputs = existing.map(row => parseInput(row, read, true)).concat(selected.map(row => parseInput(row, read, false)))
  same(existing.map(row => row.id), fixtures.filter(fixture => fixture.languageId === 'javascript').map(fixture => fixture.id), 'Existing development membership changed')
  need(existing.length === 7 && selected.length === 18 && new Set(inputs.map(input => input.id)).size === 25, 'Wrong source membership')
  need(inputs.filter(input => input.split === 'development').length === 21 && inputs.filter(input => input.split === 'evaluation').length === 4, 'Split denominator changed')
  checkProvenance(wave, json(read, ADDITIONS), inputs, read)
  checkPreserved(read)
  const intake = intakeFrom(wave, inputs)
  checkRows(intake, read)
  return intake
}

/** Select before opening any source or provenance payload. The full offline API above stays strict. */
export function readJsJsxSplit(split: FixtureSplit, read: Read = readHarness): JsJsxIntake {
  need(split === 'development' || split === 'evaluation', 'Invalid split')
  const bytes = read(ROOT + 'selection-lock.json')
  need(sha(bytes) === LOCK, 'Changed frozen selection identity')
  const wave = json(read, WAVE), additions = json(read, ADDITIONS)
  checkPolicy(wave)
  checkInventory(wave, read)
  const existing = records(wave.existingDevelopment), selected = records(wave.fixtures)
  const declarations = existing.map(row => declaredInput(row, true)).concat(selected.map(row => declaredInput(row, false)))
  same(existing.map(row => row.id), fixtures.filter(fixture => fixture.languageId === 'javascript').map(fixture => fixture.id), 'Existing development membership changed')
  need(existing.length === 7 && selected.length === 18 && new Set(declarations.map(input => input.id)).size === 25, 'Wrong source membership')
  need(declarations.filter(input => input.split === 'development').length === 21 && declarations.filter(input => input.split === 'evaluation').length === 4, 'Split denominator changed')
  checkSplitDeclarations(wave, additions, declarations)
  const all = intakeFrom(wave, declarations)
  checkRows(all, read)
  checkSplitLocks(wave, object(JSON.parse(text(bytes))), split, read)
  const inputs = existing.filter(row => row.split === split).map(row => parseInput(row, read, true))
    .concat(selected.filter(row => row.split === split).map(row => parseInput(row, read, false)))
  const licenses = licenseIds(wave)
  for (const row of selected.filter(row => row.split === split)) checkOrigins(row, licenses, read)
  checkPreserved(read)
  return { ...intakeFrom(wave, inputs), validation: { selected: split, deferred: split === 'development' ? 'evaluation' : 'development' } }
}

function declaredInput(row: Record<string, unknown>, existing: boolean): WaveInput {
  const languageId = row.languageId, split = row.split
  if (languageId !== 'javascript' && languageId !== 'jsx') throw new Error('Wrong language')
  if (split !== 'development' && split !== 'evaluation') throw new Error('Wrong split')
  const path = string(row.path)
  safePath(path)
  return { id: string(row.id), languageId, split, path: existing ? path : packetPath(path), sha256: string(row.sha256),
    utf16Units: integer(row.utf16Units), storage: existing ? 'existing-repository' : 'wave-packet', derivationFamilies: strings(row.derivationFamilies) }
}

function intakeFrom(wave: Record<string, unknown>, inputs: readonly WaveInput[]): JsJsxIntake {
  return { selectionSha256: LOCK, inputs, profiles: array(wave.profiles).map(profile), themes: records(wave.themes).map(row => string(row.id)),
    requiredTracks: strings(object(wave.rowsContract).requiredTracks), metadataAvailability: 'unavailable', nonPassing: strings(object(wave.rowsContract).nonPassing) }
}

function checkSplitDeclarations(wave: Record<string, unknown>, additions: Record<string, unknown>, inputs: readonly WaveInput[]): void {
  licenseIds(wave)
  same(additions.files, wave.fixtures, 'Fixture addition closure')
  same(additions.licenses, wave.licenses, 'License addition closure')
  same(additions.noticeAssets, wave.noticeAssets, 'Notice addition closure')
  const selected = records(additions.sources).flatMap(source => {
    const members = strings(source.fileIds), splitMembers = new Set(inputs.filter(input => input.split === source.split).map(input => input.id))
    need(members.every(id => splitMembers.has(id)), 'Wrong addition split')
    return members
  })
  same(selected.toSorted(), records(wave.fixtures).map(row => string(row.id)).sort(), 'Addition membership closure')
  const development = new Set(inputs.filter(input => input.split === 'development').flatMap(input => input.derivationFamilies))
  need(inputs.filter(input => input.split === 'evaluation').every(input => input.derivationFamilies.every(family => !development.has(family))), 'Derivation family overlap')
  const nonempty = inputs.filter(input => input.utf16Units > 0).map(input => input.sha256)
  need(new Set(nonempty).size === nonempty.length, 'Duplicate nonempty source')
}

function checkSplitLocks(wave: Record<string, unknown>, lock: Record<string, unknown>, split: FixtureSplit, read: Read): void {
  const allowed = new Set(['expected-rows.tsv', 'scope-requests.tsv', 'inventory-accounting.json', 'evidence/preserved-repository-files.json', WAVE, 'manifest/fixture-sources.additions.json'])
  const selected = records(wave.fixtures).filter(row => row.split === split)
  const licenseIds = new Set(selected.flatMap(row => strings(row.licenseRefs)))
  for (const row of selected) { allowed.add(string(row.path)); strings(row.derivationEvidence).forEach(path => allowed.add(path)) }
  for (const row of records(wave.licenses).filter(row => licenseIds.has(string(row.licenseId)))) {
    allowed.add(string(row.path)); allowed.add(string(row.noticeSurvey))
  }
  for (const row of records(wave.noticeAssets).filter(row => string(row.path).startsWith(split + '/'))) allowed.add(string(row.path))
  const files = object(lock.files)
  for (const path of allowed) {
    if (path === 'scope-requests.tsv') continue // Independently checked against the complete fixed declarations.
    need(path in files && sha(read(packetPath(path))) === string(files[path]), `Changed locked asset: ${path}`)
  }
}

function licenseIds(wave: Record<string, unknown>): ReadonlySet<string> {
  const licenses = records(wave.licenses), ids = new Set(licenses.map(row => string(row.licenseId)))
  need(ids.size === 3 && licenses.length === 3, 'Missing/duplicate license')
  return ids
}
