import { readFileSync } from 'node:fs'
import { buildRegistry } from './generate.ts'
import { harnessRoot } from './manifest.ts'
import type { FixtureManifest } from './manifest.ts'
import { adaptVscode } from './vscode.ts'
import { adaptTypescript } from './typescript.ts'
import { commentMetadata } from './comment-nodes.ts'
import { fixtureComments } from './comments.ts'
import { adaptTreeSitter } from './tree-sitter.ts'

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('\n', ' ')

export function fixtureReport(manifest: FixtureManifest, read: (path: string) => string = path => readFileSync(new URL(path, harnessRoot), 'utf8')): string {
  const { fixtures, artifacts } = buildRegistry(manifest)
  const assets = JSON.parse(readFileSync(new URL('manifest/assets.json', harnessRoot), 'utf8')) as { grammars: { name: string; public: boolean }[] }
  const languages = assets.grammars.filter(grammar => grammar.public).map(grammar => grammar.name).sort()
  const textmateCounts = new Map<string, number>()
  let captureCount = 0
  const linked = artifacts.flatMap(artifact => artifact.associations.map(association => ({ artifact, association })))
  for (const { artifact, association } of linked) {
    const fixture = fixtures.find(fixture => fixture.id === association.sourceFixtureId)!
    if (association.format === 'tree-sitter-highlight') captureCount += adaptTreeSitter(read(fixture.path), fixture.id, fixture.path, fixtureComments(fixture, read(fixture.path))).length
    if (association.format === 'vscode-colorize') {
      const count = adaptVscode(read(fixture.path), read(artifact.path), fixture.id, artifact.path).length
      textmateCounts.set(artifact.family, (textmateCounts.get(artifact.family) ?? 0) + count)
    }
    if (association.format === 'typescript-baseline') {
      const sections = adaptTypescript(read(fixture.path), read(artifact.path), fixture.id, artifact.path)
      const count = sections.reduce((count, section) => count + section.expectations.length, 0)
      textmateCounts.set(artifact.family, (textmateCounts.get(artifact.family) ?? 0) + count)
    }
  }
  const primary = manifest.sources.flatMap(source => source.fileIds.map(id => ({ source, file: manifest.files.find(file => file.id === id)! })))
  const skipped = primary.filter(({ file }) => file.decision === 'skip')
  const deferred = primary.filter(({ source, file }) => source.family === 'vscode-textmate' && file.decision === 'fetch-by-hash')
  const dependencies = new Set(manifest.sources.flatMap(source => source.dependencyFileIds ?? []))
  const selectedDependencies = manifest.files.filter(file => dependencies.has(file.id) && file.decision === 'fetch-by-hash').length
  const storedCount = artifacts.filter(artifact => !fixtures.some(fixture => fixture.id === artifact.id)).length
  const rows = [
    '# Fixture coverage', '',
    `${languages.length} catalog languages; ${fixtures.length} runnable source fixtures; ${artifacts.length} vendored primary artifacts; ${skipped.length} skipped primary artifacts.`, '',
    'Runnable means a cleared, locally available input. It makes no reference-completeness, native-support, or comparison-success claim.', '',
    '## Selection accounting', '',
    `The manifest selects ${primary.filter(({ file }) => file.decision === 'fetch-by-hash').length} primary artifacts. This registry holds ${artifacts.length}. The following ${deferred.length} oracle-suite artifacts belong to L2, together with the ${selectedDependencies} selected dependencies.`, '',
    ...deferred.map(({ file }) => `- \`${file.id}\`. Deferred to the oracle-conformance vendor registry.`), '',
    `The ${artifacts.length} artifacts comprise ${fixtures.length} source inputs and ${storedCount} stored expectations. Source fixtures are deduplicated by SHA-256. Stored expectation bytes are distinct artifacts linked to every recorded source and provenance association.`, '',
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
    '## Comment-node provenance', '',
    `Selected capture fixtures use actual JavaScript comment nodes from grammar revision ${commentMetadata.grammarRevision}, parser-source SHA-256 ${commentMetadata.parserSourceSha256}, extracted with ${commentMetadata.cliVersion}. Each of the ${commentMetadata.entries.length} entries records its source SHA-256; changed source bytes fail loading and regeneration.`, '',
    'The capture adapter requires parser-supplied UTF-16 comment ranges. Assertion-looking string content supplies no comment node. Unsupported assertion comment shapes fail explicitly.', '',
    'fixtures:comments <parser-nodes.json> re-derives the committed metadata; append --check to compare without writing. Its input carries grammarRevision, parserSourceSha256, cliVersion, and entries with sourceSha256 and comments containing from/to UTF-16 offsets. L4 can emit those nodes from the web binding; the command invokes no native CLI or network.', '',
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
