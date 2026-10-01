import { ResultBuilder } from './build.ts'
import { compareResults } from './compare.ts'
import type { Agreement, Comparison, Ratio } from './compare.ts'
import { corpusInputs, readReference } from './corpus.ts'
import type { CorpusInput } from './corpus.ts'
import { GOLDEN_ROOT } from './golden.ts'
import { ORACLE_THEMES } from './oracles/pins.ts'
import { baselineScopes, baselineSupport } from './baselines/run.ts'
import type { BaselineId, BaselineScopes, QueryEvidence } from './baselines/run.ts'
import { paintScopes } from './baselines/theme.ts'
import type { StyleReference } from './baselines/theme.ts'

export interface BaselineComparison {
  readonly baseline: BaselineId
  readonly reference: StyleReference
  readonly input: CorpusInput
  readonly comparison: Comparison
  readonly failure?: string
}

export interface BaselineReportData {
  readonly comparisons: readonly BaselineComparison[]
  readonly queries: ReadonlyMap<string, QueryEvidence>
}

export async function baselineComparisons(root = GOLDEN_ROOT): Promise<BaselineReportData> {
  const comparisons: BaselineComparison[] = []
  const queries = new Map<string, QueryEvidence>()
  for (const baseline of ['baseline:captures', 'baseline:vscode-ts'] as const) {
    for (const input of corpusInputs()) {
      const reason = baselineSupport(baseline, input.languageId)
      let scopes: BaselineScopes | undefined
      let failure: string | undefined
      if (reason === undefined) {
        try {
          scopes = await baselineScopes(baseline, input.languageId, input.source)
        } catch (error) {
          failure = error instanceof Error ? error.message : String(error)
        }
      }
      if (scopes !== undefined) queries.set(`${baseline} / ${input.languageId}`, scopes.evidence)
      for (const reference of ['raw', 'product'] as const) {
        const candidate = scopes === undefined
          ? new ResultBuilder({ profileId: baseline, languageId: input.languageId }, input.source).incomplete(failure === undefined ? 'unsupported' : 'error', failure ?? reason as string)
          : await paintScopes(baseline, input.languageId, input.source, scopes.intervals, reference, scopes.engine, scopes.evidence.exclusions)
        comparisons.push({ baseline, reference, input, ...(failure === undefined ? {} : { failure }), comparison: compareResults(readReference(input, reference, root), candidate, { source: input.source, maxRuns: Number.MAX_SAFE_INTEGER }) })
      }
    }
  }
  return { comparisons, queries }
}

const compareText = (a: string, b: string): number => a < b ? -1 : Number(a > b)
const percent = (ratio: number | null): string => ratio === null ? 'N/A' : `${(100 * ratio).toFixed(2)}%`
const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ')
const mean = (values: readonly (number | null)[]): number | null => {
  const finite = values.filter((value): value is number => value !== null)
  return finite.length === 0 ? null : finite.reduce((a, b) => a + b, 0) / finite.length
}

export function weightedRatio(ratios: readonly Ratio[]): Ratio {
  const matching = ratios.reduce((sum, ratio) => sum + ratio.matching, 0)
  const comparable = ratios.reduce((sum, ratio) => sum + ratio.comparable, 0)
  return { matching, comparable, ratio: comparable === 0 ? null : matching / comparable }
}

function aggregate(agreements: readonly Agreement[]): string {
  const weighted = weightedRatio(agreements.map(agreement => agreement.all))
  const nonWhitespace = weightedRatio(agreements.flatMap(agreement => agreement.nonWhitespace === undefined ? [] : [agreement.nonWhitespace]))
  return `${percent(weighted.ratio)} | ${percent(nonWhitespace.ratio)} | ${percent(mean(agreements.map(agreement => agreement.all.ratio)))} | ${weighted.matching}/${weighted.comparable}`
}

type Compared = BaselineComparison & { readonly comparison: Extract<Comparison, { comparable: true }> }
const completed = (rows: readonly BaselineComparison[]): Compared[] => rows.filter((row): row is Compared => row.comparison.comparable)

function languageGroups(rows: readonly BaselineComparison[]): Map<string, BaselineComparison[]> {
  const groups = new Map<string, BaselineComparison[]>()
  for (const row of rows) {
    const key = `${row.baseline} | ${row.reference} | ${row.input.lane} | ${row.input.languageId}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return groups
}

function scopeTable(rows: readonly BaselineComparison[]): string[] {
  return [
    '| Baseline | Reference | Corpus | Language | Compared / inputs | Scope all | Scope non-whitespace | File macro | Matching / comparable UTF-16 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...[...languageGroups(rows)].map(([key, values]) => {
      const compared = completed(values)
      return `| ${key} | ${compared.length}/${values.length} | ${aggregate(compared.map(row => row.comparison.scopes.agreement))} |`
    }),
  ]
}

function styleTable(rows: readonly BaselineComparison[]): string[] {
  const lines = [
    '| Baseline | Reference | Corpus | Language | Theme | Compared | Style all | Style non-whitespace | File macro | Matching / comparable UTF-16 | Foreground mismatch | Font-style mismatch |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const [key, values] of languageGroups(rows)) {
    for (const theme of ORACLE_THEMES) {
      const styles = completed(values).flatMap(row => {
        const outcome = row.comparison.styles[theme]
        return outcome?.compared ? [outcome.report] : []
      })
      lines.push(`| ${key} | ${theme} | ${styles.length} | ${aggregate(styles.map(style => style.agreement))} | ${styles.reduce((sum, style) => sum + style.fields.foreground.units, 0)} | ${styles.reduce((sum, style) => sum + style.fields.fontStyle.units, 0)} |`)
    }
  }
  return lines
}

function categoryTable(rows: readonly BaselineComparison[]): string[] {
  const lines = ['| Baseline | Reference | Corpus | Language | Category | Runs | UTF-16 units |', '| --- | --- | --- | --- | --- | ---: | ---: |']
  for (const [key, values] of languageGroups(rows)) {
    const totals = new Map<string, { count: number; units: number }>()
    for (const row of completed(values)) {
      for (const [category, value] of Object.entries(row.comparison.scopes.categories)) {
        const prior = totals.get(category) ?? { count: 0, units: 0 }
        totals.set(category, { count: prior.count + value.count, units: prior.units + value.units })
      }
    }
    for (const [category, total] of totals) {
      if (total.units > 0) lines.push(`| ${key} | ${category} | ${total.count} | ${total.units} |`)
    }
  }
  return lines
}

function mismatchTable(rows: readonly BaselineComparison[]): string[] {
  const runs = completed(rows).flatMap(row => row.comparison.scopes.mismatches.runs.map(run => ({ row, run })))
  runs.sort((a, b) => (b.run.to - b.run.from) - (a.run.to - a.run.from) || compareText(a.row.baseline, b.row.baseline) || compareText(a.row.reference, b.row.reference) || compareText(a.row.input.fixtureId, b.row.input.fixtureId) || a.run.from - b.run.from)
  return [
    '| Baseline | Reference | Fixture | Range | Category | Reference path | Candidate path |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...runs.slice(0, 30).map(({ row, run }) => `| ${row.baseline} | ${row.reference} | ${cell(row.input.fixtureId)} | [${run.from}, ${run.to}) | ${run.category} | ${cell(run.reference.join(' '))} | ${cell(run.candidate.join(' '))} |`),
  ]
}

export async function buildBaselineReport(root = GOLDEN_ROOT): Promise<string> {
  const { comparisons, queries } = await baselineComparisons(root)
  const inputs = corpusInputs()
  const incomplete = comparisons.filter(row => !row.comparison.comparable)
  const unsupported = [...new Set(incomplete.map(row => `${row.baseline} / ${row.input.languageId}: ${baselineSupport(row.baseline, row.input.languageId) ?? 'reference or candidate failed'}`))]
  const complete = completed(comparisons)
  return [
    '# Diagnostic capture baselines', '',
    'These are candidate profiles, never goldens. Scope names, ancestor paths, ordering and punctuation are scored by the unchanged harness comparator. Styles use the pinned TextMate Theme matcher with each reference’s own theme normalization. Feeding reference scopes through that matcher is independently checked against direct reference styles in tests/baseline-theme.test.ts.', '',
    `Coverage denominators: 242 product catalog languages, 23 structural languages, 5 pinned pilot parser variants; ${inputs.filter(input => input.lane === 'real').length} real source fixtures and ${inputs.filter(input => input.lane === 'original').length} original adversarial fixtures. ${complete.length}/${comparisons.length} baseline × reference × fixture comparisons complete. Unsupported cases never enter agreement denominators. Per-theme denominators are shown in UTF-16 units. Empty denominators are N/A.`, '',
    'Real and original corpora are scored separately so the long-line cap fixtures cannot hide small real-file failures. All-text and non-whitespace metrics are length weighted. File macro averages give each comparable nonempty file equal weight. Metadata is N/A because raw and product expose no metadata track. Background is outside both reference token-style contracts. Styles distinguish absent fields and explicit resets without changing comparator rules.', '',
    '## Composition and scope mapping', '',
    'baseline:captures uses capture-map-1 in src/baselines/capture-map.ts. baseline:vscode-ts uses the capture names verbatim from VS Code f39c7109bf651845855cbef5af2e91b2c9bd0a74. Both parse with lib/binding_web built from this checkout, not an npm runtime. Vendored parser and query bytes are tested against manifest/tree-sitter-languages.json; the VS Code query hash is pinned separately.', '',
    'Composition sweeps capture endpoints. The root scope comes first. Active captures sort by start ascending, end descending (enclosing first), accepted query-pattern index ascending, declared capture-name ordinal ascending, then code-point capture name. Query match enumeration never decides a tie. Coincident captures and duplicates are retained. Crossing intervals use the same order. Every LF or CRLF terminator has an empty path and empty style; a lone CR remains text. Transparent embedded captures add no scope. These baselines use the outer parser tree only. Injections and local-variable analysis are not implemented.', '',
    '## Query compatibility and operation inventory', '',
    'The web binding evaluates eq?, not-eq?, match? and their quantified variants, plus any-of? and not-any-of?. Text predicates use the binding’s JavaScript regex dialect. Any unknown predicate or directive throws. No selected query uses a directive. #is-not? local is returned as metadata by the binding, not evaluated. Every affected pattern is explicitly excluded below; these query remainders are partial diagnostic baselines.', '',
    ...[...queries].flatMap(([key, evidence]) => [
      `### ${key}`, '', `Accepted ${evidence.accepted}/${evidence.patterns} patterns. Operations: ${evidence.operations.join(', ') || 'none'}.`, '',
      ...(evidence.exclusions.length === 0 ? ['No excluded patterns.'] : evidence.exclusions.map(reason => `- ${reason}`)), '',
    ]),
    '## Exact scope-path agreement', '', ...scopeTable(comparisons), '',
    '## Style agreement by theme', '', ...styleTable(comparisons), '',
    '## Scope mismatch categories', '', ...categoryTable(comparisons), '',
    '## Longest scope mismatch runs', '', ...mismatchTable(comparisons), '',
    '## Unsupported and failed cases', '', ...unsupported.map(reason => `- ${reason}`), '',
    `Non-complete case count is ${incomplete.length}. The table below accounts for each fixture and reference.`, '',
    '| Baseline | Reference | Fixture | Outcome |', '| --- | --- | --- | --- |',
    ...incomplete.map(row => `| ${row.baseline} | ${row.reference} | ${cell(row.input.fixtureId)} | ${row.comparison.comparable ? '' : cell(row.failure ?? row.comparison.reason)} |`), '',
    'Markdown identities stay at the manifest’s tree-sitter-md 0.1.1 (ff455a7d). Platform has since moved to 0.1.2. The manifest configures a native MarkdownDocument extension and no highlights.scm or markdown_inline parser. Both grammar and resolver Wasm are vendored byte-exact with their upstream notices; ordinary-capture Markdown is explicitly unsupported.', '',
    'Regenerate with `npm run report:baselines`. No candidate result is ever passed to golden:update.', '',
  ].join('\n')
}
