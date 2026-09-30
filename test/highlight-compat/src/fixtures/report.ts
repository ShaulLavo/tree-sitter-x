import { readFileSync } from 'node:fs'
import { buildRegistry } from './generate.ts'
import { harnessRoot } from './manifest.ts'
import type { FixtureManifest } from './manifest.ts'
import { adaptVscode } from './vscode.ts'
import { adaptTypescript } from './typescript.ts'
import { adaptTreeSitter } from './tree-sitter.ts'

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

export function fixtureReport(manifest: FixtureManifest): string {
  const { fixtures, artifacts } = buildRegistry(manifest)
  const assets = JSON.parse(readFileSync(new URL('manifest/assets.json', harnessRoot), 'utf8')) as { grammars: { name: string; public: boolean }[] }
  const languages = assets.grammars.filter(grammar => grammar.public).map(grammar => grammar.name).sort()
  const read = (path: string): string => readFileSync(new URL(path, harnessRoot), 'utf8')
  const textmateCounts = new Map<string, number>()
  let captureCount = 0
  for (const artifact of artifacts) {
    const fixture = fixtures.find(fixture => fixture.id === artifact.sourceFixtureId)!
    if (artifact.format === 'tree-sitter-highlight') captureCount += adaptTreeSitter(read(fixture.path), fixture.id, fixture.path).length
    if (artifact.format === 'vscode-colorize') {
      const count = adaptVscode(read(fixture.path), read(artifact.path), fixture.id, artifact.path).length
      textmateCounts.set(artifact.family, (textmateCounts.get(artifact.family) ?? 0) + count)
    }
    if (artifact.format === 'typescript-baseline') {
      const sections = adaptTypescript(read(fixture.path), read(artifact.path), fixture.id, artifact.path)
      const count = sections.reduce((count, section) => count + section.expectations.length, 0)
      textmateCounts.set(artifact.family, (textmateCounts.get(artifact.family) ?? 0) + count)
    }
  }
  const primary = manifest.sources.flatMap(source => source.fileIds.map(id => ({ source, file: manifest.files.find(file => file.id === id)! })))
  const skipped = primary.filter(({ file }) => file.decision === 'skip')
  const deferred = primary.filter(({ source, file }) => source.family === 'vscode-textmate' && file.decision === 'fetch-by-hash')
  const rows = [
    '# Fixture coverage', '',
    `${languages.length} catalog languages; ${fixtures.length} runnable source fixtures; ${artifacts.length} vendored primary artifacts; ${skipped.length} skipped primary artifacts.`, '',
    'Runnable means a cleared, locally available input. It makes no reference-completeness, native-support, or comparison-success claim.', '',
    '## Selection accounting', '',
    `The manifest selects ${manifest.counts.selectedCandidatePrimaryArtifactFiles} primary artifacts. This registry holds ${artifacts.length}. The following ${deferred.length} oracle-suite artifacts belong to L2, together with the 67 selected dependencies.`, '',
    ...deferred.map(({ file }) => `- \`${file.id}\`. Deferred to the oracle-conformance vendor registry.`), '',
    'The 27 artifacts comprise 16 source inputs and 11 stored expectations. Source fixtures are deduplicated by SHA-256. Stored expectation bytes are distinct artifacts linked to a source fixture.', '',
    '## Lane and split denominators', '',
    '| Lane | Development sources | Evaluation sources | Stored artifacts |',
    '| --- | ---: | ---: | ---: |',
    ...['language-regression', 'annotated-expectation', 'catalog-smoke', 'adversarial', 'held-out'].map(lane => {
      const development = fixtures.filter(fixture => fixture.lane === lane && fixture.split === 'development').length
      const evaluation = fixtures.filter(fixture => fixture.lane === lane && fixture.split === 'evaluation').length
      const stored = artifacts.filter(artifact => artifact.lane === lane && !fixtures.some(fixture => fixture.id === artifact.id)).length
      return `| ${lane} | ${development} | ${evaluation} | ${stored} |`
    }), '',
    'All selected inputs are development data. No selected, licence-cleared held-out corpus exists in this manifest. Evaluation has zero fixtures; hash disjointness is enforced but makes no generalization claim. L2 owns adversarial originals, outside this registry.', '',
    '## Expectation denominators', '',
    '| Family | TextMate position expectations | Capture position expectations |',
    '| --- | ---: | ---: |',
    `| vscode-colorize | ${textmateCounts.get('vscode-colorize') ?? 0} | 0 |`,
    `| typescript-tmlanguage | ${textmateCounts.get('typescript-tmlanguage') ?? 0} | 0 |`,
    '| textmate-grammars-themes | 0 | 0 |',
    `| tree-sitter-highlight | 0 | ${captureCount} |`,
    '| tmgrammar | 0 | 0 |', '',
    'tmgrammar has synthetic format tests only. No selected fixture uses that format. TypeScript section counts include each named grammar separately; the loader preserves section identity.', '',
    'Historical VS Code captures and TypeScript baselines are diagnostic. Generated-against revisions are unstamped (null) in the inventory. Registry provenance separately records inspected checkout, upstream grammar metadata, grammar hash, product revision, and product grammar hash. No historical expectation is a product golden.', '',
    'The two stored VS Code Tree-sitter captures are byte-verified diagnostic artifacts. They lack source positions and omit uncaptured text, so this lane does not infer positions by searching token text. The five annotated Tree-sitter inputs supply the capture expectations. Capture names never count as TextMate scopes.', '',
    '## Runnable fixtures per catalog language', '',
    '| Language | Runnable sources |', '| --- | ---: |',
    ...languages.map(language => `| ${language} | ${fixtures.filter(fixture => fixture.languageId === language).length} |`), '',
    '## Vendored artifacts by family', '', '| Family | Source inputs | Stored expectations | Licence |', '| --- | ---: | ---: | --- |',
    ...[...new Set(artifacts.map(artifact => artifact.family))].sort().map(family => {
      const sources = fixtures.filter(fixture => fixture.family === family).length
      return `| ${family} | ${sources} | ${artifacts.filter(artifact => artifact.family === family).length - sources} | MIT; per-file notices in fixtures/${family}/NOTICE |`
    }), '',
    '## Skipped primary files', '',
    'Each inventory exclusion remains visible. Empty snapshots, permission gaps and unreviewed files contribute no runnable fixture.', '',
    '| Source set | Upstream file | Reason |', '| --- | --- | --- |',
    ...skipped.map(({ source, file }) => `| ${cell(source.id)} | ${cell(file.path)} | ${cell(file.decisionReason ?? 'No reason recorded')} |`), '',
  ]
  return rows.join('\n')
}
