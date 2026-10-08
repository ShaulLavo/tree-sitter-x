import { categorize, type MismatchCategory } from './categorize.ts'
import type { CompleteResult, DocumentResult, ProfileId, ResultStatus, SpanTriples, Style } from './schema.ts'
import { isWhitespaceUnit, sourceSha256 } from './source.ts'
import { backgroundKey, fontKey, foregroundKey, styleKey, themeTrack } from './style.ts'
import { sweep } from './sweep.ts'

export interface CompareOptions {
  /** The exact source both results describe; enables non-whitespace counts. */
  readonly source?: string
  /** Compare only this theme's style track; otherwise every theme either side carries. */
  readonly themeId?: string
  /** How many mismatch runs to keep per track; counts always cover every run. */
  readonly maxRuns?: number
}

/** `ratio` is null when nothing was comparable: N/A, never 100%. */
export interface Ratio {
  readonly matching: number
  readonly comparable: number
  readonly ratio: number | null
}

/** `nonWhitespace` is present only when the source was given. */
export interface Agreement {
  readonly all: Ratio
  readonly nonWhitespace?: Ratio
}

/** The reference is the truth; null when the denominator is 0. */
export interface BoundaryScore {
  readonly matched: number
  readonly referenceOnly: number
  readonly candidateOnly: number
  readonly precision: number | null
  readonly recall: number | null
}

/** Diagnostic only: agreement never depends on boundaries. */
export interface Boundaries {
  readonly raw: BoundaryScore
  readonly coalesced: BoundaryScore
}

export interface MismatchRun<V> {
  readonly from: number
  readonly to: number
  readonly reference: V
  readonly candidate: V
}

export interface ScopeRun extends MismatchRun<readonly string[]> {
  readonly category: MismatchCategory
}

/** `count`, `units` and `longest` cover every run; `runs` holds only the first `maxRuns`. */
export interface Mismatches<R> {
  readonly count: number
  readonly units: number
  readonly longest: number
  readonly runs: readonly R[]
}

export interface TrackReport<V> {
  readonly agreement: Agreement
  readonly mismatches: Mismatches<MismatchRun<V>>
  readonly boundaries: Boundaries
}

export interface CategoryCount {
  readonly count: number
  readonly units: number
}

export interface ScopeReport {
  readonly agreement: Agreement
  readonly mismatches: Mismatches<ScopeRun>
  readonly categories: Readonly<Record<MismatchCategory, CategoryCount>>
  readonly boundaries: Boundaries
}

/** Units where this field differs, counted independently of the other fields. */
export interface FieldCount {
  readonly units: number
  readonly nonWhitespaceUnits?: number
}

export type StyleField = 'foreground' | 'background' | 'fontStyle'

export interface StyleReport extends TrackReport<Style> {
  readonly fields: Readonly<Record<StyleField, FieldCount>>
}

export type MetadataReport = TrackReport<string>

export type Outcome<T> = { readonly compared: true; readonly report: T } | { readonly compared: false; readonly reason: string }

export interface Identity {
  readonly profileId: ProfileId
  readonly languageId: string
  readonly status: ResultStatus
  readonly sourceSha256: string
  readonly sourceLength: number
  readonly documentRevision: number
}

export type Comparison =
  | { readonly comparable: false; readonly reason: string; readonly reference: Identity; readonly candidate: Identity }
  | {
      readonly comparable: true
      readonly reference: Identity
      readonly candidate: Identity
      readonly scopes: ScopeReport
      readonly metadata: Outcome<MetadataReport>
      readonly styles: Readonly<Record<string, Outcome<StyleReport>>>
    }

const DEFAULT_MAX_RUNS = 20

interface Context {
  readonly source: string | undefined
  readonly maxRuns: number
}

/** One side of a track: `keys[i]` is the comparison key of `values[i]`. */
interface Side<V> {
  readonly spans: SpanTriples
  readonly values: readonly V[]
  readonly keys: readonly string[]
}

/** A finished mismatch run by value index; every run is reported, not only the kept ones. */
interface ClosedRun {
  readonly reference: number
  readonly candidate: number
  readonly units: number
  readonly nonWhitespaceUnits: number
}

type RunListener = (run: ClosedRun) => void

function ratio(matching: number, comparable: number): Ratio {
  return { matching, comparable, ratio: comparable === 0 ? null : matching / comparable }
}

function fraction(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

function countNonWhitespace(source: string, from: number, to: number): number {
  let count = 0
  for (let i = from; i < to; i++) {
    if (!isWhitespaceUnit(source.charCodeAt(i))) count++
  }
  return count
}

class BoundaryCounter {
  #matched = 0
  #referenceOnly = 0
  #candidateOnly = 0

  add(reference: boolean, candidate: boolean): void {
    if (reference && candidate) {
      this.#matched++
      return
    }
    if (reference) this.#referenceOnly++
    if (candidate) this.#candidateOnly++
  }

  score(): BoundaryScore {
    return {
      matched: this.#matched,
      referenceOnly: this.#referenceOnly,
      candidateOnly: this.#candidateOnly,
      precision: fraction(this.#matched, this.#matched + this.#candidateOnly),
      recall: fraction(this.#matched, this.#matched + this.#referenceOnly),
    }
  }
}

/** Accumulates one track comparison interval by interval; state is constant apart from kept runs. */
class TrackSweep<V> {
  readonly #reference: Side<V>
  readonly #candidate: Side<V>
  readonly #context: Context
  readonly #onRun: RunListener
  readonly #raw = new BoundaryCounter()
  readonly #coalesced = new BoundaryCounter()
  readonly #runs: MismatchRun<V>[] = []
  #matching = 0
  #comparable = 0
  #nonWhitespaceMatching = 0
  #nonWhitespaceComparable = 0
  #count = 0
  #units = 0
  #longest = 0
  #previousReference = ''
  #previousCandidate = ''
  #open = false
  #runFrom = 0
  #runTo = 0
  #runReference = 0
  #runCandidate = 0
  #runNonWhitespace = 0

  constructor(reference: Side<V>, candidate: Side<V>, context: Context, onRun: RunListener) {
    this.#reference = reference
    this.#candidate = candidate
    this.#context = context
    this.#onRun = onRun
  }

  visit(from: number, to: number, referenceValue: number, candidateValue: number, referenceStarts: boolean, candidateStarts: boolean): void {
    const referenceKey = this.#reference.keys[referenceValue]
    const candidateKey = this.#candidate.keys[candidateValue]
    if (from > 0) {
      this.#raw.add(referenceStarts, candidateStarts)
      this.#coalesced.add(referenceKey !== this.#previousReference, candidateKey !== this.#previousCandidate)
    }
    this.#previousReference = referenceKey
    this.#previousCandidate = candidateKey
    const units = to - from
    const nonWhitespace = this.#context.source === undefined ? 0 : countNonWhitespace(this.#context.source, from, to)
    this.#comparable += units
    this.#nonWhitespaceComparable += nonWhitespace
    if (referenceKey === candidateKey) {
      this.#matching += units
      this.#nonWhitespaceMatching += nonWhitespace
      this.#closeRun()
      return
    }
    if (this.#open && this.#continuesRun(referenceKey, candidateKey)) {
      this.#runTo = to
      this.#runNonWhitespace += nonWhitespace
      return
    }
    this.#closeRun()
    this.#open = true
    this.#runFrom = from
    this.#runTo = to
    this.#runReference = referenceValue
    this.#runCandidate = candidateValue
    this.#runNonWhitespace = nonWhitespace
  }

  finish(): TrackReport<V> {
    this.#closeRun()
    const all = ratio(this.#matching, this.#comparable)
    const agreement: Agreement =
      this.#context.source === undefined
        ? { all }
        : { all, nonWhitespace: ratio(this.#nonWhitespaceMatching, this.#nonWhitespaceComparable) }
    return {
      agreement,
      mismatches: { count: this.#count, units: this.#units, longest: this.#longest, runs: this.#runs },
      boundaries: { raw: this.#raw.score(), coalesced: this.#coalesced.score() },
    }
  }

  #continuesRun(referenceKey: string, candidateKey: string): boolean {
    return this.#reference.keys[this.#runReference] === referenceKey && this.#candidate.keys[this.#runCandidate] === candidateKey
  }

  #closeRun(): void {
    if (!this.#open) return
    this.#open = false
    const units = this.#runTo - this.#runFrom
    this.#count++
    this.#units += units
    if (units > this.#longest) this.#longest = units
    if (this.#runs.length < this.#context.maxRuns) {
      this.#runs.push({
        from: this.#runFrom,
        to: this.#runTo,
        reference: this.#reference.values[this.#runReference],
        candidate: this.#candidate.values[this.#runCandidate],
      })
    }
    this.#onRun({
      reference: this.#runReference,
      candidate: this.#runCandidate,
      units,
      nonWhitespaceUnits: this.#runNonWhitespace,
    })
  }
}

function compareTrack<V>(reference: Side<V>, candidate: Side<V>, context: Context, onRun: RunListener): TrackReport<V> {
  const track = new TrackSweep(reference, candidate, context, onRun)
  sweep(reference.spans, candidate.spans, (from, to, a, b, aStarts, bStarts) => track.visit(from, to, a, b, aStarts, bStarts))
  return track.finish()
}

function keyedSide<V>(spans: SpanTriples, values: readonly V[], key: (value: V) => string): Side<V> {
  return { spans, values, keys: values.map(key) }
}

function scopeSide(result: CompleteResult): Side<readonly string[]> {
  const paths = result.paths.map((path) => path.map((index) => result.scopeNames[index]))
  return keyedSide(result.spans, paths, (names) => names.join(' '))
}

function compareScopes(reference: CompleteResult, candidate: CompleteResult, context: Context): ScopeReport {
  const referenceSide = scopeSide(reference)
  const candidateSide = scopeSide(candidate)
  const categories: Record<MismatchCategory, { count: number; units: number }> = {
    leaf: { count: 0, units: 0 },
    'missing-scope': { count: 0, units: 0 },
    'extra-scope': { count: 0, units: 0 },
    reordered: { count: 0, units: 0 },
    ancestor: { count: 0, units: 0 },
    other: { count: 0, units: 0 },
  }
  const track = compareTrack(referenceSide, candidateSide, context, (run) => {
    const tally = categories[categorize(referenceSide.values[run.reference], candidateSide.values[run.candidate])]
    tally.count++
    tally.units += run.units
  })
  const runs = track.mismatches.runs.map((run) => ({ ...run, category: categorize(run.reference, run.candidate) }))
  return { ...track, mismatches: { ...track.mismatches, runs }, categories }
}

function missing(what: string, onReference: boolean, onCandidate: boolean): string {
  const sides: string[] = []
  if (onReference) sides.push('reference')
  if (onCandidate) sides.push('candidate')
  return `${what} missing on ${sides.join(' and ')}`
}

function compareMetadata(reference: CompleteResult, candidate: CompleteResult, context: Context): Outcome<MetadataReport> {
  if (reference.metadata === undefined || candidate.metadata === undefined) {
    const reason = missing('metadata track', reference.metadata === undefined, candidate.metadata === undefined)
    return { compared: false, reason }
  }
  const report = compareTrack(
    keyedSide(reference.metadata.spans, reference.metadata.languageIds, (id) => id),
    keyedSide(candidate.metadata.spans, candidate.metadata.languageIds, (id) => id),
    context,
    () => {},
  )
  return { compared: true, report }
}

const FIELD_KEYS: readonly (readonly [StyleField, (style: Style) => string])[] = [
  ['foreground', foregroundKey],
  ['background', backgroundKey],
  ['fontStyle', fontKey],
]

type FieldTally = Record<StyleField, { units: number; nonWhitespaceUnits: number }>

function countFields(tally: FieldTally, reference: Style, candidate: Style, run: ClosedRun): void {
  for (const [field, key] of FIELD_KEYS) {
    if (key(reference) === key(candidate)) continue
    tally[field].units += run.units
    tally[field].nonWhitespaceUnits += run.nonWhitespaceUnits
  }
}

function fieldCounts(tally: FieldTally, withSource: boolean): Record<StyleField, FieldCount> {
  const count = (field: StyleField): FieldCount =>
    withSource ? tally[field] : { units: tally[field].units }
  return { foreground: count('foreground'), background: count('background'), fontStyle: count('fontStyle') }
}

function compareTheme(reference: CompleteResult, candidate: CompleteResult, themeId: string, context: Context): Outcome<StyleReport> {
  const referenceTrack = themeTrack(reference.styles, themeId)
  const candidateTrack = themeTrack(candidate.styles, themeId)
  if (referenceTrack === undefined || candidateTrack === undefined) {
    const reason = missing(`theme ${themeId}`, referenceTrack === undefined, candidateTrack === undefined)
    return { compared: false, reason }
  }
  const referenceSide = keyedSide(referenceTrack.spans, referenceTrack.styles, styleKey)
  const candidateSide = keyedSide(candidateTrack.spans, candidateTrack.styles, styleKey)
  const tally: FieldTally = {
    foreground: { units: 0, nonWhitespaceUnits: 0 },
    background: { units: 0, nonWhitespaceUnits: 0 },
    fontStyle: { units: 0, nonWhitespaceUnits: 0 },
  }
  const track = compareTrack(referenceSide, candidateSide, context, (run) =>
    countFields(tally, referenceSide.values[run.reference], candidateSide.values[run.candidate], run),
  )
  return { compared: true, report: { ...track, fields: fieldCounts(tally, context.source !== undefined) } }
}

function themeIds(reference: CompleteResult, candidate: CompleteResult, themeId: string | undefined): string[] {
  if (themeId !== undefined) return [themeId]
  return [...new Set([...Object.keys(reference.styles ?? {}), ...Object.keys(candidate.styles ?? {})])]
}

function compareStyles(
  reference: CompleteResult,
  candidate: CompleteResult,
  themeId: string | undefined,
  context: Context,
): Record<string, Outcome<StyleReport>> {
  const ids = themeIds(reference, candidate, themeId)
  return Object.fromEntries(ids.map((id) => [id, compareTheme(reference, candidate, id, context)]))
}

function identity(result: DocumentResult): Identity {
  return {
    profileId: result.profileId,
    languageId: result.languageId,
    status: result.status,
    sourceSha256: result.sourceSha256,
    sourceLength: result.sourceLength,
    documentRevision: result.documentRevision,
  }
}

function describesSource(result: DocumentResult, length: number, sha256: string): boolean {
  return result.sourceLength === length && result.sourceSha256 === sha256
}

function checkSource(source: string | undefined, reference: DocumentResult, candidate: DocumentResult): void {
  if (source === undefined) return
  const sha256 = sourceSha256(source)
  if (describesSource(reference, source.length, sha256) || describesSource(candidate, source.length, sha256)) return
  throw new RangeError(
    `source (${source.length} units, sha256 ${sha256}) matches neither result: reference ${reference.sourceLength} units, sha256 ${reference.sourceSha256}; candidate ${candidate.sourceLength} units, sha256 ${candidate.sourceSha256}`,
  )
}

function statusReason(reference: DocumentResult, candidate: DocumentResult): string {
  const reasons: string[] = []
  if (reference.status !== 'complete') reasons.push(`reference status is ${reference.status}`)
  if (candidate.status !== 'complete') reasons.push(`candidate status is ${candidate.status}`)
  return reasons.join('; ')
}

function sourceReason(reference: DocumentResult, candidate: DocumentResult): string | undefined {
  if (reference.sourceSha256 === candidate.sourceSha256 && reference.sourceLength === candidate.sourceLength) return undefined
  return `sources differ: reference ${reference.sourceLength} units, sha256 ${reference.sourceSha256}; candidate ${candidate.sourceLength} units, sha256 ${candidate.sourceSha256}`
}

/** Inputs must already be valid results. Throws when `options.source` describes neither result. */
export function compareResults(reference: DocumentResult, candidate: DocumentResult, options: CompareOptions = {}): Comparison {
  checkSource(options.source, reference, candidate)
  const identities = { reference: identity(reference), candidate: identity(candidate) }
  if (reference.status !== 'complete' || candidate.status !== 'complete') {
    return { comparable: false, reason: statusReason(reference, candidate), ...identities }
  }
  const differs = sourceReason(reference, candidate)
  if (differs !== undefined) return { comparable: false, reason: differs, ...identities }
  const context: Context = { source: options.source, maxRuns: options.maxRuns ?? DEFAULT_MAX_RUNS }
  return {
    comparable: true,
    ...identities,
    scopes: compareScopes(reference, candidate, context),
    metadata: compareMetadata(reference, candidate, context),
    styles: compareStyles(reference, candidate, options.themeId, context),
  }
}
