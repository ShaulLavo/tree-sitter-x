import { readFileSync } from 'node:fs'
import type { Expectation } from '../expectations.ts'
import { fixtureArtifacts } from './registry.ts'
import { harnessRoot } from './manifest.ts'
import { adaptVscode } from './vscode.ts'
import { adaptTypescript } from './typescript.ts'
import { fixtureComments } from './comments.ts'
import { adaptTreeSitter } from './tree-sitter.ts'
import type { CaptureExpectation } from './tree-sitter.ts'
import type { Fixture, FixtureArtifact, FixtureAssociation } from './types.ts'

export interface DiagnosticScopeSet {
  readonly artifact: FixtureArtifact
  readonly association: FixtureAssociation
  readonly grammar: string
  readonly expectations: readonly Expectation[]
}

export interface LoadedFixture {
  readonly fixture: Fixture
  readonly source: string
  readonly textmate: readonly DiagnosticScopeSet[]
  readonly captures: readonly CaptureExpectation[]
  readonly unconvertedArtifacts: readonly FixtureArtifact[]
}

export function loadFixture(fixture: Fixture, artifacts: readonly FixtureArtifact[] = fixtureArtifacts): LoadedFixture {
  const source = readFileSync(new URL(fixture.path, harnessRoot), 'utf8')
  const textmate: DiagnosticScopeSet[] = []
  const unconvertedArtifacts: FixtureArtifact[] = []
  const linked = artifacts.flatMap(artifact => artifact.associations.filter(association => association.sourceFixtureId === fixture.id).map(association => ({ artifact, association })))
  for (const { artifact, association } of linked) {
    if (association.format === 'vscode-colorize') {
      const json = readFileSync(new URL(artifact.path, harnessRoot), 'utf8')
      textmate.push({ artifact, association, grammar: association.provenance.grammar.id, expectations: adaptVscode(source, json, fixture.id, artifact.path) })
      continue
    }
    if (association.format === 'typescript-baseline') {
      const baseline = readFileSync(new URL(artifact.path, harnessRoot), 'utf8')
      for (const section of adaptTypescript(source, baseline, fixture.id, artifact.path)) textmate.push({ artifact, association, ...section })
      continue
    }
    if (association.format === 'vscode-tree-sitter-capture') unconvertedArtifacts.push(artifact)
  }
  const captures = fixture.family === 'tree-sitter-highlight' ? adaptTreeSitter(source, fixture.id, fixture.path, fixtureComments(fixture, source)) : []
  return { fixture, source, textmate, captures, unconvertedArtifacts }
}
