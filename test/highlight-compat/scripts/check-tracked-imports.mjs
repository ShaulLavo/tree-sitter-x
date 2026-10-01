import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, globSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { dirname, extname, relative, resolve, sep } from 'node:path'
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
const queue = []
const reached = new Set(['package.json', 'tsconfig.json'])
const dataEntries = new Set(['fixtures', 'vendor', 'goldens', 'reports', 'node_modules', 'README.md', 'package-lock.json'])
const entries = readdirSync(packageRoot)
const configFiles = entries.filter((file) => /^(?:[^/]+\.)?config\.[cm]?[jt]s$/.test(file))
const vitestConfigs = new Set(configFiles.filter((file) => /^vitest(?:\.[^/]+)?\.config\./.test(file)))
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
const generatedInputs = new Map()
const generatedManifest = resolve(packageRoot, 'generated-inputs.json')
if (existsSync(generatedManifest)) {
  reached.add('generated-inputs.json')
  if (!tracked.has(repoPath(generatedManifest))) failures.push('generated-inputs.json must be tracked by git')
  const { inputs } = JSON.parse(readFileSync(generatedManifest, 'utf8'))
  for (const input of inputs) {
    const file = resolve(packageRoot, input.path)
    if (!input.command || !input.sources?.length) failures.push(`${input.path}: generated input requires a build command and tracked sources`)
    if (tracked.has(repoPath(file))) failures.push(`${input.path}: generated input must be gitignored and untracked`)
    for (const source of input.sources ?? []) {
      const path = repoPath(resolve(packageRoot, source))
      if (!tracked.has(path) && ![...tracked].some((file) => file.startsWith(`${path}/`))) failures.push(`${source}: generated input source is not tracked`)
    }
    generatedInputs.set(file, input)
  }
}

function addRoot(path) {
  const file = resolve(packageRoot, path)
  if (!existsSync(file) || !tracked.has(repoPath(realpathSync(file)))) {
    failures.push(`${repoPath(file)}: executable entry point is missing or is not tracked by git`)
    return
  }
  queue.push(realpathSync(file))
}

for (const source of Object.values(manifest.scripts ?? {})) {
  // Source-file arguments include Node entries, loaders, and explicit tool configurations.
  const tokens = (source.match(/(?:[^\s"';&|]+|"[^"]*"|'[^']*')+/g) ?? []).map((token) => token.replace(/["']/g, ''))
  for (let index = 0; index < tokens.length; index++) {
    const path = tokens[index].replace(/^--[^=]+=/, '')
    if (isSource(path)) addRoot(path)
    if (!tokens.includes('vitest')) continue
    if (tokens[index] === '--config' || tokens[index] === '-c') vitestConfigs.add(tokens[index + 1])
    if (tokens[index].startsWith('--config=')) vitestConfigs.add(path)
  }
}
for (const file of configFiles) addRoot(file)
const self = fileURLToPath(import.meta.url)
if (self.startsWith(`${packageRoot}${sep}`)) addRoot(self)

for (const path of vitestConfigs) {
  addRoot(path)
  try {
    const { loadConfigFromFile } = await import('vite')
    const { configDefaults } = await import('vitest/config')
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, resolve(packageRoot, path), packageRoot)
    const test = loaded.config.test ?? {}
    const root = resolve(packageRoot, loaded.config.root ?? '.', test.dir ?? '.')
    for (const file of globSync(test.include ?? configDefaults.include, { cwd: root, exclude: test.exclude ?? configDefaults.exclude })) {
      addRoot(resolve(root, file))
    }
  } catch (error) {
    failures.push(`${path}: cannot load executable test configuration: ${error.message}`)
  }
}

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
  const base = dependency.kind === 'worker-path' ? packageRoot : dirname(importer)
  const expected = dependency.specifier.startsWith('file:') ? fileURLToPath(dependency.specifier) : resolve(base, dependency.specifier)
  const generated = generatedInputs.get(expected)
  if (generated && !existsSync(expected)) {
    failures.push(`${label}: generated input is missing; run ${generated.command} from the repository root`)
    return
  }
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
  const declared = generatedInputs.get(file)
  if (declared && (tracked.has(repoPath(target)) || spawnSync('git', ['-C', repoRoot, 'check-ignore', '-q', '--', repoPath(target)]).status !== 0)) {
    failures.push(`${label}: generated input must be gitignored and untracked`)
    return
  }
  if (!tracked.has(repoPath(target)) && !declared) {
    failures.push(`${label}: ${repoPath(target)} is not tracked by git`)
    return
  }
  reached.add(relative(packageRoot, target).split(sep)[0])
  if (isSource(target) && !declared) queue.push(target)
}

while (queue.length > 0) {
  const file = queue.pop()
  if (visited.has(file)) continue
  visited.add(file)
  reached.add(relative(packageRoot, file).split(sep)[0])
  for (const dependency of dependenciesIn(file)) checkDependency(dependency, file)
}

for (const entry of entries) {
  if (!reached.has(entry) && !dataEntries.has(entry)) failures.push(`unclassified package entry: ${entry}`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  console.error(git('ls-files', '--others', '--exclude-standard', '--', packageRoot))
  console.error(git('status', '--ignored', '--porcelain', '--', packageRoot))
  process.exit(1)
}
console.log(`Tracked imports checked in ${visited.size} source files.`)
