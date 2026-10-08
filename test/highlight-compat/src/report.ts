import { writeFileSync } from 'node:fs'

import { MISMATCH_CATEGORIES } from './categorize.ts'
import type {
  Agreement,
  Boundaries,
  BoundaryScore,
  Comparison,
  FieldCount,
  Identity,
  Mismatches,
  MismatchRun,
  Outcome,
  Ratio,
  ScopeReport,
  StyleReport,
  TrackReport,
} from './compare.ts'
import type { Style } from './schema.ts'
import { fontKey } from './style.ts'

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`
}

function formatRatio(ratio: Ratio | undefined): string {
  if (ratio === undefined) return 'n/a (no source)'
  return `${percent(ratio.ratio)} (${ratio.matching}/${ratio.comparable})`
}

function formatIdentity(side: string, identity: Identity): string {
  const { profileId, languageId, status, sourceLength, sourceSha256, documentRevision } = identity
  return `${side}  ${profileId} ${languageId} ${status}  ${sourceLength} units  sha256 ${sourceSha256}  revision ${documentRevision}`
}

function agreementLines(agreement: Agreement): string[] {
  return [`  agreement       ${formatRatio(agreement.all)}`, `  non-whitespace  ${formatRatio(agreement.nonWhitespace)}`]
}

function mismatchLine<R>(mismatches: Mismatches<R>): string {
  return `  mismatches      ${mismatches.count} runs, ${mismatches.units} units, longest ${mismatches.longest}`
}

function boundaryLine(label: string, score: BoundaryScore): string {
  const counts = `${score.matched} matched, ${score.referenceOnly} reference-only, ${score.candidateOnly} candidate-only`
  return `    ${label.padEnd(10)} precision ${percent(score.precision)}  recall ${percent(score.recall)}  (${counts})`
}

function boundaryLines(boundaries: Boundaries): string[] {
  return ['  boundaries (diagnostic)', boundaryLine('raw', boundaries.raw), boundaryLine('coalesced', boundaries.coalesced)]
}

function runLines<V, R extends MismatchRun<V>>(runs: readonly R[], format: (value: V) => string, label: (run: R) => string): string[] {
  if (runs.length === 0) return []
  const lines = runs.map(
    (run) => `    [${run.from}, ${run.to}) ${label(run)} reference: ${format(run.reference)}  candidate: ${format(run.candidate)}`,
  )
  return [`  first ${runs.length} runs`, ...lines]
}

function formatPath(path: readonly string[]): string {
  return path.length === 0 ? '(none)' : path.join(' ')
}

function formatStyle(style: Style): string {
  const parts: string[] = []
  if (style.foreground !== undefined) parts.push(`foreground ${style.foreground}`)
  if (style.background !== undefined) parts.push(`background ${style.background}`)
  if (style.fontStyle !== undefined) parts.push(`fontStyle ${fontKey(style) || 'none'}`)
  return parts.length === 0 ? '(default)' : parts.join(', ')
}

function trackLines<V>(report: TrackReport<V>, format: (value: V) => string): string[] {
  return [
    ...agreementLines(report.agreement),
    mismatchLine(report.mismatches),
    ...boundaryLines(report.boundaries),
    ...runLines(report.mismatches.runs, format, () => ''),
  ]
}

function scopeLines(scopes: ScopeReport): string[] {
  const categories = MISMATCH_CATEGORIES.map((category) => {
    const { count, units } = scopes.categories[category]
    return `    ${category.padEnd(14)} ${count} runs, ${units} units`
  })
  return [
    'scopes',
    ...agreementLines(scopes.agreement),
    mismatchLine(scopes.mismatches),
    '  categories',
    ...categories,
    ...boundaryLines(scopes.boundaries),
    ...runLines(scopes.mismatches.runs, formatPath, (run) => `${run.category} `),
  ]
}

function formatField(name: string, count: FieldCount): string {
  const nonWhitespace = count.nonWhitespaceUnits === undefined ? '' : ` (${count.nonWhitespaceUnits} non-whitespace)`
  return `${name} ${count.units}${nonWhitespace}`
}

function styleLines(report: StyleReport): string[] {
  const { foreground, background, fontStyle } = report.fields
  const fields = [formatField('foreground', foreground), formatField('background', background), formatField('fontStyle', fontStyle)]
  return [...trackLines(report, formatStyle), `  differing units ${fields.join(', ')}`]
}

function outcomeLines<T>(title: string, outcome: Outcome<T>, lines: (report: T) => string[]): string[] {
  if (!outcome.compared) return [title, `  not compared: ${outcome.reason}`]
  return [title, ...lines(outcome.report)]
}

export function formatComparison(comparison: Comparison): string {
  const header = [formatIdentity('reference', comparison.reference), formatIdentity('candidate', comparison.candidate)]
  if (!comparison.comparable) return [...header, `not comparable: ${comparison.reason}`, ''].join('\n')
  const metadata = outcomeLines('metadata', comparison.metadata, (report) => trackLines(report, (id) => id))
  const styles = Object.entries(comparison.styles).flatMap(([themeId, outcome]) =>
    outcomeLines(`style ${themeId}`, outcome, styleLines),
  )
  return [...header, ...scopeLines(comparison.scopes), ...metadata, ...styles, ''].join('\n')
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1))
  return Object.fromEntries(entries.map(([key, entry]) => [key, sortKeys(entry)]))
}

/** Stable JSON: keys sorted recursively, two-space indent, trailing newline. */
export function serializeReport(comparison: Comparison): string {
  return `${JSON.stringify(sortKeys(comparison), null, 2)}\n`
}

export function writeReport(path: string, comparison: Comparison): void {
  writeFileSync(path, serializeReport(comparison))
}
