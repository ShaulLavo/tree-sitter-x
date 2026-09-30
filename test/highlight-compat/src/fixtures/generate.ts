import type { FixtureManifest, ManifestFile, ManifestSource } from './manifest.ts'
import type { ArtifactFormat, Fixture, FixtureArtifact, FixtureFamily, FixtureLane, FixtureProvenance } from './types.ts'

const families = new Set<string>(['vscode-colorize', 'typescript-tmlanguage', 'textmate-grammars-themes', 'tree-sitter-highlight'])

export function selectedArtifacts(manifest: FixtureManifest): readonly { source: ManifestSource; file: ManifestFile }[] {
  const files = new Map(manifest.files.map(file => [file.id, file]))
  return manifest.sources.filter(source => families.has(source.family)).flatMap(source =>
    source.fileIds.map(id => ({ source, file: files.get(id)! })).filter(({ file }) => file.decision === 'fetch-by-hash'),
  ).sort((a, b) => a.source.family.localeCompare(b.source.family, 'en') || a.file.path.localeCompare(b.file.path, 'en'))
}

function format(file: ManifestFile): ArtifactFormat {
  if (file.roles.includes('annotated-highlight-input')) return 'tree-sitter-highlight'
  if (file.roles.includes('stored-tree-sitter-capture')) return 'vscode-tree-sitter-capture'
  if (file.roles.includes('stored-textmate-capture')) return 'vscode-colorize'
  if (file.roles.includes('stored-maintainer-baseline')) return 'typescript-baseline'
  if (file.roles.includes('fixture-input')) return 'source'
  throw new Error(`unrecognized selected artifact role ${file.id}: ${file.roles.join(', ')}`)
}

function lane(artifactFormat: ArtifactFormat, family: string): FixtureLane {
  if (family === 'textmate-grammars-themes') return 'catalog-smoke'
  if (artifactFormat !== 'source') return 'annotated-expectation'
  return 'language-regression'
}

function provenance(manifest: FixtureManifest, source: ManifestSource, file: ManifestFile): FixtureProvenance {
  if (!file.provenance || file.provenance.category !== 'own' || file.provenance.licenseRefs.length === 0 ||
    !['repository-default-reviewed-candidate', 'file-license-and-repository-grant'].includes(file.provenance.licenseStatus)) {
    throw new Error(`selected fixture lacks a reviewed vendorable license: ${file.id}`)
  }
  for (const id of file.provenance.licenseRefs) {
    if (manifest.licenses.find(license => license.id === id)?.spdx !== 'MIT') throw new Error(`uncleared fixture license ${id}`)
  }
  const grammar = manifest.grammarExpectations.find(grammar => grammar.id === file.grammarExpectationId)
  if (!grammar) throw new Error(`missing grammar provenance for ${file.id}`)
  const grammarFile = manifest.files.find(candidate => candidate.id === grammar.grammarFileId)
  return {
    sourceSetId: source.id, repositoryId: file.repository, revision: file.revision, upstreamPath: file.path,
    manifestFileId: file.id, licenses: file.provenance.licenseRefs,
    grammar: {
      id: grammar.id, generatedAgainstRevision: grammar.expectedOutputGenerationRevision ?? null,
      inspectedCheckoutRevision: grammar.referenceCheckoutRevision ?? grammarFile?.revision ?? null,
      inspectedUpstreamRevision: grammar.upstreamVersion?.split('/commit/')[1] ?? null,
      inspectedGrammarSha256: grammarFile?.sha256 ?? null,
      productGrammarSha256: grammar.coreComparison?.productSha256 ?? null,
      productRevision: manifest.product.revision,
      productPackage: grammar.productPackage ?? `${manifest.product.package}@${manifest.product.version}`,
    },
  }
}

const idFor = (family: string, file: ManifestFile): string => `${family}/${file.path}`
const sourceFormats = new Set<ArtifactFormat>(['source', 'tree-sitter-highlight'])

export function buildRegistry(manifest: FixtureManifest): { fixtures: readonly Fixture[]; artifacts: readonly FixtureArtifact[] } {
  const selected = selectedArtifacts(manifest)
  const byFile = new Map(selected.map(entry => [entry.file.id, entry]))
  const artifacts = new Map<string, FixtureArtifact>()
  for (const { source, file } of selected) {
    const artifactFormat = format(file)
    const sourceEntry = byFile.get(file.sourceFileId ?? file.id)
    if (!sourceEntry) throw new Error(`unselected source for expectation ${file.id}`)
    const previous = artifacts.get(file.sha256)
    const origin = provenance(manifest, source, file)
    if (previous) {
      artifacts.set(file.sha256, { ...previous, provenance: [...previous.provenance, origin] })
      continue
    }
    artifacts.set(file.sha256, {
      id: idFor(source.family, file), family: source.family as FixtureFamily, languageId: file.languageIds?.[0] ?? '',
      path: `fixtures/${source.family}/${file.path}`, sha256: file.sha256, lane: lane(artifactFormat, source.family),
      provenance: [origin], split: 'development', format: artifactFormat, sourceFixtureId: idFor(sourceEntry.source.family, sourceEntry.file),
    })
  }
  const values = [...artifacts.values()]
  const fixtures = values.filter(artifact => sourceFormats.has(artifact.format)).map(({ format: _format, sourceFixtureId: _source, ...fixture }) => fixture)
  const canonicalIds = new Map(values.flatMap(artifact => artifact.provenance.map(origin => {
    const entry = byFile.get(origin.manifestFileId)!
    return [idFor(entry.source.family, entry.file), artifact.id] as const
  })))
  return { fixtures, artifacts: values.map(artifact => ({ ...artifact, sourceFixtureId: canonicalIds.get(artifact.sourceFixtureId)! })) }
}

export function registrySource(manifest: FixtureManifest): string {
  const { fixtures, artifacts } = buildRegistry(manifest)
  return `// Generated by npm run fixtures:update.\nimport type { Fixture, FixtureArtifact } from './types.ts'\n\nexport const fixtures: readonly Fixture[] = ${JSON.stringify(fixtures, null, 2)}\n\nexport const fixtureArtifacts: readonly FixtureArtifact[] = ${JSON.stringify(artifacts, null, 2)}\n`
}
