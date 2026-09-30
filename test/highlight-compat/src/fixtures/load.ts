import { readFileSync } from 'node:fs'
import type { Expectation } from '../expectations.ts'
import { fixtureArtifacts } from './registry.ts'
import { harnessRoot } from './manifest.ts'
import { adaptVscode } from './vscode.ts'
import { adaptTypescript } from './typescript.ts'
import { adaptTreeSitter } from './tree-sitter.ts'
import type { CaptureExpectation } from './tree-sitter.ts'
import type { Fixture, FixtureArtifact } from './types.ts'

export interface DiagnosticScopeSet {
  readonly artifact: FixtureArtifact
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

export function loadFixture(fixture: Fixture): LoadedFixture {
  const source = readFileSync(new URL(fixture.path, harnessRoot), 'utf8')
  const textmate: DiagnosticScopeSet[] = []
  const unconvertedArtifacts: FixtureArtifact[] = []
  for (const artifact of fixtureArtifacts.filter(artifact => artifact.sourceFixtureId === fixture.id)) {
    if (artifact.format === 'vscode-colorize') {
      const json = readFileSync(new URL(artifact.path, harnessRoot), 'utf8')
      textmate.push({ artifact, grammar: artifact.provenance[0].grammar.id, expectations: adaptVscode(source, json, fixture.id, artifact.path) })
      continue
    }
    if (artifact.format === 'typescript-baseline') {
      const baseline = readFileSync(new URL(artifact.path, harnessRoot), 'utf8')
      for (const section of adaptTypescript(source, baseline, fixture.id, artifact.path)) textmate.push({ artifact, ...section })
      continue
    }
    if (artifact.format === 'vscode-tree-sitter-capture') unconvertedArtifacts.push(artifact)
  }
  const captures = fixture.family === 'tree-sitter-highlight' ? adaptTreeSitter(source, fixture.id, fixture.path) : []
  return { fixture, source, textmate, captures, unconvertedArtifacts }
}
