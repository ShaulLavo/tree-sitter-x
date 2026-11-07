import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, gunzipSync } from 'node:zlib'
import { isDeepStrictEqual } from 'node:util'
import { Worker } from 'node:worker_threads'
import { materializeJsJsxRows, readJsJsxSplit } from './fixtures/js-jsx-wave.ts'
import type { JsJsxIntake, ScopeRequest, WaveInput } from './fixtures/js-jsx-wave.ts'
import { harnessRoot } from './fixtures/manifest.ts'
import type { FixtureSplit } from './fixtures/types.ts'
import type { CompleteResult, DocumentResult, Style } from './schema.ts'
import { ResultBuilder } from './build.ts'
import { parseResult } from './validate.ts'
import { serializeResult } from './serialize.ts'
import { compareResults } from './compare.ts'
import type { Agreement } from './compare.ts'
import { isWhitespaceUnit } from './source.ts'
import { PINS, pinLabel } from './oracles/pins.ts'
import { resolvedStyle } from './oracles/resolved-style.ts'
import type { StyleRun } from './native/theme-cache.ts'
import type { NativeWaveRequest } from './native/wave-document.ts'
import { parseNativeWaveAnswer } from './native/wave-document.ts'

export const WAVE_LIMIT = 64 * 1024 * 1024
export const REFERENCE_ORIGIN = '6596764466d455bfcedfb82b67f35ca3bc168512'
export const STYLE_PROJECTION = 'harness-resolved-style-v1;comparison-opaque-rgba-v1'
const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const WORKER_URL = new URL('./native/wave-worker.ts', import.meta.url)
const PACKS: Readonly<Record<string, string>> = {
  'javascript/javascript.scm': '7bd77e696f9cdb014839835a5321752d21ad432efcc958b97866a347d0dcc0e3',
  'javascript/pack.json': 'e41bbf21860722954cedaa62833c8a5d67772e532e54719b17d285a8bbaac09f',
  'jsx/jsx.scm': '0d3668b77fe2607bff63d835c61f390dce6ca856edd67825bc333994692ddcfd',
  'jsx/pack.json': 'ff97d18ff6dd0f7bfe8e06b2c4a81a4915c522b3d77cb4816d480e0a75847ada',
  'shared/javascript-common.scm': 'ef69cf83165e0bc39ca18ae2ece03fccdfc6bf948c3a086842665cf9ff5a4dfb',
}
export const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
export function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
export function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error('Expected object')
  return value
}
export function string(value: unknown): string { need(typeof value === 'string', 'Expected string'); return value }
export function list(value: unknown): unknown[] { need(Array.isArray(value), 'Expected array'); return value }
export const diagnostic = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 1024)
export function unique(values: readonly string[], label: string): void { need(new Set(values).size === values.length, `Duplicate ${label}`) }
export function same(actual: unknown, expected: unknown, message: string): void { need(JSON.stringify(actual) === JSON.stringify(expected), message) }

/** Every path component, including the selected root, must be a real directory/file. */
export function safeFile(root: string, path: string): string {
  need(path.length > 0 && !isAbsolute(path) && !path.includes('\\') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'Unsafe relative path')
  const absoluteRoot = resolve(root), target = resolve(absoluteRoot, path)
  need(!relative(absoluteRoot, target).startsWith('..' + sep), 'Path escapes partition')
  let cursor = resolve('/')
  for (const part of target.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part)
    need(!lstatSync(cursor).isSymbolicLink(), 'Symlink path rejected')
  }
  return target
}
function safeDirectory(path: string): void {
  let cursor = resolve('/')
  for (const part of resolve(path).split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part)
    need(!lstatSync(cursor).isSymbolicLink() && lstatSync(cursor).isDirectory(), 'Symlink/non-directory output path')
  }
}
export function boundedRead(path: string): Buffer {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const stat = fstatSync(fd)
    need(stat.isFile() && stat.size <= WAVE_LIMIT, 'Transport budget: retained file exceeds 64 MiB or is not regular')
    const bytes = Buffer.alloc(stat.size + 1)
    let offset = 0, read = 0
    do { read = readSync(fd, bytes, offset, bytes.length - offset, null); offset += read } while (read && offset < bytes.length)
    need(offset === stat.size, 'Retained file size changed during bounded read')
    return bytes.subarray(0, offset)
  } finally { closeSync(fd) }
}
function jsonFile(path: string): unknown { return JSON.parse(boundedRead(path).toString('utf8')) }
export function readWaveSource(input: WaveInput): string {
  const bytes = boundedRead(safeFile(fileURLToPath(harnessRoot), input.path))
  need(hash(bytes) === input.sha256, 'Source hash changed')
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  need(source.length === input.utf16Units, 'Source UTF-16 length changed')
  return source
}
export function planWave(intake: JsJsxIntake) {
  const rows = materializeJsJsxRows(intake)
  unique(rows.scopeRows.map(row => row.key), 'scope key')
  unique(rows.themeRows.map(row => row.key), 'theme key')
  unique(intake.themes, 'theme')
  need(intake.themes.length === 65, 'Locked theme count changed')
  return rows
}
export function nativeResolvedStyle(style: StyleRun['style']): Style {
  if (!('fontMask' in style) || typeof style.fontMask !== 'number' || typeof style.foreground !== 'string') return {}
  return resolvedStyle(style.foreground, style.fontMask)
}
function opaque(color: string): string { return color.replace(/^(#[0-9a-f]{6})ff$/i, '$1') }
function comparisonStyle(style: Style): Style {
  return { ...style, ...(style.foreground === undefined ? {} : { foreground: opaque(style.foreground) }),
    ...(style.background === undefined ? {} : { background: opaque(style.background) }) }
}
export function comparisonView(result: DocumentResult, source: string): DocumentResult {
  parseResult(result, source)
  if (result.status !== 'complete') return result
  const builder = new ResultBuilder(result, source)
  copyScopes(builder, result)
  for (const [theme, track] of Object.entries(result.styles ?? {})) {
    for (let i = 0; i < track.spans.length; i += 3) builder.style(theme, track.spans[i], track.spans[i + 1], comparisonStyle(track.styles[track.spans[i + 2]]))
  }
  return builder.complete()
}
function copyScopes(builder: ResultBuilder, result: CompleteResult): void {
  for (let i = 0; i < result.spans.length; i += 3) builder.scope(result.spans[i], result.spans[i + 1], result.paths[result.spans[i + 2]].map(id => result.scopeNames[id]))
}

export type InputDocument = { readonly kind: 'valid'; readonly result: DocumentResult; readonly sha256?: string; readonly bytes?: number }
  | { readonly kind: 'missing' | 'invalid'; readonly reason: string }
export type TrackRow = { readonly kind: 'compared'; readonly units: number; readonly nonWhitespace: number; readonly matching: number; readonly matchingNonWhitespace: number }
  | { readonly kind: 'n/a-empty'; readonly units: 0; readonly nonWhitespace: 0 }
  | { readonly kind: 'not-compared'; readonly units: number; readonly nonWhitespace: number; readonly reason: string }
export interface ReconciledRow {
  readonly key: string
  readonly reference: string
  readonly candidate: string
  readonly scopes: TrackRow
  readonly metadata: TrackRow
  readonly themes: readonly { readonly key: string; readonly theme: string; readonly styles: TrackRow; readonly metadata: TrackRow }[]
  readonly accepted: boolean
}
function nonWhitespace(source: string): number {
  let count = 0
  for (let i = 0; i < source.length; i++) if (!isWhitespaceUnit(source.charCodeAt(i))) count++
  return count
}
interface SourceUnits { readonly units: number; readonly nonWhitespace: number }
function unobserved(units: SourceUnits, reason: string): TrackRow { return { kind: 'not-compared', ...units, reason } }
function measured(units: SourceUnits, agreement: Agreement): TrackRow {
  if (!units.units) return { kind: 'n/a-empty', units: 0, nonWhitespace: 0 }
  return { kind: 'compared', ...units, matching: agreement.all.matching, matchingNonWhitespace: agreement.nonWhitespace?.matching ?? 0 }
}
function sideState(input: InputDocument): string { return input.kind === 'valid' ? input.result.status : `${input.kind}:${input.reason}` }
export function reconcileRequest(row: ScopeRequest, source: string, themes: readonly string[], reference: InputDocument, candidate: InputDocument): ReconciledRow {
  const units = { units: source.length, nonWhitespace: nonWhitespace(source) }
  const comparison = reference.kind === 'valid' && candidate.kind === 'valid'
    ? compareResults(comparisonView(reference.result, source), comparisonView(candidate.result, source), { source, maxRuns: 0 }) : undefined
  const scopes: TrackRow = !source.length ? { kind: 'n/a-empty', units: 0, nonWhitespace: 0 } : comparison?.comparable ? measured(units, comparison.scopes.agreement) : unobserved(units, 'scope inputs not comparable')
  const metadata: TrackRow = source.length ? unobserved(units, 'mandatory full-source JS/JSX metadata unavailable') : { kind: 'n/a-empty', units: 0, nonWhitespace: 0 }
  const themeRows = themes.map(theme => {
    const style = comparison?.comparable && Object.hasOwn(comparison.styles, theme) ? comparison.styles[theme] : undefined
    const styles: TrackRow = !source.length ? { kind: 'n/a-empty', units: 0, nonWhitespace: 0 } : style?.compared ? measured(units, style.report.agreement) : unobserved(units, style ? style.reason : 'missing-style on one or both sides')
    return { key: JSON.stringify([row.key, theme]), theme, styles, metadata }
  })
  const empty = !source.length && reference.kind === 'valid' && reference.result.status === 'complete' && candidate.kind === 'valid' && candidate.result.status === 'complete'
  return { key: row.key, reference: sideState(reference), candidate: sideState(candidate), scopes, metadata, themes: themeRows, accepted: empty }
}
function ratio(value: number, total: number): number | null { return total ? value / total : null }
function summary(rows: readonly TrackRow[], field: 'all' | 'nonWhitespace') {
  const units = (row: TrackRow) => field === 'all' ? row.units : row.nonWhitespace
  const matching = (row: Extract<TrackRow, { kind: 'compared' }>) => field === 'all' ? row.matching : row.matchingNonWhitespace
  const declared = rows.reduce((sum, row) => sum + units(row), 0)
  const compared = rows.filter((row): row is Extract<TrackRow, { kind: 'compared' }> => row.kind === 'compared' && units(row) > 0)
  const comparable = compared.reduce((sum, row) => sum + units(row), 0), matches = compared.reduce((sum, row) => sum + matching(row), 0)
  const macroSum = compared.reduce((sum, row) => sum + matching(row) / units(row), 0)
  return { declared, comparable, matching: matches, unobserved: declared - comparable, coverage: ratio(comparable, declared), conditionalMicro: ratio(matches, comparable), fixedMicro: ratio(matches, declared),
    conditionalMacro: ratio(macroSum, compared.length), fixedMacro: ratio(macroSum, rows.filter(row => units(row) > 0).length) }
}
export function summarizeTrack(rows: readonly TrackRow[]) { return { all: summary(rows, 'all'), nonWhitespace: summary(rows, 'nonWhitespace') } }

export interface SupervisorOptions<T> {
  readonly url: URL
  readonly data: unknown
  readonly validate: (value: unknown) => T
  readonly signal?: AbortSignal
  readonly deadlineMs?: number
  readonly exitGraceMs?: number
  readonly maxReplyBytes?: number
}
type WorkerFailure = 'error' | 'integrity' | 'timeout' | 'canceled'
export type Supervised<T> = { readonly kind: 'complete'; readonly value: T; readonly reaped: true; readonly dispatched: true; readonly replyBytes: number }
  | { readonly kind: WorkerFailure; readonly reason: string; readonly reaped: true; readonly dispatched: boolean; readonly ownership: 'not-created' | 'process-discarded' }
export function superviseWorker<T>(options: SupervisorOptions<T>): Promise<Supervised<T>> {
  if (options.signal?.aborted) return Promise.resolve({ kind: 'canceled', reason: 'abort before dispatch', reaped: true, dispatched: false, ownership: 'not-created' })
  return new WorkerSupervisor(options).start()
}
class WorkerSupervisor<T> {
  readonly #options: SupervisorOptions<T>
  readonly #promise: Promise<Supervised<T>>
  #resolve: (value: Supervised<T>) => void = () => { throw new Error('Supervisor not initialized') }
  #reject: (reason: unknown) => void = () => { throw new Error('Supervisor not initialized') }
  #worker: Worker | undefined
  #answer: T | undefined
  #replies = 0
  #replyBytes = 0
  #exited = false
  #failure: { kind: WorkerFailure; reason: string } | undefined
  #deadline: ReturnType<typeof setTimeout> | undefined
  #grace: ReturnType<typeof setTimeout> | undefined
  readonly #abort = () => this.stop('canceled', 'abort during work')
  constructor(options: SupervisorOptions<T>) {
    this.#options = options
    this.#promise = new Promise((pass, fail) => { this.#resolve = pass; this.#reject = fail })
  }
  start(): Promise<Supervised<T>> {
    const options = this.#options
    try { this.#worker = new Worker(options.url, { workerData: options.data }) }
    catch (error) { this.#resolve({ kind: 'error', reason: diagnostic(error), reaped: true, dispatched: false, ownership: 'not-created' }); return this.#promise }
    const deadline = options.deadlineMs ?? 60_000
    this.#deadline = setTimeout(() => this.stop('timeout', `${deadline} ms request deadline exceeded`), deadline)
    options.signal?.addEventListener('abort', this.#abort, { once: true })
    this.#worker.on('message', (value: unknown) => this.receive(value))
    this.#worker.on('error', error => this.stop('error', diagnostic(error)))
    this.#worker.once('exit', code => this.finish(code))
    return this.#promise
  }
  private stop(kind: WorkerFailure, reason: string): void {
    if (this.#exited || this.#failure) return
    this.#failure = { kind, reason }
    void this.#worker?.terminate().catch(this.#reject)
  }
  private receive(value: unknown): void {
    if (this.#exited || this.#failure) return
    try {
      need(++this.#replies === 1, 'Duplicate worker reply')
      this.#replyBytes = Buffer.byteLength(JSON.stringify(value))
      need(this.#replyBytes <= (this.#options.maxReplyBytes ?? WAVE_LIMIT), 'Transport budget: oversized worker reply')
      this.#answer = this.#options.validate(value)
      this.#grace = setTimeout(() => this.stop('error', 'Reply without clean exit within grace'), this.#options.exitGraceMs ?? 1000)
    } catch (error) { this.stop('integrity', diagnostic(error)) }
  }
  private finish(code: number): void {
    this.#exited = true; clearTimeout(this.#deadline); clearTimeout(this.#grace); this.#options.signal?.removeEventListener('abort', this.#abort)
    if (this.#failure) { this.#resolve({ ...this.#failure, reaped: true, dispatched: true, ownership: 'process-discarded' }); return }
    if (code !== 0 || this.#replies !== 1 || this.#answer === undefined) { this.#resolve({ kind: 'error', reason: `Worker exit ${code}; replies ${this.#replies}`, reaped: true, dispatched: true, ownership: 'process-discarded' }); return }
    this.#resolve({ kind: 'complete', value: this.#answer, reaped: true, dispatched: true, replyBytes: this.#replyBytes })
  }
}

export function validateDocumentIdentity(result: DocumentResult, row: ScopeRequest, input: WaveInput, candidate = false): void {
  need(result.languageId === row.language && result.profileId === (candidate ? 'native' : row.profile) && result.documentRevision === 0 && result.sourceSha256 === input.sha256 && result.sourceLength === input.utf16Units, 'Wrong source/language/profile/revision identity')
  need(result.status !== 'complete' || result.metadata === undefined, 'Unexpected initial JS/JSX metadata')
}
function referenceEngine(result: CompleteResult, row: ScopeRequest): void {
  const engine = result.engine, raw = row.profile === 'raw' || row.profile === 'raw:shiki-fork'
  const expected: Record<string, string> = { grammars: pinLabel(PINS.langs), themes: pinLabel(PINS.themes), textmate: pinLabel(row.profile === 'raw' ? PINS.vscodeTextmate : PINS.shikiTextmate), oniguruma: pinLabel(raw ? PINS.vscodeOniguruma : PINS.shikiOniguruma) }
  if (!raw) expected.shiki = pinLabel(PINS.shiki)
  if (row.profile === 'raw') expected.textmateCommit = PINS.vscodeTextmate.commit
  if (raw) { expected.onigurumaCommit = PINS.vscodeOniguruma.commit; expected.onigurumaWasmSha256 = PINS.vscodeOniguruma.wasmSha256 }
  if (row.profile === 'product' || row.profile === 'product:warm') {
    expected.adapter = `port of the Platform ${PINS.platformCommit} shiki tokenizer`
    expected.registration = row.profile === 'product' ? 'cold' : 'warm'; expected.maxLineLength = '20000'
    const product = object(jsonFile(fileURLToPath(new URL('../manifest/product-profile.json', import.meta.url))))
    expected.onigurumaWasmSha256 = string(object(object(product.engine).wasm).sha256)
  }
  if (row.profile === 'shiki-api') { expected.api = 'codeToTokensBase'; expected.options = 'includeExplanation=scopeName tokenizeMaxLineLength=20000 tokenizeTimeLimit=0' }
  for (const [key, value] of Object.entries(expected)) need(engine[key] === value, `Untrusted reference engine: ${key}`)
}
export function referenceIndex(directory: string, requests: readonly ScopeRequest[], inputs: readonly WaveInput[]): ReadonlyMap<string, Record<string, unknown>> {
  const entries = list(jsonFile(safeFile(directory, 'scope-rows.json'))), expected = new Map(requests.map(row => [row.key, row]))
  const byFixture = new Map(inputs.map(input => [input.id, input])), documents: string[] = [], mapped = new Map<string, Record<string, unknown>>()
  for (const value of entries) {
    const entry = object(value), key = JSON.stringify([entry.languageId, entry.fixtureId, entry.profileId, 'fresh-full'])
    const row = expected.get(key), input = byFixture.get(string(entry.fixtureId))
    need(row && input, 'Unexpected/cross-split reference row')
    need(!mapped.has(key), 'Duplicate reference key')
    need(entry.sourceSha256 === input.sha256 && entry.sourceLength === input.utf16Units && entry.documentRevision === 0, 'Wrong reference index identity')
    documents.push(string(entry.document)); mapped.set(key, entry)
  }
  unique(documents, 'reference document assignment')
  return mapped
}
export function loadReference(directory: string, entry: Record<string, unknown> | undefined, row: ScopeRequest, input: WaveInput, source: string, themes: readonly string[]): InputDocument {
  if (!entry) return { kind: 'missing', reason: 'reference index row missing' }
  try {
    const path = safeFile(directory, string(entry.document)), compressed = boundedRead(path)
    if (entry.documentSha256 !== undefined) need(entry.documentSha256 === hash(compressed), 'Reference inventory digest mismatch')
    const bytes = gunzipSync(compressed, { maxOutputLength: WAVE_LIMIT })
    const result = parseResult(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), source)
    validateDocumentIdentity(result, row, input)
    const scopes = { scopeNames: result.scopeNames, paths: result.paths, spans: result.spans }
    if (entry.scopeSha256 !== undefined) need(entry.scopeSha256 === hash(JSON.stringify(scopes)), 'Reference scope inventory digest mismatch')
    if (entry.styleSha256 !== undefined) need(entry.styleSha256 === hash(JSON.stringify(result.status === 'complete' ? result.styles ?? {} : {})), 'Reference style inventory digest mismatch')
    if (result.status === 'complete') {
      referenceEngine(result, row)
      same(Object.keys(result.styles ?? {}).sort(), source.length ? themes.toSorted() : [], 'Wrong reference theme membership')
    }
    return { kind: 'valid', result, sha256: hash(compressed), bytes: compressed.length }
  } catch (error) {
    const reason = diagnostic(error)
    return { kind: reason.includes('ENOENT') ? 'missing' : 'invalid', reason }
  }
}
export function parseWorkerRequest(value: unknown): NativeWaveRequest {
  const envelope = object(value), row = object(envelope.row), source = string(envelope.source)
  need(envelope.selectionSha256 === '7ca8c0ca9fc2cc29445ecead260a906693fafe62c52a55c55f40f6103312d2bd', 'Wrong selection identity')
  const language = row.language, split = row.split, profile = row.profile
  need(language === 'javascript' || language === 'jsx', 'Wrong native public root')
  need(split === 'development' || split === 'evaluation', 'Wrong native split')
  need(profile === 'raw' || profile === 'raw:shiki-fork' || profile === 'shiki-api' || profile === 'product' || profile === 'product:warm', 'Wrong native profile')
  need(row.state === 'fresh-full' && row.utf16Units === source.length, 'Wrong native state/denominator')
  const fixture = string(row.fixture), key = JSON.stringify([language, fixture, profile, 'fresh-full'])
  need(row.key === key, 'Wrong native request key')
  const wave = object(jsonFile(fileURLToPath(new URL('../manifest/waves/010-js-jsx-root.json', import.meta.url))))
  const selected = list(wave.existingDevelopment).concat(list(wave.fixtures)).map(object).find(input => input.id === fixture)
  need(selected && selected.languageId === language && selected.split === split && selected.utf16Units === source.length && selected.sha256 === hash(Buffer.from(source, 'utf8')), 'Wrong native source identity')
  const themes = list(envelope.themes).map(string)
  same(themes, list(wave.themes).map(value => object(value).id), 'Incomplete/wrong native theme request')
  return { row: { key, fixture, language, split, profile, state: 'fresh-full', utf16Units: source.length }, source, themes, selectionSha256: string(envelope.selectionSha256) }
}
export interface WaveCollectionOptions {
  readonly split: FixtureSplit
  readonly references: string
  readonly out: string
  readonly signal?: AbortSignal
}
function git(...args: string[]): string { return execFileSync('git', ['-C', ROOT].concat(args), { encoding: 'utf8' }).trim() }
export function collectionIdentity() {
  const packFiles = Object.entries(PACKS).map(([path, digest]) => {
    need(hash(readFileSync(resolve(ROOT, 'lib/scope-compat/packs', path))) === digest, 'Changed frozen pack bytes')
    return [path, digest]
  })
  const paths = ['test/highlight-compat/src', 'test/highlight-compat/package.json', 'test/highlight-compat/package-lock.json', 'lib/binding_web/src', 'lib/scope-compat/src', 'lib/scope-compat/include']
  const files = git('ls-files', '-z', '--', ...paths).split('\0').filter(Boolean)
  need(files.length > 0, 'Missing implementation inventory')
  need(!git('status', '--porcelain', '--untracked-files=all', '--', ...paths), 'Collection requires committed frozen implementation')
  const implementationDigest = hash(JSON.stringify(files.map(path => [path, hash(readFileSync(resolve(ROOT, path)))])))
  return { revision: git('rev-parse', 'HEAD'), implementationDigest, packFiles, referenceOrigin: REFERENCE_ORIGIN, styleProjection: STYLE_PROJECTION }
}
function atomic(path: string, value: string | Uint8Array): void {
  need((typeof value === 'string' ? Buffer.byteLength(value) : value.byteLength) <= WAVE_LIMIT, 'Transport budget: retained output exceeds 64 MiB')
  const temporary = `${path}.${process.pid}.tmp`
  try { writeFileSync(temporary, value, { flag: 'wx', mode: 0o600 }); renameSync(temporary, path) }
  finally { if (existsSync(temporary)) unlinkSync(temporary) }
}
const jsonText = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'
type ExecutionState = { readonly kind: 'unrun' }
  | { readonly kind: WorkerFailure; readonly reason: string; readonly ownership: string; readonly dispatched: boolean }
  | { readonly kind: 'retained'; readonly record: string; readonly sha256: string; readonly replyBytes: number }
export interface Execution {
  readonly schema: '010-native-wave-collection-1'
  readonly split: FixtureSplit
  readonly identity: ReturnType<typeof collectionIdentity>
  readonly selectionSha256: string
  readonly themes: readonly string[]
  readonly requests: readonly { readonly row: ScopeRequest; readonly state: ExecutionState }[]
  readonly finished: boolean
  readonly interrupted: 'SIGINT' | 'SIGTERM' | null
  readonly elapsedMs: number
}
function retainedDocument(directory: string, file: string, result: DocumentResult) {
  const logical = serializeResult(result), bytes = gzipSync(logical, { level: 9 })
  need(Buffer.byteLength(logical) <= WAVE_LIMIT && bytes.length <= WAVE_LIMIT, 'Transport budget: retained candidate document')
  atomic(resolve(directory, file), bytes)
  return { file, sha256: hash(bytes), logicalBytes: Buffer.byteLength(logical), compressedBytes: bytes.length }
}
export function retainAnswer(directory: string, index: number, answer: ReturnType<typeof parseNativeWaveAnswer>, replyBytes: number): Extract<ExecutionState, { kind: 'retained' }> {
  const base = `documents/${String(index).padStart(3, '0')}`
  const rawFull = retainedDocument(directory, `${base}-raw.json.gz`, answer.rawFull)
  const presented = retainedDocument(directory, `${base}-presented.json.gz`, answer.presented)
  const record = `${base}-record.json`, bytes = jsonText({ kind: answer.kind, rawFull, presented, evidence: answer.evidence, ...(answer.kind === 'scopes-complete' ? { themes: answer.themes } : {}) })
  atomic(resolve(directory, record), bytes)
  return { kind: 'retained', record, sha256: hash(bytes), replyBytes }
}
function readCandidate(directory: string, state: ExecutionState, request: NativeWaveRequest): ReturnType<typeof parseNativeWaveAnswer> | undefined {
  if (state.kind !== 'retained') return undefined
  const recordBytes = boundedRead(safeFile(directory, state.record))
  need(hash(recordBytes) === state.sha256, 'Changed candidate evidence record')
  const record = object(JSON.parse(recordBytes.toString('utf8')))
  const read = (value: unknown) => {
    const document = object(value), bytes = boundedRead(safeFile(directory, string(document.file)))
    need(hash(bytes) === document.sha256 && bytes.length === document.compressedBytes, 'Changed candidate document')
    const logical = gunzipSync(bytes, { maxOutputLength: WAVE_LIMIT })
    need(logical.length === document.logicalBytes, 'Wrong candidate logical bytes')
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(logical))
  }
  return parseNativeWaveAnswer({ ...record, rawFull: read(record.rawFull), presented: read(record.presented) }, request)
}
function stateInput(state: ExecutionState, answer: ReturnType<typeof parseNativeWaveAnswer> | undefined): InputDocument {
  return answer ? { kind: 'valid', result: answer.presented } : { kind: 'missing', reason: state.kind === 'unrun' ? 'unrun' : state.kind === 'retained' ? 'invalid retained answer' : `${state.kind}:${state.reason}` }
}
function requestFor(intake: JsJsxIntake, row: ScopeRequest): { input: WaveInput; request: NativeWaveRequest } {
  const input = intake.inputs.find(input => input.id === row.fixture)
  need(input, 'Unknown planned fixture')
  return { input, request: { row, source: readWaveSource(input), themes: intake.themes, selectionSha256: intake.selectionSha256 } }
}
export function readExecution(directory: string, intake: JsJsxIntake, identity: ReturnType<typeof collectionIdentity>): Execution {
  const value = object(jsonFile(safeFile(directory, 'execution.json'))), requests = planWave(intake).scopeRows
  need(value.schema === '010-native-wave-collection-1', 'Wrong collection schema')
  same(value.identity, identity, 'Changed collection/implementation/pack identity')
  same(value.selectionSha256, intake.selectionSha256, 'Changed selection')
  same(value.themes, intake.themes, 'Changed theme declarations')
  need(typeof value.finished === 'boolean' && typeof value.elapsedMs === 'number' && Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0, 'Wrong completion receipt')
  need(value.interrupted === null || value.interrupted === 'SIGINT' || value.interrupted === 'SIGTERM', 'Wrong interrupt state')
  const entries = list(value.requests).map(entry => {
    const objectEntry = object(entry), state = parseExecutionState(objectEntry.state)
    return { row: objectEntry.row, state }
  })
  same(entries.map(entry => entry.row), requests, 'Missing/extra/duplicate execution rows')
  unique(entries.flatMap(entry => entry.state.kind === 'retained' ? [entry.state.record] : []), 'candidate record')
  need(value.split === requests[0]?.split, 'Wrong execution split')
  // Exact rows were checked against the typed declaration sequence, not reconstructed from transport.
  return { schema: '010-native-wave-collection-1', split: requests[0].split, identity, selectionSha256: intake.selectionSha256, themes: intake.themes,
    requests: requests.map((row, index) => ({ row, state: entries[index].state })), finished: value.finished, interrupted: value.interrupted, elapsedMs: value.elapsedMs }
}
function parseExecutionState(value: unknown): ExecutionState {
  const state = object(value)
  if (state.kind === 'unrun') return { kind: 'unrun' }
  if (state.kind === 'retained') {
    need(typeof state.replyBytes === 'number' && Number.isSafeInteger(state.replyBytes) && state.replyBytes >= 0 && state.replyBytes <= WAVE_LIMIT, 'Invalid reply byte count')
    return { kind: 'retained', record: string(state.record), sha256: string(state.sha256), replyBytes: state.replyBytes }
  }
  need(state.kind === 'error' || state.kind === 'integrity' || state.kind === 'timeout' || state.kind === 'canceled', 'Unknown execution state')
  need(typeof state.dispatched === 'boolean', 'Wrong dispatch state')
  return { kind: state.kind, reason: string(state.reason), ownership: string(state.ownership), dispatched: state.dispatched }
}
function summarizeAttempt(attempt: import('./native/wave-document.ts').ThemeAttempt | undefined, candidate: InputDocument) {
  if (!attempt) return { kind: 'blocked', reason: candidate.kind === 'valid' ? candidate.result.status : candidate.reason }
  const { warnings, ...outcome } = attempt
  return { ...outcome, warningCount: warnings.length }
}
export function renderCollection(intake: JsJsxIntake, references: string, directory: string, execution: Execution) {
  const plan = planWave(intake), index = referenceIndex(references, plan.scopeRows, intake.inputs)
  const rows = execution.requests.map(({ row, state }) => {
    const { input, request } = requestFor(intake, row), reference = loadReference(references, index.get(row.key), row, input, request.source, intake.themes)
    const answer = readCandidate(directory, state, request)
    const candidate = stateInput(state, answer)
    if (answer) validateDocumentIdentity(answer.presented, row, input, true)
    const reconciled = reconcileRequest(row, request.source, intake.themes, reference, candidate)
    const attempts = new Map(answer?.kind === 'scopes-complete' ? answer.themes.map(attempt => [attempt.theme, attempt]) : [])
    const themes = reconciled.themes.map(theme => ({ ...theme, candidateTheme: summarizeAttempt(attempts.get(theme.theme), candidate),
      referenceTrack: reference.kind === 'valid' && reference.result.status === 'complete' && Object.hasOwn(reference.result.styles ?? {}, theme.theme) ? 'available' : 'unavailable',
      metadataAvailability: { reference: 'unavailable', candidate: 'unavailable', admission: request.source.length ? 'blocked' : 'n/a-empty' } }))
    return { ...reconciled, themes, declaration: row, state, evidence: answer?.evidence ?? null,
      work: { sourceUtf16Units: request.source.length, sourceBytes: Buffer.byteLength(request.source), rawScopeSegments: answer?.rawFull.spans.length ? answer.rawFull.spans.length / 3 : 0,
        presentedScopeSegments: answer?.presented.spans.length ? answer.presented.spans.length / 3 : 0, styleRuns: answer?.presented.status === 'complete' ? Object.values(answer.presented.styles ?? {}).reduce((sum, track) => sum + track.spans.length / 3, 0) : 0,
        replyCopiedBytes: state.kind === 'retained' ? state.replyBytes : 0 },
      themeComplete: answer?.kind === 'scopes-complete' && answer.themes.every(theme => theme.kind === 'complete'), referenceDocument: reference.kind === 'valid' ? { sha256: reference.sha256, bytes: reference.bytes } : reference }
  })
  unique(rows.map(row => row.key), 'accounting scope key')
  const themeRows = rows.flatMap(row => row.themes.map(theme => ({ ...theme, reference: row.reference, candidate: row.candidate })))
  same(themeRows.map(row => row.key), plan.themeRows.map(row => row.key), 'Wrong theme row ledger')
  const summaries = { scopes: summarizeTrack(rows.map(row => row.scopes)), styles: summarizeTrack(themeRows.map(row => row.styles)), metadata: summarizeTrack(rows.map(row => row.metadata)) }
  const grouped = Array.from(new Set(plan.scopeRows.map(row => row.language + '/' + row.profile)), group => {
    const selected = rows.filter(row => row.declaration.language + '/' + row.declaration.profile === group)
    return { group, scopes: summarizeTrack(selected.map(row => row.scopes)), styles: summarizeTrack(selected.flatMap(row => row.themes.map(theme => theme.styles))), metadata: summarizeTrack(selected.map(row => row.metadata)) }
  })
  const byTheme = intake.themes.map(theme => ({ theme, styles: summarizeTrack(themeRows.filter(row => row.theme === theme).map(row => row.styles)), metadata: summarizeTrack(themeRows.filter(row => row.theme === theme).map(row => row.metadata)) }))
  const operational = execution.finished && execution.requests.every(entry => entry.state.kind === 'retained') && rows.every(row => row.candidate === 'complete' && row.themeComplete)
  const integrityFailed = execution.requests.some(entry => entry.state.kind === 'integrity') || rows.some(row => row.reference.startsWith('invalid:'))
  const exitCode = integrityFailed ? 3 : execution.interrupted === 'SIGINT' ? 130 : execution.interrupted === 'SIGTERM' ? 143 : operational && rows.every(row => row.accepted) ? 0 : 1
  const workers = { attempted: execution.requests.filter(entry => entry.state.kind !== 'unrun' && (entry.state.kind === 'retained' || entry.state.dispatched)).length,
    completed: execution.requests.filter(entry => entry.state.kind === 'retained').length, selections: rows.reduce((sum, row) => sum + (row.evidence?.selectionsAttempted ?? 0), 0), normalizationCallbacks: rows.reduce((sum, row) => sum + (row.evidence?.normalizationAttempts ?? 0), 0),
    sourceUtf16Units: rows.reduce((sum, row) => sum + row.work.sourceUtf16Units, 0), sourceBytes: rows.reduce((sum, row) => sum + row.work.sourceBytes, 0), replyCopiedBytes: rows.reduce((sum, row) => sum + row.work.replyCopiedBytes, 0), elapsedMs: execution.elapsedMs }
  const report = ['# Frozen JS/JSX native collection', '', `Split: ${execution.split}. Scope requests: ${rows.length}. Theme rows: ${themeRows.length}.`,
    `Operational completion: ${operational}. Mandatory semantic exactness: ${exitCode === 0}. Exit: ${exitCode}.`,
    `Implementation: ${execution.identity.revision}. Source digest: ${execution.identity.implementationDigest}.`, `Retained reference origin: ${REFERENCE_ORIGIN}. Other-partition source validation is deferred.`,
    'Scopes are counted once per fixture/profile, not once per theme. Styles use their separate fixed denominator. Missing units are unobserved, not observed mismatches.',
    'Nonempty mandatory metadata remains unavailable. Empty ratios are N/A. Six retained DEV timeouts remain missing truth. No speed, memory improvement, promotion or cutover claim.',
    'Candidate raw-full scopes are retained separately from presentation scopes. Native policy: raw/raw:shiki-fork = raw + identity-v1; shiki-api = product + identity-v1; product/product:warm = product + future010-product-lines-v1.',
    'The Shiki API >=20000 line policy has no native projection here. Cold/warm label reference identity, not native performance state. Partial outer-only support never removes unsupported or recovery units.',
    `Style projection: ${STYLE_PROJECTION}. Background and zero font flags are omitted; opaque colors are canonicalized symmetrically only in ephemeral comparison views.`,
    'Parse/classify/compile/resolve totals, scan bytes and peak runtime memory are unavailable in production collection. Selection/callback attempts, final allocations and retained session bytes are evidence, not stage counters.', '',
    '## Observed work', '', '```json', jsonText(workers).trim(), '```', '', '## Fixed and conditional accounting', '', '```json', jsonText(summaries).trim(), '```', '', '## Language/profile accounting', '', '```json', jsonText(grouped).trim(), '```', '',
    '## Theme accounting', '', '```json', jsonText(byTheme).trim(), '```', '', 'The frozen nonpassing category cancel is stored as canceled in schema documents. All failure reasons and compact per-theme terminal native outcomes remain in scope-rows.json. Original warnings and complete normalization identities remain in each retained request record. The execution ledger retains unrun, canceled and process-discarded requests.', ''].join('\n')
  const tsv = ['key\ttheme\treference\tcandidate\tnativeThemeState\tstyleState\tunits\tnonWhitespace\tmatching\treason', ...themeRows.map(row => [row.key, row.theme, row.reference, row.candidate, row.candidateTheme.kind, row.styles.kind, row.styles.units, row.styles.nonWhitespace, row.styles.kind === 'compared' ? row.styles.matching : '', row.styles.kind === 'not-compared' ? row.styles.reason : 'N/A'].map(value => String(value).replaceAll('\t', ' ').replaceAll('\n', ' ')).join('\t'))].join('\n') + '\n'
  return { rows, report, tsv, exitCode }
}
function writeAccounting(options: WaveCollectionOptions, intake: JsJsxIntake, execution: Execution): number {
  const rendered = renderCollection(intake, options.references, options.out, execution)
  atomic(resolve(options.out, 'scope-rows.json'), jsonText(rendered.rows))
  atomic(resolve(options.out, 'theme-rows.tsv'), rendered.tsv)
  atomic(resolve(options.out, 'REPORT.md'), rendered.report)
  return rendered.exitCode
}
export async function collectJsJsxWave(options: WaveCollectionOptions): Promise<number> {
  const intake = readJsJsxSplit(options.split), plan = planWave(intake), identity = collectionIdentity()
  referenceIndex(options.references, plan.scopeRows, intake.inputs)
  const { verifyThemeAssets } = await import('./native/wave-document.ts')
  verifyThemeAssets()
  need(!existsSync(options.out) || readdirSync(options.out).length === 0, 'Collection output must be new or empty')
  mkdirSync(options.out, { recursive: true, mode: 0o700 }); safeDirectory(options.out)
  mkdirSync(resolve(options.out, 'documents'), { mode: 0o700 })
  const started = performance.now(), abort = new AbortController()
  let interrupted: Execution['interrupted'] = null
  const int = () => { interrupted = 'SIGINT'; abort.abort() }, term = () => { interrupted = 'SIGTERM'; abort.abort() }, external = () => abort.abort()
  process.on('SIGINT', int); process.on('SIGTERM', term); options.signal?.addEventListener('abort', external, { once: true })
  if (options.signal?.aborted) abort.abort()
  const entries: { row: ScopeRequest; state: ExecutionState }[] = plan.scopeRows.map(row => ({ row, state: { kind: 'unrun' } }))
  const execution = (finished: boolean): Execution => ({ schema: '010-native-wave-collection-1', split: options.split, identity, selectionSha256: intake.selectionSha256, themes: intake.themes,
    requests: entries, finished, interrupted, elapsedMs: performance.now() - started })
  try {
    atomic(resolve(options.out, 'execution.json'), jsonText(execution(false)))
    if (writeAccounting(options, intake, execution(false)) === 3) return 3
    for (let i = 0; i < entries.length; i++) {
      if (abort.signal.aborted) break
      entries[i].state = await executeRequest(options, intake, entries[i].row, i, abort.signal)
      atomic(resolve(options.out, 'execution.json'), jsonText(execution(false)))
    }
    const final = execution(true)
    atomic(resolve(options.out, 'execution.json'), jsonText(final))
    return writeAccounting(options, intake, final)
  } finally { process.off('SIGINT', int); process.off('SIGTERM', term); options.signal?.removeEventListener('abort', external) }
}
async function executeRequest(options: WaveCollectionOptions, intake: JsJsxIntake, row: ScopeRequest, index: number, signal: AbortSignal): Promise<ExecutionState> {
  const { request } = requestFor(intake, row)
  const result = await superviseWorker({ url: WORKER_URL, data: request, validate: value => parseNativeWaveAnswer(value, request), signal })
  return result.kind === 'complete' ? retainAnswer(options.out, index, result.value, result.replyBytes) : { kind: result.kind, reason: result.reason, ownership: result.ownership, dispatched: result.dispatched }
}
export async function checkJsJsxWave(options: WaveCollectionOptions): Promise<number> {
  return checkWaveFiles(options, readJsJsxSplit(options.split), collectionIdentity())
}
/** Read-only accounting check, also used with test-owned execution controls. Never dispatches. */
export function checkWaveFiles(options: WaveCollectionOptions, intake: JsJsxIntake, identity: ReturnType<typeof collectionIdentity>): number {
  const execution = readExecution(options.out, intake, identity)
  need(execution.split === options.split, 'Wrong retained partition')
  const rendered = renderCollection(intake, options.references, options.out, execution)
  need(isDeepStrictEqual(jsonFile(safeFile(options.out, 'scope-rows.json')), rendered.rows), 'Stale/tampered scope rows')
  same(boundedRead(safeFile(options.out, 'theme-rows.tsv')).toString('utf8'), rendered.tsv, 'Stale/tampered theme rows')
  same(boundedRead(safeFile(options.out, 'REPORT.md')).toString('utf8'), rendered.report, 'Stale/tampered report')
  need(execution.finished, 'Unfinished/interrupted collection retains unrun rows')
  return rendered.exitCode
}
