import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const args = process.argv.slice(2)
const checkClean = args.includes('--check-clean')
// Node requires this flag to resolve ESM dependencies relative to their importing file.
if (!checkClean && !process.execArgv.includes('--experimental-import-meta-resolve')) {
  const child = spawnSync(process.execPath, [...process.execArgv, '--experimental-import-meta-resolve', fileURLToPath(import.meta.url), ...args], { stdio: 'inherit' })
  process.exit(child.status ?? 1)
}
const packageRoot = resolve(args.find((arg) => !arg.startsWith('--')) ?? fileURLToPath(new URL('..', import.meta.url)))
const git = (...args) => execFileSync('git', ['-C', packageRoot, ...args], { encoding: 'utf8' })
const repoRoot = git('rev-parse', '--show-toplevel').trim()
const packagePath = relative(repoRoot, packageRoot).split(sep).join('/')

if (checkClean) {
  const changes = git('status', '--porcelain') + git('status', '--porcelain', '--ignored', '--', packageRoot, `:(top,exclude)${packagePath}/node_modules`)
  if (changes.trim()) {
    console.error(changes.trim())
    process.exit(1)
  }
  console.log('Checkout unchanged; dependency and cache files inside node_modules are permitted.')
  process.exit(0)
}

const tracked = new Set(git('ls-files', '-z', '--cached', '--full-name', '--', ':/').split('\0').filter(Boolean))
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
const isSource = (file) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)
const isDeclaration = (file) => /\.d\.[cm]?ts$/.test(file)
const queue = [...tracked]
  .filter((path) => path.startsWith(`${packagePath}/`))
  .map((path) => path.slice(packagePath.length + 1))
  .filter(isSource)
  .filter((path) => /^(?:src|tests|scripts)\//.test(path)
    || /^manifest\/[^/]+\.mjs$/.test(path)
    || /^(?:[^/]+\.)?config\.[cm]?[jt]s$/.test(path))
  .map((path) => resolve(packageRoot, path))

function repoPath(file) {
  return relative(repoRoot, file).split(sep).join('/')
}

function onlyTypes(node) {
  if (node.isTypeOnly) return true
  const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause
  const hasDefault = ts.isImportDeclaration(node) && node.importClause?.name
  return !hasDefault && bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)
}

function isWorker(node) {
  if (!node || !ts.isNewExpression(node)) return false
  const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression
  return ts.isIdentifier(name) && name.text === 'Worker'
}

function dependenciesIn(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const mode = ts.getImpliedNodeFormatForFile(file, undefined, ts.sys, options) ?? ts.ModuleKind.ESNext
  const dependencies = []
  const urlVariables = new Map()
  const workerUrls = new Set()
  function add(node, typeOnly, resolutionMode = mode, kind = 'import') {
    if (!node || !ts.isStringLiteralLike(node)) return
    const dependency = { specifier: node.text, typeOnly: typeOnly || isDeclaration(file), mode: resolutionMode, kind }
    dependencies.push(dependency)
    const declaration = node.parent?.parent
    if (kind === 'url' && declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) urlVariables.set(declaration.name.text, dependency)
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier, node.importClause?.isTypeOnly || onlyTypes(node))
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression, node.isTypeOnly, ts.ModuleKind.CommonJS)
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal, true)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], false, ts.ModuleKind.ESNext)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require') add(node.arguments[0], false, ts.ModuleKind.CommonJS)
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL' && node.arguments?.[1]?.getText(source) === 'import.meta.url') add(node.arguments[0], false, mode, isWorker(node.parent) ? 'worker-url' : 'url')
    if (isWorker(node) && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0]) && /^(?:\.\.?\/|\/|file:)/.test(node.arguments[0].text)) add(node.arguments[0], false, mode, 'worker-path')
    if (isWorker(node) && node.arguments?.[0] && ts.isIdentifier(node.arguments[0])) workerUrls.add(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  for (const name of workerUrls) {
    const dependency = urlVariables.get(name)
    if (dependency) dependency.kind = 'worker-url'
  }
  return dependencies
}

function resolveDependency(dependency, importer) {
  const { specifier, typeOnly, mode, kind } = dependency
  if (kind === 'worker-path') return specifier.startsWith('file:') ? fileURLToPath(specifier) : resolve(packageRoot, specifier)
  if (kind === 'url' || kind === 'worker-url') {
    const url = new URL(specifier, pathToFileURL(importer))
    if (url.protocol !== 'file:') return undefined
    const file = fileURLToPath(url)
    // Suffixless root URLs name output directories; a Worker always requires a source file.
    if (kind === 'url' && ((!extname(file) && !existsSync(file)) || (existsSync(file) && statSync(file).isDirectory()))) return undefined
    return file
  }
  if (typeOnly) return ts.resolveModuleName(specifier, importer, options, ts.sys, undefined, undefined, mode).resolvedModule?.resolvedFileName
  if (mode === ts.ModuleKind.CommonJS) return createRequire(importer).resolve(specifier)
  return fileURLToPath(import.meta.resolve(specifier, pathToFileURL(importer)))
}

function checkDependency(dependency, importer) {
  if (isBuiltin(dependency.specifier)) return
  const label = `${repoPath(importer)} ${dependency.kind === 'import' ? 'imports' : 'loads'} ${JSON.stringify(dependency.specifier)}`
  let file
  try {
    file = resolveDependency(dependency, importer)
  } catch {
    failures.push(`${label}: cannot resolve a tracked file or installed dependency`)
    return
  }
  if (!file && dependency.kind === 'url') return
  if (!file || !existsSync(file)) {
    failures.push(`${label}: cannot resolve a tracked file or installed dependency`)
    return
  }
  const target = realpathSync(file)
  if (target.split(sep).includes('node_modules')) return
  if (!tracked.has(repoPath(target))) {
    failures.push(`${label}: ${repoPath(target)} is not tracked by git`)
    return
  }
  if (isSource(target)) queue.push(target)
}

while (queue.length > 0) {
  const file = queue.pop()
  if (visited.has(file)) continue
  visited.add(file)
  for (const dependency of dependenciesIn(file)) checkDependency(dependency, file)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(git('ls-files', '--others', '--exclude-standard', '--', packageRoot))
  console.error(git('status', '--ignored', '--porcelain', '--', packageRoot))
  process.exit(1)
}
console.log(`Tracked imports checked in ${visited.size} source files.`)
