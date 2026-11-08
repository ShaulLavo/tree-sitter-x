import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { isBuiltin } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { sha256 } from './inputs.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const forbidden = /(?:^|\/)(?:native|baselines|fixtures|collectors?|evaluator[^/]*|coordinator-only)(?:\/|$)|(?:scope-classif|scope-language|wave-collection|native-theme-diagnostics)/

const independentShared = new Set([
  'src/build.ts', 'src/schema.ts', 'src/source.ts', 'src/style.ts', 'src/validate.ts',
  'src/oracles/assets.ts', 'src/oracles/conformance.ts', 'src/oracles/lines.ts', 'src/oracles/metadata.ts',
  'src/oracles/native-theme-direct.ts', 'src/oracles/native-theme-inputs.ts', 'src/oracles/native-theme-reference.ts',
  'src/oracles/native-theme-schema.ts', 'src/oracles/pins.ts', 'src/oracles/request.ts', 'src/oracles/resolved-style.ts',
  'src/oracles/textmate.ts', 'src/oracles/raw.ts', 'src/oracles/product/scopePath.ts', 'src/oracles/product/scopedTokens.ts',
  'src/oracles/product/theme.ts', 'src/oracles/product/tokenizer.ts', 'src/cli/native-theme-admission.ts',
])

const externalPackages = new Set([
  'typescript', '@shikijs/vscode-textmate', 'vscode-textmate', 'vscode-oniguruma',
  'shiki/core', 'shiki/textmate', 'shiki/engine/oniguruma', 'shiki/wasm',
])
function auditedTemplate(node: ts.Node | undefined, file: string): boolean {
  if (relative(root, file) !== 'src/oracles/assets.ts' || !node || !ts.isTemplateExpression(node) || node.templateSpans.length !== 1) return false
  const span = node.templateSpans[0]
  if (!span || span.literal.text !== '' || !ts.isIdentifier(span.expression)) return false
  return node.head.text === '@shikijs/langs/' && span.expression.text === 'grammar'
    || node.head.text === '@shikijs/themes/' && span.expression.text === 'themeId'
}
function dependency(node: ts.Node | undefined, file: string, allowTemplate = false): string | undefined {
  if (allowTemplate && auditedTemplate(node, file)) return undefined
  assert(node && ts.isStringLiteralLike(node), `unresolved reference dependency in ${relative(root, file)}`)
  const value = node.text
  if (value.startsWith('.')) return resolve(dirname(file), value)
  assert(!isAbsolute(value) && !value.startsWith('file:'), `unreviewed absolute reference dependency: ${value}`)
  assert(isBuiltin(value) || externalPackages.has(value), `unreviewed external reference dependency: ${value}`)
  return undefined
}
function loaderReference(node: ts.Node): void {
  if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'createRequire') assert(node.name.text === 'createRequire', 'unreviewed loader factory alias')
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isIdentifier(node.initializer)) assert(!['require', 'createRequire'].includes(node.initializer.text), 'unreviewed loader alias')
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && ['require', 'createRequire'].includes(node.expression.text)) {
    assert(node.expression.text === 'require' && node.name.text === 'resolve', 'unreviewed loader member or alias')
  }
  if (!ts.isCallExpression(node)) return
  const callee = node.expression
  const factory = ts.isIdentifier(callee) && callee.text === 'createRequire' || ts.isPropertyAccessExpression(callee) && callee.name.text === 'createRequire'
  if (!factory) return
  const binding = node.parent
  const named = ts.isVariableDeclaration(binding) && ts.isIdentifier(binding.name) && binding.name.text === 'require'
  const resolving = ts.isPropertyAccessExpression(binding) && binding.name.text === 'resolve' && ts.isCallExpression(binding.parent) && binding.parent.expression === binding
  assert(named || resolving, 'unreviewed loader factory binding')
}
function specifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const result: string[] = []
  function add(node: ts.Node | undefined, allowTemplate = false): void {
    const found = dependency(node, file, allowTemplate)
    if (found !== undefined) result.push(found)
  }
  function visit(node: ts.Node): void {
    loaderReference(node)
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier)
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], true)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0])
    if (ts.isImportTypeNode(node)) { assert(ts.isLiteralTypeNode(node.argument), 'unresolved type dependency'); add(node.argument.literal) }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

/** Includes type imports and dynamic imports, not just the executed branch. */
export function referenceDependencies(entries = ['src/cli/native-theme-admission.ts']): Record<string, string> {
  const queue = entries.map(file => resolve(root, file))
  const files = new Set<string>()
  while (queue.length > 0) {
    const file = queue.pop()
    assert(file)
    if (files.has(file)) continue
    const path = relative(root, file)
    assert(!path.startsWith('..') && !forbidden.test(path) && (path.startsWith('src/oracles/theme-admission/') || independentShared.has(path)), `non-reference dependency: ${path}`)
    files.add(file)
    queue.push(...specifiers(file))
  }
  return Object.fromEntries(Array.from(files).sort().map(file => [relative(root, file), sha256(readFileSync(file))]))
}
