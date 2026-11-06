import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ResultBuilder } from './build.ts';
import { corpusInputs } from './corpus.ts';
import type { CorpusInput } from './corpus.ts';
import { GOLDEN_ROOT, goldenPath } from './golden.ts';
import { parseResultText } from './serialize.ts';
import { parseResult } from './validate.ts';
import { compareResults } from './compare.ts';
import type { Comparison, Agreement, ScopeRun } from './compare.ts';
import type { DocumentResult } from './schema.ts';
import { isWhitespaceUnit, sourceSha256 } from './source.ts';
import { baselineScopes, baselineSupport } from './baselines/run.ts';
import type { BaselineId } from './baselines/run.ts';
import { paintScopes } from './baselines/theme.ts';
import type { StyleReference } from './baselines/theme.ts';
import { loadLanguagePack, NATIVE_LANGUAGES } from './native/packs.ts';
import { nativeDocument } from './native/adapter.ts';
import { PilotDocument } from './native/owner.ts';
import { MarkdownPilotDocument } from './native/markdown.ts';
import { checkMarkdownAssets, MARKDOWN_COMMIT } from './native/markdown-assets.ts';
import type { NativePack } from './native/component.ts';
import { explainDocument } from './native/evidence.ts';
import type { IntervalEvidence } from './native/evidence.ts';

type Reference = StyleReference | 'shiki-api' | 'product:warm';
type Candidate = 'native' | BaselineId;
const BASELINES: readonly BaselineId[] = ['baseline:captures', 'baseline:vscode-ts'];
const REFERENCES: readonly Reference[] = ['raw', 'product', 'shiki-api'];
export interface ScoreInput { readonly units: number; readonly nonWhitespace: number; readonly matching?: number; readonly matchingNonWhitespace?: number }
export interface Score { readonly matching: number; readonly units: number; readonly matchingNonWhitespace: number; readonly nonWhitespace: number; readonly macro: number | null }
export function unionScore(rows: readonly ScoreInput[]): Score {
  const nonempty = rows.filter(row => row.units > 0);
  return {
    matching: rows.reduce((sum, row) => sum + (row.matching ?? 0), 0), units: rows.reduce((sum, row) => sum + row.units, 0),
    matchingNonWhitespace: rows.reduce((sum, row) => sum + (row.matchingNonWhitespace ?? 0), 0), nonWhitespace: rows.reduce((sum, row) => sum + row.nonWhitespace, 0),
    macro: nonempty.length ? nonempty.reduce((sum, row) => sum + (row.matching ?? 0) / row.units, 0) / nonempty.length : null,
  };
}
export function strictlyImproves(native: Score, baseline: Score): boolean {
  return native.units > 0 && native.nonWhitespace > 0 && native.units === baseline.units && native.nonWhitespace === baseline.nonWhitespace &&
    native.matching > baseline.matching && native.matchingNonWhitespace > baseline.matchingNonWhitespace;
}
export function reportIdentity(inputs: Readonly<Record<string, string>>): string {
  const entries = Object.entries(inputs); entries.sort(([a], [b]) => a < b ? -1 : Number(a > b));
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
interface FixtureResult {
  readonly input: CorpusInput;
  readonly native: ReadonlyMap<StyleReference, DocumentResult>;
  readonly baselines: ReadonlyMap<BaselineId, ReadonlyMap<StyleReference, DocumentResult>>;
  readonly explain: readonly IntervalEvidence[];
  readonly children: readonly { readonly start: number; readonly end: number; readonly languageId: string }[];
  readonly observations: string;
}
interface Row {
  readonly fixture: FixtureResult; readonly reference: Reference; readonly truth: DocumentResult;
  readonly candidate: Candidate; readonly result: DocumentResult; readonly comparison: Comparison;
  readonly union: boolean;
}
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const cell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', '\\n').replaceAll('\r', '\\r');
const percent = (numerator: number, denominator: number): string => denominator ? `${(100 * numerator / denominator).toFixed(2)}%` : 'N/A';
const macro = (value: number | null): string => value === null ? 'N/A' : `${(100 * value).toFixed(2)}%`;
const scoreText = (score: Score): string => `${percent(score.matching, score.units)} | ${percent(score.matchingNonWhitespace, score.nonWhitespace)} | ${macro(score.macro)} | ${score.matching}/${score.units} | ${score.matchingNonWhitespace}/${score.nonWhitespace}`;

async function nativeFixture(input: CorpusInput, packs: ReadonlyMap<string, NativePack>): Promise<Pick<FixtureResult, 'native' | 'explain' | 'children' | 'observations'>> {
  if (input.languageId === 'markdown') {
    const owner = await MarkdownPilotDocument.open(input.source);
    try {
      return { native: new Map([['raw', await owner.document(packs, 'raw')], ['product', await owner.document(packs, 'product')]]),
        explain: await owner.explanations(packs), children: owner.children, observations: JSON.stringify(owner.observation).concat(' ', owner.diagnostics.join('; ')) };
    } finally { owner.dispose(); }
  }
  const pack = packs.get(input.languageId);
  if (!pack) {
    const result = new ResultBuilder({ profileId: 'native', languageId: input.languageId }, input.source).incomplete('unsupported', `${input.languageId}: distinct variant, no native pack in the pilot (Phase 5)`);
    return { native: new Map([['raw', result], ['product', result]]), explain: [], children: [], observations: 'deferred' };
  }
  const owner = await PilotDocument.open(input.languageId, input.source);
  try {
    return { native: new Map([['raw', await nativeDocument(pack, owner, 'raw')], ['product', await nativeDocument(pack, owner, 'product')]]),
      explain: await explainDocument(pack, owner), children: [], observations: 'existing immutable tree; component imports prohibit parsing' };
  } finally { owner.dispose(); }
}
async function baselineFixture(input: CorpusInput, baseline: BaselineId): Promise<ReadonlyMap<StyleReference, DocumentResult>> {
  const reason = baselineSupport(baseline, input.languageId);
  const builder = new ResultBuilder({ profileId: baseline, languageId: input.languageId }, input.source);
  if (reason) { const result = builder.incomplete('unsupported', reason); return new Map([['raw', result], ['product', result]]); }
  try {
    const scopes = await baselineScopes(baseline, input.languageId, input.source);
    return new Map([['raw', await paintScopes(baseline, input.languageId, input.source, scopes.intervals, 'raw', scopes.engine, scopes.evidence.exclusions)],
      ['product', await paintScopes(baseline, input.languageId, input.source, scopes.intervals, 'product', scopes.engine, scopes.evidence.exclusions)]]);
  } catch (error) {
    const result = builder.incomplete('error', message(error));
    return new Map([['raw', result], ['product', result]]);
  }
}
async function collectFixture(input: CorpusInput, packs: ReadonlyMap<string, NativePack>): Promise<FixtureResult> {
  let native: Awaited<ReturnType<typeof nativeFixture>>;
  try { native = await nativeFixture(input, packs); }
  catch (error) {
    const result = new ResultBuilder({ profileId: 'native', languageId: input.languageId }, input.source).incomplete('error', message(error));
    native = { native: new Map([['raw', result], ['product', result]]), explain: [], children: [], observations: message(error) };
  }
  const baselines = new Map<BaselineId, ReadonlyMap<StyleReference, DocumentResult>>();
  for (const baseline of BASELINES) baselines.set(baseline, await baselineFixture(input, baseline));
  for (const result of native.native.values()) parseResult(result, input.source);
  return { input, ...native, baselines };
}
function requiredResult(map: ReadonlyMap<StyleReference, DocumentResult>, style: StyleReference): DocumentResult {
  const result = map.get(style); if (!result) throw new Error('Missing candidate result'); return result;
}
function rowsFor(fixture: FixtureResult, root: string): Row[] {
  const profiles = fixture.input.languageId === 'markdown' ? REFERENCES.concat(['product:warm']) : REFERENCES;
  return profiles.flatMap(reference => {
    const truth = parseResultText(readFileSync(goldenPath(root, reference, fixture.input.languageId, fixture.input.fixtureId), 'utf8'), fixture.input.source);
    const style = reference === 'raw' ? 'raw' : 'product';
    const candidates: { candidate: Candidate; result: DocumentResult }[] = [{ candidate: 'native', result: requiredResult(fixture.native, style) }];
    for (const [candidate, results] of fixture.baselines) candidates.push({ candidate, result: requiredResult(results, style) });
    const union = truth.status === 'complete' && candidates.some(item => item.result.status === 'complete');
    return candidates.map(({ candidate, result }) => ({ fixture, reference, candidate, truth, result, union,
      comparison: compareResults(truth, result, { source: fixture.input.source, maxRuns: Number.MAX_SAFE_INTEGER }) }));
  });
}
function scoreRow(row: Row, agreement?: Agreement): ScoreInput | undefined {
  if (!row.union) return undefined;
  if (row.candidate !== 'native' && baselineSupport(row.candidate, row.fixture.input.languageId)) return undefined;
  const source = row.fixture.input.source;
  return { units: source.length, nonWhitespace: nonWhitespaceUnits(source),
    ...(agreement ? { matching: agreement.all.matching, matchingNonWhitespace: agreement.nonWhitespace?.matching ?? 0 } : {}) };
}
function nonWhitespaceUnits(source: string): number {
  let units = 0;
  for (let index = 0; index < source.length; index++) units += Number(!isWhitespaceUnit(source.charCodeAt(index)));
  return units;
}
function scoreRows(rows: readonly Row[], theme?: string): Score {
  return unionScore(rows.flatMap(row => {
    const comparison = row.comparison;
    const style = comparison.comparable && theme ? comparison.styles[theme] : undefined;
    const agreement = comparison.comparable && !theme ? comparison.scopes.agreement : style?.compared ? style.report.agreement : undefined;
    const value = scoreRow(row, agreement); return value ? [value] : [];
  }));
}
function groups(rows: readonly Row[]): ReadonlyMap<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.fixture.input.languageId} | ${row.reference} | ${row.fixture.input.lane}`;
    const list = result.get(key) ?? []; list.push(row); result.set(key, list);
  }
  return result;
}
function scopeTable(rows: readonly Row[]): string[] {
  const lines = ['| Language | Reference | Lane | Candidate | Complete / inputs | All | Non-whitespace | File macro | Matching / union | Non-whitespace matching / union |', '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const [group, values] of groups(rows)) {
    for (const candidate of ['native', 'baseline:captures', 'baseline:vscode-ts']) {
      const selected = values.filter(row => row.candidate === candidate);
      lines.push(`| ${group} | ${candidate} | ${selected.filter(row => row.result.status === 'complete').length}/${selected.length} | ${scoreText(scoreRows(selected))} |`);
    }
  }
  return lines;
}
function failingCells(rows: readonly Row[]): string[] {
  const failures: string[] = [];
  for (const [key, values] of groups(rows)) {
    const first = values[0];
    if (!NATIVE_LANGUAGES.some(id => id === first.fixture.input.languageId) || !['raw', 'product'].includes(first.reference)) continue;
    for (const baseline of BASELINES) {
      if (baselineSupport(baseline, first.fixture.input.languageId)) continue;
      if (!strictlyImproves(scoreRows(values.filter(row => row.candidate === 'native')), scoreRows(values.filter(row => row.candidate === baseline)))) failures.push(`${key} versus ${baseline}`);
    }
  }
  return failures;
}
function styleTable(rows: readonly Row[]): string[] {
  const lines = ['| Language | Reference | Lane | Candidate | Theme | All | Non-whitespace | File macro | Matching / union | Non-whitespace matching / union |', '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |'];
  for (const [key, values] of groups(rows.filter(row => row.reference === 'raw' || row.reference === 'product'))) {
    const themes = Array.from(new Set(values.flatMap(row => Object.keys(row.truth.status === 'complete' ? row.truth.styles ?? {} : {}))));
    for (const theme of themes) lines.push(...candidateStyles(key, values, theme));
  }
  return lines;
}
function candidateStyles(key: string, rows: readonly Row[], theme: string): string[] {
  return ['native', 'baseline:captures', 'baseline:vscode-ts'].map(candidate => `| ${key} | ${candidate} | ${theme} | ${scoreText(scoreRows(rows.filter(row => row.candidate === candidate), theme))} |`);
}
function regressions(rows: readonly Row[]): string[] {
  const lines = ['| Language | Reference | Lane | Fixture | Baseline | Native matching | Baseline matching | Union units |', '| --- | --- | --- | --- | --- | ---: | ---: | ---: |'];
  for (const row of rows.filter(row => row.candidate === 'native' && row.union)) {
    const siblings = rows.filter(other => other.fixture === row.fixture && other.reference === row.reference && other.candidate !== 'native');
    lines.push(...siblings.flatMap(other => regression(row, other)));
  }
  return lines;
}
function regression(row: Row, baseline: Row): string[] {
  if (baselineSupport(baseline.candidate === 'baseline:vscode-ts' ? 'baseline:vscode-ts' : 'baseline:captures', row.fixture.input.languageId)) return [];
  const native = scoreRows([row]), score = scoreRows([baseline]);
  if (native.matching >= score.matching && native.matchingNonWhitespace >= score.matchingNonWhitespace) return [];
  return [`| ${row.fixture.input.languageId} | ${row.reference} | ${row.fixture.input.lane} | ${row.fixture.input.fixtureId} | ${baseline.candidate} | ${native.matching}, non-whitespace ${native.matchingNonWhitespace} | ${score.matching}, non-whitespace ${score.matchingNonWhitespace} | ${native.units} |`];
}
function categoryTable(rows: readonly Row[]): string[] {
  const lines = ['| Language | Reference | Lane | Category | Runs | Units |', '| --- | --- | --- | --- | ---: | ---: |'];
  for (const [key, values] of groups(rows.filter(row => row.candidate === 'native'))) {
    const counts = new Map<string, { count: number; units: number }>();
    for (const row of values) addCategories(counts, row.comparison);
    for (const [category, tally] of counts) lines.push(`| ${key} | ${category} | ${tally.count} | ${tally.units} |`);
  }
  return lines;
}
function addCategories(counts: Map<string, { count: number; units: number }>, comparison: Comparison): void {
  if (!comparison.comparable) return;
  for (const [category, tally] of Object.entries(comparison.scopes.categories)) {
    if (!tally.units) continue;
    const prior = counts.get(category) ?? { count: 0, units: 0 };
    counts.set(category, { count: prior.count + tally.count, units: prior.units + tally.units });
  }
}
interface Example { readonly row: Row; readonly run: ScopeRun }
function examples(rows: readonly Row[]): string[] {
  const minimum = new Map<string, Example>();
  for (const row of rows.filter(row => row.candidate === 'native')) {
    if (row.comparison.comparable) collectExamples(minimum, row, row.comparison.scopes.mismatches.runs);
  }
  return Array.from(minimum, ([key, example]) => renderExample(key, example)).flat();
}
function collectExamples(minimum: Map<string, Example>, row: Row, runs: readonly ScopeRun[]): void {
  for (const run of runs) {
    const key = `${row.fixture.input.languageId} / ${row.reference} / ${row.fixture.input.lane} / ${run.category}`;
    const prior = minimum.get(key);
    if (!prior || run.to - run.from < prior.run.to - prior.run.from) minimum.set(key, { row, run });
  }
}
function renderExample(key: string, { row, run }: Example): string[] {
  const source = row.fixture.input.source, before = source.slice(0, run.from);
  const line = before.split('\n').length, column = run.from - before.lastIndexOf('\n');
  const intervals = row.fixture.explain.filter(item => item.from < run.to && item.to > run.from);
  return [`### ${key}`, '', `${row.fixture.input.fixtureId}:${line}:${column}, [${run.from}, ${run.to}), excerpt ${JSON.stringify(source.slice(run.from, Math.min(run.to, run.from + 80)))}`, '',
    `Reference: ${run.reference.join(' ') || '(empty)'}`, '', `Native: ${run.candidate.join(' ') || '(empty)'}`, '',
    ...(intervals.length ? intervals.map(item => `- [${item.from}, ${item.to}) ${item.scope}, pattern ${item.pattern}, ${item.capture}, priority ${item.priority}, ${item.disposition}, ${item.location}`) : ['No native interval covers this mismatch. Markdown parent and fence-frame mapping is outside the child scope pack.']), ''];
}
function markdownTable(rows: readonly Row[]): string[] {
  const lines = ['| Fixture | Reference | Region | Matching / units | Non-whitespace matching / units |', '| --- | --- | --- | ---: | ---: |'];
  for (const row of rows.filter(row => row.candidate === 'native' && row.fixture.input.languageId === 'markdown')) {
    if (!row.comparison.comparable) continue;
    const regions = regionScores(row);
    lines.push(...regions.map(([name, score]) => `| ${row.fixture.input.fixtureId} | ${row.reference} | ${name} | ${score.matching}/${score.units} | ${score.matchingNonWhitespace}/${score.nonWhitespace} |`));
  }
  return lines;
}
function regionScores(row: Row): readonly (readonly [string, Score])[] {
  const inputs: ScoreInput[][] = [[], []];
  const comparison = row.comparison;
  if (!comparison.comparable) return [];
  const mismatches = comparison.scopes.mismatches.runs;
  for (let offset = 0; offset < row.fixture.input.source.length; offset++) {
    const child = row.fixture.children.some(child => offset >= child.start && offset < child.end);
    const nonWhitespace = Number(!isWhitespaceUnit(row.fixture.input.source.charCodeAt(offset)));
    const matching = Number(!mismatches.some(run => offset >= run.from && offset < run.to));
    inputs[child ? 0 : 1].push({ units: 1, nonWhitespace, matching, matchingNonWhitespace: matching * nonWhitespace });
  }
  return [['recognized fence content', unionScore(inputs[0])], ['markdown parent outside the pilot', unionScore(inputs[1])]];
}

export async function buildNativeReport(root = GOLDEN_ROOT): Promise<string> {
  const packs = new Map<string, NativePack>();
  try {
    for (const id of NATIVE_LANGUAGES) packs.set(id, await loadLanguagePack(id));
    const inputs = corpusInputs().filter(input => ['json', 'typescript', 'tsx', 'markdown', 'javascript', 'jsx'].includes(input.languageId));
    const fixtures: FixtureResult[] = [];
    for (const input of inputs) fixtures.push(await collectFixture(input, packs));
    const rows = fixtures.flatMap(fixture => rowsFor(fixture, root));
    const failures = failingCells(rows), identities = await checkMarkdownAssets();
    const identity = Object.fromEntries(Array.from(packs, ([id, pack]) => [id, JSON.stringify(pack.engine)]));
    identity.markdown = JSON.stringify(identities); identity.markdownCommit = MARKDOWN_COMMIT;
    identity.packManifests = reportIdentity(Object.fromEntries(NATIVE_LANGUAGES.map(id => [id,
      readFileSync(new URL(`../../../lib/scope-compat/packs/${id}/pack.json`, import.meta.url), 'utf8')])));
    identity.corpus = reportIdentity(Object.fromEntries(inputs.map(input => [`${input.languageId}/${input.fixtureId}`, sourceSha256(input.source)])));
    identity.references = reportIdentity(Object.fromEntries(rows.filter(row => row.candidate === 'native').map(row => [`${row.reference}/${row.fixture.input.languageId}/${row.fixture.input.fixtureId}`, reportIdentity({ result: JSON.stringify(row.truth) })])));
    identity.baselines = reportIdentity(Object.fromEntries(rows.filter(row => row.candidate !== 'native').map(row => [
      `${row.candidate}/${row.reference}/${row.fixture.input.languageId}/${row.fixture.input.fixtureId}`, JSON.stringify(row.result.engine)])));
    return renderReport(rows, fixtures, failures, identity);
  } finally { for (const pack of packs.values()) pack.dispose(); }
}
function renderReport(rows: readonly Row[], fixtures: readonly FixtureResult[], failures: readonly string[], identity: Readonly<Record<string, string>>): string {
  return ['# Native scope pilot candidate report', '',
    'Limited experiment. This report is candidate evidence and never a golden. Phase 2 acceptance remains OPEN until safety/schema CI and every strict improvement cell pass. No performance benefit or consumer cutover is claimed.', '',
    `Stable report input identity: ${reportIdentity(identity)}. Identity uses runtime/artifact/input content hashes and never moving Git HEAD.`, '',
    '## Identities', '', ...Object.entries(identity).map(([key, value]) => `- ${key}: ${value}`), '',
    '## Coverage and limits', '',
    'One bounded pack-authoring round. JSON is the unchanged PR A pack; TypeScript and TSX are explicit variants. JavaScript and JSX are distinct deferred variants. Regex predicates, local analysis, documentation-comment specialization and contextual all-caps naming are deferred. Unsupported operators fail pack load; they are never silently skipped. Markdown uses current consumer Git pin f02e277, package version 0.1.32 plus unreleased changes, flags 3. The historical 0.1.1 baseline is unchanged.', '',
    '| Language | Inputs | Complete | Unsupported | Error | Timeout |', '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...['json', 'typescript', 'tsx', 'markdown', 'javascript', 'jsx'].map(id => coverage(fixtures, id)), '',
    'Scope tables use the unchanged raw, product and shiki-api reference scopes; shiki-api is scope-only. Markdown product:warm remains separate from cold product and raw. Styles use each raw/product reference matcher and theme normalization unchanged, and are reported rather than gated. A union includes a reference-complete file when any applicable candidate completed it. An incomplete native or applicable baseline receives zero matching units on that same union, including per-file macro. Baselines outside their declared language support are N/A, including both Markdown baselines. Reference failures and files all candidates fail have no comparable truth/output and are listed explicitly. Empty denominators are N/A.', '',
    '## Exact scope agreement on common union denominators', '', ...scopeTable(rows), '',
    '## Style agreement by theme', '', ...styleTable(rows), '',
    '## Per-file regressions', '', ...regressions(rows), '',
    '## Mismatch categories', '', ...categoryTable(rows), '',
    '## Smallest mismatch in each category and language/profile/lane cell', '', ...examples(rows), '',
    '## Markdown regions and observations', '', ...markdownTable(rows), '',
    ...fixtures.filter(fixture => fixture.input.languageId === 'markdown').map(fixture => `- ${fixture.input.fixtureId}: ${fixture.observations}; child ranges ${JSON.stringify(fixture.children)}.`), '',
    'Parser.prototype.parse and tsmd_set_text are observed separately in native-markdown-worker.ts. A positive baseline parse arms the parser observer; a fresh-process first use parses each recognized child once, a scope pass adds zero parses, and warm repetition matches decoded output. The focused runtime allocator plus core allocator fixture has retained resolver, child and TextBuffer positive controls and construction-unwind tests. Component block count alone is not ownership evidence.', '',
    '## Incomplete comparisons', '', '| Candidate | Language | Reference | Lane | Fixture | State | Reason |', '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.filter(row => !row.comparison.comparable).map(row => `| ${row.candidate} | ${row.fixture.input.languageId} | ${row.reference} | ${row.fixture.input.lane} | ${row.fixture.input.fixtureId} | ${row.result.status} | ${cell(row.result.diagnostics.join('; ') || (row.comparison.comparable ? '' : row.comparison.reason))} |`), '',
    '## Implementation and acceptance', '',
    '- Component build, CI and sanitizer command are PR A; merge approval and green CI are independent prerequisites for PR B.',
    '- Native pack output, Markdown mapping/ownership and zero-extra-parse controls are implemented. Executed verification and independent review/CI state belong in impl-007b/REPORT.md, not this byte-compared candidate artifact.',
    '- This report is generated by report:native and checked by report:native -- --check. Goldens and artifacts:check are unchanged.', '',
    `Strict improvement cells failing: ${failures.length}. Each raw/product language/lane cell must improve both all-text and non-whitespace agreement over each applicable named baseline. Ties fail. Empty cells are N/A and cannot establish acceptance.`, '',
    ...failures.map(key => `- ${key}`), '',
    `Phase 2 acceptance: ${failures.length ? 'OPEN, limited experiment; numerical gate failed.' : 'OPEN pending independently approved safety/schema CI.'}`, '',
    'Regenerate with npm run report:native. At most two productive pack rounds were authorized; no parity tuning, fixture changes, denominator changes or golden changes were used.', ''].join('\n');
}
function coverage(fixtures: readonly FixtureResult[], language: string): string {
  const results = fixtures.filter(fixture => fixture.input.languageId === language).map(fixture => requiredResult(fixture.native, 'product'));
  return `| ${language} | ${results.length} | ${['complete', 'unsupported', 'error', 'timeout'].map(status => results.filter(result => result.status === status).length).join(' | ')} |`;
}
