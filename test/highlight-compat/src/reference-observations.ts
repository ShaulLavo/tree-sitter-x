import { compareResults } from './compare.ts'
import { sourceLines } from './oracles/lines.ts'
import type { OracleProfileId } from './oracles/request.ts'
import { ORACLE_PROFILES } from './oracles/request.ts'
import type { DocumentResult, Style } from './schema.ts'
import { canonicalStyle } from './style.ts'

/**
 * `scopes`/`styles`: some units carry different values. `*-boundaries`: every unit agrees but raw
 * token boundaries differ. `incomplete`: a side has no complete result or lacks a theme, so the
 * input is not comparable for this pair.
 */
export type Track = 'scopes' | 'styles' | 'scope-boundaries' | 'style-boundaries' | 'incomplete'

export type Pair = readonly [OracleProfileId, OracleProfileId]

/**
 * One mismatching run: offsets, the source line holding `from` with that line's content end, the
 * theme for a style run, and each side's value (a scope path joined by spaces, or a style as JSON).
 */
export interface MismatchRun {
  readonly from: number
  readonly to: number
  readonly line: number
  readonly lineEnd: number
  readonly theme?: string
  readonly values: Readonly<Partial<Record<OracleProfileId, string>>>
}

/** One way two reference profiles differ on one input. `units` counts mismatching UTF-16 units, or boundaries. */
export interface Observation {
  readonly input: string
  readonly pair: Pair
  readonly track: Track
  readonly units: number
  readonly runs: readonly MismatchRun[]
}

const rank = (profileId: OracleProfileId): number => ORACLE_PROFILES.indexOf(profileId)

export const pairKey = ([a, b]: Pair): string => (rank(a) <= rank(b) ? `${a} ~ ${b}` : `${b} ~ ${a}`)

/** Every unordered pair of distinct profiles, in profile order. */
export function profilePairs(profiles: readonly OracleProfileId[]): Pair[] {
  return profiles.flatMap((a, index) => profiles.slice(index + 1).map((b): Pair => [a, b]))
}

const boundaryCount = (score: { readonly referenceOnly: number; readonly candidateOnly: number }): number =>
  score.referenceOnly + score.candidateOnly

export const styleValue = (style: Style): string => JSON.stringify(canonicalStyle(style))

/** Locates offsets in a source's lines without retaining per-unit data. */
function lineLocator(source: string): (offset: number) => { readonly line: number; readonly lineEnd: number } {
  const lines = sourceLines(source)
  return (offset) => {
    let low = 0
    let high = lines.length - 1
    while (low < high) {
      const middle = (low + high + 1) >> 1
      if ((lines[middle]?.start ?? 0) <= offset) low = middle
      else high = middle - 1
    }
    const line = lines[low]
    return { line: low, lineEnd: (line?.start ?? 0) + (line?.text.length ?? 0) }
  }
}

export function observe(input: string, pair: Pair, a: DocumentResult, b: DocumentResult, source: string): Observation[] {
  const incomplete: Observation = { input, pair, track: 'incomplete', units: 0, runs: [] }
  const comparison = compareResults(a, b, { source, maxRuns: Number.POSITIVE_INFINITY })
  if (!comparison.comparable) return [incomplete]
  const locate = lineLocator(source)
  const run = <V>(from: number, to: number, left: V, right: V, show: (value: V) => string, theme?: string): MismatchRun => ({
    from,
    to,
    ...locate(from),
    ...(theme === undefined ? {} : { theme }),
    values: { [pair[0]]: show(left), [pair[1]]: show(right) },
  })
  const observations: Observation[] = []
  const add = (track: Track, units: number, runs: readonly MismatchRun[] = []): void => {
    if (units > 0) observations.push({ input, pair, track, units, runs })
  }
  const scopes = comparison.scopes
  const joined = (path: readonly string[]): string => path.join(' ')
  add('scopes', scopes.mismatches.units, scopes.mismatches.runs.map((r) => run(r.from, r.to, r.reference, r.candidate, joined)))
  if (scopes.mismatches.units === 0) add('scope-boundaries', boundaryCount(scopes.boundaries.raw))
  const themes = Object.entries(comparison.styles)
  if (themes.some(([, outcome]) => !outcome.compared)) return [incomplete, ...observations]
  const reports = themes.flatMap(([theme, outcome]) => (outcome.compared ? [[theme, outcome.report] as const] : []))
  const styleRuns = reports.flatMap(([theme, report]) =>
    report.mismatches.runs.map((r) => run(r.from, r.to, r.reference, r.candidate, styleValue, theme)),
  )
  const styleUnits = reports.reduce((sum, [, report]) => sum + report.mismatches.units, 0)
  add('styles', styleUnits, styleRuns)
  if (styleUnits === 0) add('style-boundaries', reports.reduce((sum, [, report]) => sum + boundaryCount(report.boundaries.raw), 0))
  return observations
}
