export type FixtureLane = 'language-regression' | 'annotated-expectation' | 'catalog-smoke' | 'adversarial' | 'held-out'
export type FixtureSplit = 'development' | 'evaluation'
export type FixtureFamily = 'vscode-colorize' | 'typescript-tmlanguage' | 'textmate-grammars-themes' | 'tree-sitter-highlight'
export type ArtifactFormat = 'source' | 'vscode-colorize' | 'typescript-baseline' | 'tree-sitter-highlight' | 'vscode-tree-sitter-capture'

export interface GrammarProvenance {
  readonly id: string
  readonly generatedAgainstRevision: string | null
  readonly inspectedCheckoutRevision: string | null
  readonly inspectedUpstreamRevision: string | null
  readonly inspectedGrammarSha256: string | null
  readonly productGrammarSha256: string | null
  readonly productRevision: string
  readonly productPackage: string
}

export interface FixtureProvenance {
  readonly sourceSetId: string
  readonly repositoryId: string
  readonly revision: string
  readonly upstreamPath: string
  readonly manifestFileId: string
  readonly licenses: readonly string[]
  readonly grammar: GrammarProvenance
}

export interface Fixture {
  readonly id: string
  readonly family: FixtureFamily
  readonly languageId: string
  readonly path: string
  readonly sha256: string
  readonly lane: FixtureLane
  readonly provenance: readonly FixtureProvenance[]
  readonly split: FixtureSplit
}

export interface FixtureAssociation {
  readonly sourceFixtureId: string
  readonly format: ArtifactFormat
  readonly provenance: FixtureProvenance
}

export interface FixtureArtifact extends Fixture {
  readonly format: ArtifactFormat
  readonly associations: readonly FixtureAssociation[]
}
