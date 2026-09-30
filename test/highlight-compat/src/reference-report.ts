import { fileURLToPath } from 'node:url'
import { CONFORMANCE_DIFFERENCES } from './oracles/conformance-expectations.ts'
import { ORACLE_THEMES, PINS, pinLabel } from './oracles/pins.ts'
import { CAUSE_TITLES, CAUSES, REFERENCE_EXPECTATIONS, type ReferenceExpectation } from './oracles/reference-expectations.ts'
import { CONFORMANCE_PROFILES, ORACLE_PROFILES } from './oracles/request.ts'
import { type ConformanceInput, conformanceInputs, fixtureInputs, type ReferenceInput } from './reference-inputs.ts'
import { type Observation, observe, pairKey, profilePairs, type Track } from './reference-observations.ts'

export const REPORT_PATH = fileURLToPath(new URL('../reports/reference-differences.md', import.meta.url))

export interface Attribution {
  readonly claimed: ReadonlyMap<ReferenceExpectation, readonly Observation[]>
  /** Observed differences no expectation claims. */
  readonly unexplained: readonly Observation[]
  /** Observed differences more than one expectation claims. */
  readonly ambiguous: readonly Observation[]
  /** Claims no observation backs, as `id: input pair track`. */
  readonly unobserved: readonly string[]
}

const claims = (expectation: ReferenceExpectation, observation: Observation): boolean =>
  (expectation.inputs === 'every-fixture'
    ? !observation.input.startsWith('conformance/')
    : expectation.inputs.includes(observation.input)) &&
  expectation.tracks.includes(observation.track) &&
  expectation.pairs.some((pair) => pairKey(pair) === pairKey(observation.pair))

function requiredClaims(expectation: ReferenceExpectation): string[] {
  const inputs = expectation.inputs === 'every-fixture' ? [expectation.minimalFixture] : expectation.inputs
  return inputs.flatMap((input) =>
    expectation.pairs.flatMap((pair) => expectation.tracks.map((track) => `${input} ${pairKey(pair)} ${track}`)),
  )
}

/** Every observation must be claimed by exactly one expectation, and every claim must be observed. */
export function attribute(observations: readonly Observation[], expectations: readonly ReferenceExpectation[]): Attribution {
  const claimed = new Map<ReferenceExpectation, Observation[]>(expectations.map((expectation) => [expectation, []]))
  const unexplained: Observation[] = []
  const ambiguous: Observation[] = []
  for (const observation of observations) {
    const owners = expectations.filter((expectation) => claims(expectation, observation))
    if (owners.length === 0) unexplained.push(observation)
    if (owners.length > 1) ambiguous.push(observation)
    for (const owner of owners) claimed.get(owner)?.push(observation)
  }
  const seen = new Set(observations.map((observation) => `${observation.input} ${pairKey(observation.pair)} ${observation.track}`))
  const unobserved = expectations.flatMap((expectation) =>
    requiredClaims(expectation).filter((claim) => !seen.has(claim)).map((claim) => `${expectation.id}: ${claim}`),
  )
  return { claimed, unexplained, ambiguous, unobserved }
}

function observationsOf(inputs: readonly ReferenceInput[], profiles: typeof ORACLE_PROFILES): Observation[] {
  return inputs.flatMap((input) =>
    profilePairs(profiles).flatMap((pair) => {
      const [a, b] = [input.results.get(pair[0]), input.results.get(pair[1])]
      if (a === undefined || b === undefined) return [{ input: input.input, pair, track: 'incomplete' as const, units: 0 }]
      return observe(input.input, pair, a, b, input.source)
    }),
  )
}

const UNIT_TRACKS: readonly Track[] = ['scopes', 'styles']
const sum = (observations: readonly Observation[], tracks: readonly Track[]): number =>
  observations.filter((observation) => tracks.includes(observation.track)).reduce((total, observation) => total + observation.units, 0)
const distinct = (values: readonly string[]): number => new Set(values).size
const code = (text: string): string => `\`${text}\``
const row = (cells: readonly (string | number)[]): string => `| ${cells.join(' | ')} |`

function headline(attribution: Attribution): string[] {
  const lines = [
    row(['Cause', 'Expectations', 'Differences', 'Profile pairs', 'Inputs', 'Scope units', 'Style units', 'Boundary-only']),
    row(['---', '---:', '---:', '---:', '---:', '---:', '---:', '---:']),
  ]
  for (const cause of CAUSES) {
    const expectations = [...attribution.claimed.keys()].filter((expectation) => expectation.cause === cause)
    const observed = expectations.flatMap((expectation) => attribution.claimed.get(expectation) ?? [])
    const boundaryOnly = observed.filter((observation) => observation.track.endsWith('-boundaries')).length
    lines.push(
      row([
        CAUSE_TITLES[cause],
        expectations.length,
        observed.length,
        distinct(observed.map((observation) => pairKey(observation.pair))),
        distinct(observed.map((observation) => observation.input)),
        sum(observed, ['scopes']),
        sum(observed, ['styles']),
        boundaryOnly,
      ]),
    )
  }
  const loose = [...attribution.unexplained, ...attribution.ambiguous]
  lines.push(row(['Unexplained or ambiguous', '-', loose.length, '-', distinct(loose.map((o) => o.input)), sum(loose, ['scopes']), sum(loose, ['styles']), '-']))
  return lines
}

function conformanceSection(inputs: readonly ConformanceInput[], observations: readonly Observation[]): string[] {
  const [raw, fork] = CONFORMANCE_PROFILES
  const differing = new Set(observations.map((observation) => observation.input))
  const lines = [
    '## Conformance lane',
    '',
    `The vendored vscode-textmate suites (fbe49961): ${inputs.length} selected cases. Each case's lines, joined with LF, are one input.`,
    '',
    row(['Profile', 'Cases matching the suite', 'Named differences', 'Failed runs']),
    row(['---', '---:', '---:', '---:']),
  ]
  for (const profileId of CONFORMANCE_PROFILES) {
    const matching = inputs.filter((input) => input.matchesSuite.get(profileId) === true).length
    const named = CONFORMANCE_DIFFERENCES.filter((difference) => difference.profiles.includes(profileId)).length
    lines.push(row([code(profileId), `${matching}/${inputs.length}`, named, inputs.filter((input) => input.failures.has(profileId)).length]))
  }
  const identical = inputs.filter((input) => !differing.has(input.input) && input.failures.size === 0).length
  lines.push('', `${code(raw ?? '')} and ${code(fork ?? '')} give identical scopes on ${identical}/${inputs.length} cases.`, '')
  lines.push(row(['Case', 'Profiles', 'Cause']), row(['---', '---', '---']))
  for (const difference of CONFORMANCE_DIFFERENCES) {
    lines.push(row([`${difference.suite}: ${difference.desc}`, difference.profiles.map(code).join(', '), difference.because]))
  }
  lines.push('', 'The other reference profiles load only product grammar assets, so they do not run these artificial grammars.')
  return lines
}

function expectationSection(expectation: ReferenceExpectation, observed: readonly Observation[]): string[] {
  const lines = [
    `### ${code(expectation.id)}`,
    '',
    `${CAUSE_TITLES[expectation.cause]}. Minimal fixture ${code(expectation.minimalFixture)}. ${expectation.why}`,
    '',
  ]
  if (expectation.inputs === 'every-fixture') {
    lines.push(row(['Profile pair', 'Inputs', 'Boundaries']), row(['---', '---:', '---:']))
    for (const pair of expectation.pairs) {
      const mine = observed.filter((observation) => pairKey(observation.pair) === pairKey(pair))
      lines.push(row([code(pairKey(pair)), mine.length, sum(mine, expectation.tracks)]))
    }
    return lines
  }
  lines.push(row(['Input', 'Profile pair', 'Track', 'Units']), row(['---', '---', '---', '---:']))
  for (const observation of observed) {
    lines.push(row([code(observation.input), code(pairKey(observation.pair)), observation.track, observation.units]))
  }
  return lines
}

function pairMatrix(inputs: readonly ReferenceInput[], observations: readonly Observation[]): string[] {
  const lines = [
    row(['Profile pair', 'Inputs compared', 'Inputs differing', 'Scope units', 'Style units', 'Boundary-only inputs']),
    row(['---', '---:', '---:', '---:', '---:', '---:']),
  ]
  for (const pair of profilePairs(ORACLE_PROFILES)) {
    const mine = observations.filter((observation) => pairKey(observation.pair) === pairKey(pair))
    const assigned = mine.filter((observation) => UNIT_TRACKS.includes(observation.track))
    const boundaryOnly = mine.filter((observation) => !assigned.some((other) => other.input === observation.input))
    lines.push(
      row([
        code(pairKey(pair)),
        inputs.length,
        distinct(assigned.map((observation) => observation.input)),
        sum(mine, ['scopes']),
        sum(mine, ['styles']),
        distinct(boundaryOnly.map((observation) => observation.input)),
      ]),
    )
  }
  return lines
}

function looseSection(attribution: Attribution): string[] {
  const loose = [...attribution.unexplained.map((o) => ['unexplained', o] as const), ...attribution.ambiguous.map((o) => ['ambiguous', o] as const)]
  const lines = ['## Unexplained differences', '']
  if (loose.length === 0 && attribution.unobserved.length === 0) return [...lines, 'None: every observed difference has exactly one named expectation, and every expectation is observed.']
  lines.push(row(['Kind', 'Input', 'Profile pair', 'Track', 'Units']), row(['---', '---', '---', '---', '---:']))
  for (const [kind, o] of loose) lines.push(row([kind, code(o.input), code(pairKey(o.pair)), o.track, o.units]))
  for (const claim of attribution.unobserved) lines.push(row(['unobserved expectation', code(claim), '-', '-', '-']))
  return lines
}

export interface ReferenceReport {
  readonly markdown: string
  readonly observations: readonly Observation[]
  readonly attribution: Attribution
}

export function formatReport(fixtures: readonly ReferenceInput[], conformance: readonly ConformanceInput[]): ReferenceReport {
  const fixtureObservations = observationsOf(fixtures, ORACLE_PROFILES)
  const conformanceObservations = observationsOf(conformance, CONFORMANCE_PROFILES)
  const observations = [...fixtureObservations, ...conformanceObservations]
  const attribution = attribute(observations, REFERENCE_EXPECTATIONS)
  const markdown = [
    '# Reference profile differences',
    '',
    'Generated by `npm run report:references`; `npm test` checks this file is current. Do not edit it by hand.',
    '',
    `Profiles: ${ORACLE_PROFILES.map(code).join(', ')}. Themes: ${ORACLE_THEMES.map(code).join(', ')}. Inputs: ${fixtures.length} original fixtures (\`fixtures/original\`) and ${conformance.length} vscode-textmate conformance cases.`,
    `Engines: ${pinLabel(PINS.vscodeTextmate)} (${PINS.vscodeTextmate.commit.slice(0, 8)}), ${pinLabel(PINS.vscodeOniguruma)} (${PINS.vscodeOniguruma.commit.slice(0, 8)}), ${pinLabel(PINS.shikiTextmate)}, ${pinLabel(PINS.shiki)}; product port of Platform ${PINS.platformCommit.slice(0, 8)}.`,
    '',
    'Each difference is one (input, profile pair, track). Scope and style units count mismatching UTF-16 units from `compareResults`; style units add up all four themes. Boundary-only means every unit agrees but raw token boundaries differ.',
    '',
    '## Headline',
    '',
    ...headline(attribution),
    '',
    ...conformanceSection(conformance, conformanceObservations),
    '',
    '## Named expectations',
    '',
    ...REFERENCE_EXPECTATIONS.flatMap((expectation) => [...expectationSection(expectation, attribution.claimed.get(expectation) ?? []), '']),
    '## Profile pairs over the original fixtures',
    '',
    ...pairMatrix(fixtures, fixtureObservations),
    '',
    ...looseSection(attribution),
    '',
  ].join('\n')
  return { markdown, observations, attribution }
}

export async function buildReferenceReport(): Promise<ReferenceReport> {
  const [fixtures, conformance] = await Promise.all([fixtureInputs(), conformanceInputs()])
  return formatReport(fixtures, conformance)
}
