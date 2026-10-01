import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const packageRoot = resolve(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)))
const git = (...args) => execFileSync('git', ['-C', packageRoot, ...args], { encoding: 'utf8' })
const repoRoot = git('rev-parse', '--show-toplevel').trim()
const tracked = new Set(git('ls-files', '-z', '--cached', '--full-name', '--', ':/').split('\0').filter(Boolean))
const packagePath = relative(repoRoot, packageRoot).split(sep).join('/')
const configPath = ts.findConfigFile(packageRoot, ts.sys.fileExists, 'tsconfig.json')
const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : { config: {} }
if (config.error) {
  console.error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  process.exit(1)
}
const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot)
const options = { moduleResolution: ts.ModuleResolutionKind.NodeNext, ...parsedConfig.options, allowJs: true }
const failures = []
const visited = new Set()
const queue = [...tracked]
  .filter((path) => path.startsWith(`${packagePath}/`) && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(path))
  .map((path) => resolve(repoRoot, path))

function repoPath(file) {
  return relative(repoRoot, file).split(sep).join('/')
}

function importsIn(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const imports = []
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier)
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) add(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  function add(node) {
    if (node && ts.isStringLiteralLike(node)) imports.push(node.text)
  }
  visit(source)
  return imports
}

function checkImport(specifier, importer) {
  if (isBuiltin(specifier)) return
  const result = ts.resolveModuleName(specifier, importer, options, ts.sys).resolvedModule
  const label = `${repoPath(importer)} imports ${JSON.stringify(specifier)}`
  if (!result) {
    failures.push(`${label}: cannot resolve a tracked file or installed dependency`)
    return
  }
  if (result.isExternalLibraryImport && result.resolvedFileName.split(sep).includes('node_modules')) return
  const target = realpathSync(result.resolvedFileName)
  if (!tracked.has(repoPath(target))) {
    failures.push(`${label}: ${repoPath(target)} is not tracked by git`)
    return
  }
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(target)) queue.push(target)
}

while (queue.length > 0) {
  const file = queue.pop()
  if (visited.has(file)) continue
  visited.add(file)
  for (const specifier of importsIn(file)) checkImport(specifier, file)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(git('ls-files', '--others', '--exclude-standard', '--', packageRoot))
  console.error(git('status', '--ignored', '--porcelain', '--', packageRoot))
  process.exit(1)
}
console.log(`Tracked imports checked in ${visited.size} source files.`)
