import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { nativeThemeDiagnosticFixtures } from '../src/oracles/native-theme-diagnostics.ts'


it('keeps exact input failures separate from observed reference style truth', () => {
  const fixtures = nativeThemeDiagnosticFixtures()
  expect(fixtures.schema).toBe('native-theme-diagnostics/v1')
  expect(new Set(fixtures.cases.map(item => item.id)).size).toBe(fixtures.cases.length)
  expect(fixtures.cases.filter(item => item.expected.kind === 'unsupported').length).toBeGreaterThan(10)
  expect(fixtures.cases.find(item => item.id === 'blank-font')?.expected).toMatchObject({ kind: 'invalid', code: 'font-style' })
  expect(fixtures.cases.find(item => item.id === 'unknown-font')?.expected).toMatchObject({ kind: 'unsupported', code: 'font-style' })
  expect(fixtures.cases.find(item => item.id === 'empty-zero-resolve')?.expected).toEqual({ kind: 'ok', styleCount: 0 })
  expect(fixtures.cases.find(item => item.id === 'resolve-steps-zero')?.expected).toMatchObject({ kind: 'budget', code: 'resolve-steps', limit: 0 })
  expect(fixtures.cases.find(item => item.id === 'output-exact-limit')?.expected).toEqual({ kind: 'ok', styleCount: 1 })
  expect(fixtures.cases.find(item => item.id === 'output-first-rejection')?.expected).toMatchObject({ kind: 'budget', code: 'output-bytes', limit: 11 })
  expect(fixtures.cases.every(item => item.expected.kind !== 'budget' || Number.isInteger(item.expected.limit))).toBe(true)
})

it('has no candidate/native dependency anywhere in the reference generator graph', () => {
  const queue = ['native-theme-reference.ts', 'native-theme-direct.ts', 'native-theme-diagnostics.ts']
    .map(file => fileURLToPath(new URL(`../src/oracles/${file}`, import.meta.url)))
  const visited = new Set<string>()
  while (queue.length > 0) {
    const file = queue.pop()
    assert(file)
    if (visited.has(file)) continue
    visited.add(file)
    expect(file).not.toContain('/src/native/')
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    queue.push(...localImports(source, file))
  }
  expect(visited.size).toBeGreaterThan(10)
})

function localImports(source: ts.SourceFile, file: string): string[] {
  const imports: string[] = []
  function visit(node: ts.Node): void {
    const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : undefined
    if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith('.')) imports.push(resolve(dirname(file), specifier.text))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}
