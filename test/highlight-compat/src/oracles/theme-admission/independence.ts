import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
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

function specifiers(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const result: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) add(node.arguments[0])
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal)
    ts.forEachChild(node, visit)
  }
  function add(node: ts.Node | undefined): void {
    if (node && ts.isStringLiteralLike(node) && node.text.startsWith('.')) result.push(resolve(dirname(file), node.text))
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
