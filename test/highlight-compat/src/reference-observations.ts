import { compareResults } from './compare.ts'
import type { OracleProfileId } from './oracles/request.ts'
import { ORACLE_PROFILES } from './oracles/request.ts'
import type { DocumentResult } from './schema.ts'

/**
 * `scopes`/`styles`: some units carry different values. `*-boundaries`: every unit agrees but raw
 * token boundaries differ. `incomplete`: a side has no complete result, so nothing compared.
 */
export type Track = 'scopes' | 'styles' | 'scope-boundaries' | 'style-boundaries' | 'incomplete'

export type Pair = readonly [OracleProfileId, OracleProfileId]

/** One way two reference profiles differ on one input. `units` counts mismatching UTF-16 units, or boundaries. */
export interface Observation {
  readonly input: string
  readonly pair: Pair
  readonly track: Track
  readonly units: number
}

const rank = (profileId: OracleProfileId): number => ORACLE_PROFILES.indexOf(profileId)

export const pairKey = ([a, b]: Pair): string => (rank(a) <= rank(b) ? `${a} ~ ${b}` : `${b} ~ ${a}`)

/** Every unordered pair of distinct profiles, in profile order. */
export function profilePairs(profiles: readonly OracleProfileId[]): Pair[] {
  return profiles.flatMap((a, index) => profiles.slice(index + 1).map((b): Pair => [a, b]))
}

const boundaryCount = (score: { readonly referenceOnly: number; readonly candidateOnly: number }): number =>
  score.referenceOnly + score.candidateOnly

export function observe(input: string, pair: Pair, a: DocumentResult, b: DocumentResult, source: string): Observation[] {
  const comparison = compareResults(a, b, { source, maxRuns: 0 })
  if (!comparison.comparable) return [{ input, pair, track: 'incomplete', units: 0 }]
  const observations: Observation[] = []
  const add = (track: Track, units: number): void => {
    if (units > 0) observations.push({ input, pair, track, units })
  }
  const scopeUnits = comparison.scopes.mismatches.units
  add('scopes', scopeUnits)
  if (scopeUnits === 0) add('scope-boundaries', boundaryCount(comparison.scopes.boundaries.raw))
  const outcomes = Object.values(comparison.styles)
  if (outcomes.some((outcome) => !outcome.compared)) observations.push({ input, pair, track: 'incomplete', units: 0 })
  const themes = outcomes.flatMap((outcome) => (outcome.compared ? [outcome.report] : []))
  const styleUnits = themes.reduce((sum, report) => sum + report.mismatches.units, 0)
  add('styles', styleUnits)
  if (styleUnits === 0) add('style-boundaries', themes.reduce((sum, report) => sum + boundaryCount(report.boundaries.raw), 0))
  return observations
}
