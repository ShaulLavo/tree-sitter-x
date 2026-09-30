import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CompleteResult, DocumentResult, ReferenceProfileId, SpanTriples, Style, StyleTrack } from './schema.ts'
import { REFERENCE_PROFILES } from './schema.ts'
import { parseResultText, serializeResult } from './serialize.ts'
import { canonicalStyle, styleKey, themeTrack } from './style.ts'
import { sweep } from './sweep.ts'
import { parseResult } from './validate.ts'

export const GOLDEN_ROOT: string = fileURLToPath(new URL('../goldens', import.meta.url))

export interface GoldenCase {
  readonly languageId: string
  readonly fixtureId: string
  readonly source: string
  readonly result: DocumentResult
}

export type GoldenProducer = () => AsyncIterable<GoldenCase> | Iterable<GoldenCase>

export type GoldenCheck = { readonly ok: true } | { readonly ok: false; readonly message: string }

export interface GoldenUpdate {
  readonly written: string[]
  readonly unchanged: string[]
  readonly removed: string[]
}

const FIXTURE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export function isReferenceProfile(profileId: string): profileId is ReferenceProfileId {
  return REFERENCE_PROFILES.some((reference) => reference === profileId)
}

export function referenceRefusal(profileId: string): string {
  return `golden update accepts reference profiles only (${REFERENCE_PROFILES.join(', ')}); refusing ${JSON.stringify(profileId)}`
}

export function goldenPath(root: string, profileId: string, languageId: string, fixtureId: string): string {
  const bad = fixtureId.split('/').find((segment) => !FIXTURE_SEGMENT.test(segment))
  if (bad !== undefined) throw new Error(`fixture id ${JSON.stringify(fixtureId)}: segment ${JSON.stringify(bad)} does not match ${FIXTURE_SEGMENT}`)
  return join(root, profileId, languageId, `${fixtureId}.json`)
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export function checkGolden(root: string, golden: GoldenCase): GoldenCheck {
  const { profileId } = golden.result
  const path = goldenPath(root, profileId, golden.languageId, golden.fixtureId)
  if (!existsSync(path)) {
    return { ok: false, message: `missing golden ${path}; run \`npm run golden:update -- --profile ${profileId}\`` }
  }
  const text = readFileSync(path, 'utf8')
  let expected: DocumentResult
  let actual: DocumentResult
  try {
    expected = parseResultText(text)
  } catch (error) {
    return { ok: false, message: `${path}: ${messageOf(error)}` }
  }
  try {
    actual = parseResult(golden.result, golden.source)
  } catch (error) {
    return { ok: false, message: `${path}: produced ${messageOf(error)}` }
  }
  if (serializeResult(expected) !== text) {
    return { ok: false, message: `${path}: golden is not canonical; regenerate it with \`npm run golden:update -- --profile ${profileId}\`` }
  }
  if (serializeResult(actual) === text) return { ok: true }
  return { ok: false, message: `${path}:\n${describeDifference(expected, actual).join('\n')}` }
}

interface Run {
  readonly from: number
  to: number
  readonly expected: number
  readonly actual: number
}

type TrackDifference =
  | { readonly kind: 'run'; readonly run: Run }
  | { readonly kind: 'boundary'; readonly at: number; readonly side: 'expected' | 'actual' }

/** The first run of intervals where `same` fails, else the first raw token boundary only one side has. */
function firstTrackDifference(a: SpanTriples, b: SpanTriples, same: (a: number, b: number) => boolean): TrackDifference | undefined {
  let run: Run | undefined
  let closed = false
  let boundary: TrackDifference | undefined
  sweep(a, b, (from, to, aValue, bValue, aStarts, bStarts) => {
    if (closed) return
    if (run !== undefined) {
      if (aValue === run.expected && bValue === run.actual) run.to = to
      else closed = true
      return
    }
    if (boundary === undefined && from > 0 && aStarts !== bStarts) {
      boundary = { kind: 'boundary', at: from, side: aStarts ? 'expected' : 'actual' }
    }
    if (!same(aValue, bValue)) run = { from, to, expected: aValue, actual: bValue }
  })
  if (run !== undefined) return { kind: 'run', run }
  return boundary
}

interface TrackValues<T> {
  readonly expected: readonly T[]
  readonly actual: readonly T[]
  readonly key: (value: T) => string
  readonly show: (value: T) => string
}

function describeTrack<T>(label: string, a: SpanTriples, b: SpanTriples, values: TrackValues<T>): string[] {
  const { expected, actual, key, show } = values
  const difference = firstTrackDifference(a, b, (x, y) => key(expected[x]) === key(actual[y]))
  if (difference === undefined) return []
  if (difference.kind === 'boundary') return [`${label}: raw token boundary at ${difference.at} in ${difference.side} only`]
  const { run } = difference
  return [`${label} [${run.from}, ${run.to}): expected ${show(expected[run.expected])}, actual ${show(actual[run.actual])}`]
}

const quoted = (text: string): string => JSON.stringify(text)

const decodePaths = (result: CompleteResult): string[] =>
  result.paths.map((path) => path.map((name) => result.scopeNames[name]).join(' '))

function describeMetadata(expected: CompleteResult, actual: CompleteResult): string[] {
  const a = expected.metadata
  const b = actual.metadata
  if (a === undefined && b === undefined) return []
  if (a === undefined || b === undefined) {
    return [`metadata: expected ${a === undefined ? 'absent' : 'present'}, actual ${b === undefined ? 'absent' : 'present'}`]
  }
  return describeTrack('metadata', a.spans, b.spans, { expected: a.languageIds, actual: b.languageIds, key: String, show: quoted })
}

function describeTheme(themeId: string, a: StyleTrack, b: StyleTrack): string[] {
  const show = (style: Style): string => JSON.stringify(canonicalStyle(style))
  return describeTrack(`styles.${themeId}`, a.spans, b.spans, { expected: a.styles, actual: b.styles, key: styleKey, show })
}

function describeStyles(expected: CompleteResult, actual: CompleteResult): string[] {
  const lines: string[] = []
  const themeIds = [...new Set([...Object.keys(expected.styles ?? {}), ...Object.keys(actual.styles ?? {})])].sort()
  for (const themeId of themeIds) {
    const aTrack = themeTrack(expected.styles, themeId)
    const bTrack = themeTrack(actual.styles, themeId)
    if (aTrack === undefined || bTrack === undefined) {
      lines.push(`styles: theme ${JSON.stringify(themeId)} in ${aTrack === undefined ? 'actual' : 'expected'} only`)
      continue
    }
    lines.push(...describeTheme(themeId, aTrack, bTrack))
  }
  return lines
}

const HEADER_FIELDS = ['profileId', 'languageId', 'sourceSha256', 'sourceLength', 'documentRevision', 'status'] as const

function describeHeader(expected: DocumentResult, actual: DocumentResult): string[] {
  const lines: string[] = []
  for (const key of HEADER_FIELDS) {
    if (expected[key] !== actual[key]) lines.push(`${key}: expected ${expected[key]}, actual ${actual[key]}`)
  }
  const diagnostics = [JSON.stringify(expected.diagnostics), JSON.stringify(actual.diagnostics)]
  if (diagnostics[0] !== diagnostics[1]) lines.push(`diagnostics: expected ${diagnostics[0]}, actual ${diagnostics[1]}`)
  const engines = [sortedJson(expected.engine), sortedJson(actual.engine)]
  if (engines[0] !== engines[1]) lines.push(`engine: expected ${engines[0]}, actual ${engines[1]}`)
  return lines
}

const sortedJson = (record: Readonly<Record<string, string>>): string =>
  JSON.stringify(Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]])))

function describeTracks(expected: CompleteResult, actual: CompleteResult): string[] {
  if (expected.sourceLength !== actual.sourceLength) return []
  const paths = { expected: decodePaths(expected), actual: decodePaths(actual), key: String, show: quoted }
  const scopes = describeTrack('scopes', expected.spans, actual.spans, paths)
  return [...scopes, ...describeMetadata(expected, actual), ...describeStyles(expected, actual)]
}

/** Human-readable lines naming each difference between two valid results; never empty when they serialize differently. */
export function describeDifference(expected: DocumentResult, actual: DocumentResult): string[] {
  const lines = describeHeader(expected, actual)
  if (expected.status === 'complete' && actual.status === 'complete') lines.push(...describeTracks(expected, actual))
  if (lines.length === 0 && serializeResult(expected) !== serializeResult(actual)) {
    lines.push('results serialize differently but no field-level difference was found')
  }
  return lines
}

function listJsonFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listJsonFiles(path))
    else if (entry.name.endsWith('.json')) files.push(path)
  }
  return files
}

/** Removes empty directories under and including `dir`; returns whether `dir` was removed. */
function pruneEmpty(dir: string): boolean {
  let empty = true
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !pruneEmpty(join(dir, entry.name))) empty = false
  }
  if (empty) rmdirSync(dir)
  return empty
}

interface Planned {
  readonly path: string
  readonly text: string
}

function planCase(root: string, profileId: ReferenceProfileId, golden: GoldenCase): Planned {
  const path = goldenPath(root, profileId, golden.languageId, golden.fixtureId)
  const result = parseResult(golden.result, golden.source)
  if (result.profileId !== profileId) throw new Error(`profileId ${JSON.stringify(result.profileId)} under --profile ${profileId}`)
  if (result.languageId !== golden.languageId) {
    throw new Error(`result languageId ${JSON.stringify(result.languageId)} differs from case languageId`)
  }
  if (result.status !== 'complete' && result.status !== 'unsupported') {
    throw new Error(`status ${result.status} is failed reference work and cannot become a golden`)
  }
  return { path, text: serializeResult(result) }
}

async function planAll(root: string, profileId: ReferenceProfileId, producer: GoldenProducer): Promise<Planned[]> {
  const planned = new Map<string, Planned>()
  const failures: string[] = []
  for await (const golden of producer()) {
    const label = `${golden.languageId}/${golden.fixtureId}`
    try {
      const plan = planCase(root, profileId, golden)
      if (planned.has(plan.path)) throw new Error('duplicate case')
      planned.set(plan.path, plan)
    } catch (error) {
      failures.push(`${label}: ${messageOf(error).replaceAll('\n', '\n    ')}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(`golden update for ${profileId} failed; nothing written:\n${failures.map((failure) => `  ${failure}`).join('\n')}`)
  }
  return [...planned.values()]
}

function writePlanned(plan: Planned): boolean {
  if (existsSync(plan.path) && readFileSync(plan.path, 'utf8') === plan.text) return false
  mkdirSync(dirname(plan.path), { recursive: true })
  writeFileSync(plan.path, plan.text)
  return true
}

/** The only golden writer. Validates every case before touching disk, then converges the profile directory to exactly those cases. */
export async function updateGoldens(root: string, profileId: string, producer: GoldenProducer): Promise<GoldenUpdate> {
  if (!isReferenceProfile(profileId)) throw new Error(referenceRefusal(profileId))
  const planned = await planAll(root, profileId, producer)
  const update: GoldenUpdate = { written: [], unchanged: [], removed: [] }
  for (const plan of planned) {
    if (writePlanned(plan)) update.written.push(plan.path)
    else update.unchanged.push(plan.path)
  }
  const profileDir = join(root, profileId)
  if (!existsSync(profileDir)) return update
  const keep = new Set(planned.map((plan) => plan.path))
  for (const path of listJsonFiles(profileDir)) {
    if (keep.has(path)) continue
    unlinkSync(path)
    update.removed.push(path)
  }
  pruneEmpty(profileDir)
  for (const paths of [update.written, update.unchanged, update.removed]) paths.sort()
  return update
}

/** Directories under `root` that are not a reference profile with a registered producer. */
export function unregisteredGoldenDirs(root: string, producers: Readonly<Partial<Record<ReferenceProfileId, GoldenProducer>>>): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !isReferenceProfile(name) || producers[name] === undefined)
    .sort()
}
