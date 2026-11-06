import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, globSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire, isBuiltin } from 'node:module'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

type Dependency = {
  specifier: string
  typeOnly: boolean
  mode: ts.ResolutionMode
  kind: 'import' | 'url' | 'worker-url' | 'worker-path'
}

type GeneratedInput = { path: string; command: string; sources: string[] }
export type CheckResult = { status: 0 | 1; stdout: string; stderr: string }

const isSource = (file: string): boolean => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)
const isDeclaration = (file: string): boolean => /\.d\.[cm]?ts$/.test(file)
const dataEntries = new Set(['fixtures', 'vendor', 'goldens', 'reports', 'node_modules', 'README.md', 'package-lock.json'])

function stringMap(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null) throw new Error('package scripts must be an object')
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (typeof entry !== 'string') throw new Error(`package script ${key} must be a string`)
    return [key, entry]
  }))
}

function manifestScripts(packageRoot: string): Record<string, string> {
  const manifest: unknown = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'))
  if (typeof manifest !== 'object' || manifest === null) throw new Error('package manifest must be an object')
  return 'scripts' in manifest ? stringMap(manifest.scripts) : {}
}

function generatedInput(value: unknown): GeneratedInput {
  if (typeof value !== 'object' || value === null || !('path' in value) || typeof value.path !== 'string') throw new Error('generated input requires a path')
  const command = 'command' in value && typeof value.command === 'string' ? value.command : ''
  const sources = 'sources' in value && Array.isArray(value.sources) ? value.sources : []
  return { path: value.path, command, sources: sources.map((source: unknown) => {
    if (typeof source !== 'string') throw new Error('generated input source must be a string')
    return source
  }) }
}

function readGeneratedInputs(path: string): GeneratedInput[] {
  const manifest: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof manifest !== 'object' || manifest === null || !('inputs' in manifest) || !Array.isArray(manifest.inputs)) throw new Error('generated inputs must be an array')
  return Array.from(manifest.inputs, generatedInput)
}

function onlyTypes(node: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isExportDeclaration(node) && node.isTypeOnly) return true
  if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return true
  const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause
  const hasDefault = ts.isImportDeclaration(node) && node.importClause?.name
  return !hasDefault && !!bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly)
}

function isWorker(node: ts.Node | undefined): node is ts.NewExpression {
  if (!node || !ts.isNewExpression(node)) return false
  const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression
  return ts.isIdentifier(name) && name.text === 'Worker'
}

function dependenciesIn(file: string, options: ts.CompilerOptions): Dependency[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const mode = ts.getImpliedNodeFormatForFile(file, undefined, ts.sys, options) ?? ts.ModuleKind.ESNext
  const dependencies: Dependency[] = []
  const urlVariables = new Map<string, Dependency>()
  const workerUrls = new Set<string>()
  function add(node: ts.Node | undefined, typeOnly: boolean, resolutionMode = mode, kind: Dependency['kind'] = 'import'): void {
    if (!node || !ts.isStringLiteralLike(node)) return
    const dependency: Dependency = { specifier: node.text, typeOnly: typeOnly || isDeclaration(file), mode: resolutionMode, kind }
    dependencies.push(dependency)
    const declaration = node.parent?.parent
    if (kind === 'url' && declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) urlVariables.set(declaration.name.text, dependency)
  }
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier, onlyTypes(node))
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

class TrackedImportChecker {
  readonly packageRoot: string
  readonly repoRoot: string
  readonly packagePath: string
  readonly tracked: Set<string>
  readonly options: ts.CompilerOptions
  readonly failures: string[] = []
  readonly visited = new Set<string>()
  readonly queue: string[] = []
  readonly reached = new Set(['package.json', 'tsconfig.json'])
  readonly generatedInputs = new Map<string, GeneratedInput>()

  constructor(packageRoot: string) {
    this.packageRoot = packageRoot
    this.repoRoot = this.git('rev-parse', '--show-toplevel').trim()
    this.packagePath = this.repoPath(packageRoot)
    this.tracked = new Set(this.git('ls-files', '-z', '--cached', '--full-name', '--', ':/').split('\0').filter(Boolean))
    const configPath = ts.findConfigFile(packageRoot, ts.sys.fileExists, 'tsconfig.json')
    const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : { config: {} }
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
    this.options = { moduleResolution: ts.ModuleResolutionKind.NodeNext, ...ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot).options, allowJs: true }
  }

  git(...args: string[]): string {
    return execFileSync('git', ['-C', this.packageRoot].concat(args), { encoding: 'utf8' })
  }

  repoPath(file: string): string {
    return relative(this.repoRoot, file).split(sep).join('/')
  }

  addRoot(path: string): void {
    const file = resolve(this.packageRoot, path)
    if (!existsSync(file) || !this.tracked.has(this.repoPath(realpathSync(file)))) {
      this.failures.push(`${this.repoPath(file)}: executable entry point is missing or is not tracked by git`)
      return
    }
    this.queue.push(realpathSync(file))
  }

  loadGeneratedInputs(): void {
    const path = resolve(this.packageRoot, 'generated-inputs.json')
    if (!existsSync(path)) return
    this.reached.add('generated-inputs.json')
    if (!this.tracked.has(this.repoPath(path))) this.failures.push('generated-inputs.json must be tracked by git')
    for (const input of readGeneratedInputs(path)) {
      const file = resolve(this.packageRoot, input.path)
      if (!input.command || !input.sources.length) this.failures.push(`${input.path}: generated input requires a build command and tracked sources`)
      if (this.tracked.has(this.repoPath(file))) this.failures.push(`${input.path}: generated input must be gitignored and untracked`)
      for (const source of input.sources) this.checkGeneratedSource(source)
      this.generatedInputs.set(file, input)
    }
  }

  checkGeneratedSource(source: string): void {
    const path = this.repoPath(resolve(this.packageRoot, source))
    if (!this.tracked.has(path) && !Array.from(this.tracked).some((file) => file.startsWith(`${path}/`))) this.failures.push(`${source}: generated input source is not tracked`)
  }

  addManifestRoots(vitestConfigs: Set<string>): void {
    for (const source of Object.values(manifestScripts(this.packageRoot))) {
      const tokens = (source.match(/(?:[^\s"';&|]+|"[^"]*"|'[^']*')+/g) ?? []).map((token) => token.replace(/["']/g, ''))
      for (let index = 0; index < tokens.length; index++) {
        const path = tokens[index].replace(/^--[^=]+=/, '')
        if (isSource(path)) this.addRoot(path)
        if (!tokens.includes('vitest')) continue
        if (tokens[index] === '--config' || tokens[index] === '-c') vitestConfigs.add(tokens[index + 1])
        if (tokens[index].startsWith('--config=')) vitestConfigs.add(path)
      }
    }
  }

  async addVitestRoots(path: string): Promise<void> {
    this.addRoot(path)
    try {
      const { loadConfigFromFile } = await import('vite')
      const { configDefaults } = await import('vitest/config')
      const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, resolve(this.packageRoot, path), this.packageRoot)
      if (!loaded) throw new Error('configuration was not found')
      const test = loaded.config.test ?? {}
      const root = resolve(this.packageRoot, loaded.config.root ?? '.', test.dir ?? '.')
      for (const file of globSync(test.include ?? configDefaults.include, { cwd: root, exclude: test.exclude ?? configDefaults.exclude })) this.addRoot(resolve(root, file))
    } catch (error) {
      this.failures.push(`${path}: cannot load executable test configuration: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  resolveDependency(dependency: Dependency, importer: string): string | undefined {
    const { specifier, typeOnly, mode, kind } = dependency
    if (kind === 'worker-path') return specifier.startsWith('file:') ? fileURLToPath(specifier) : resolve(this.packageRoot, specifier)
    if (kind === 'url' || kind === 'worker-url') {
      const url = new URL(specifier, pathToFileURL(importer))
      if (url.protocol !== 'file:') return undefined
      const file = fileURLToPath(url)
      if (kind === 'url' && ((!extname(file) && !existsSync(file)) || (existsSync(file) && statSync(file).isDirectory()))) return undefined
      return file
    }
    if (typeOnly) return ts.resolveModuleName(specifier, importer, this.options, ts.sys, undefined, undefined, mode).resolvedModule?.resolvedFileName
    if (mode === ts.ModuleKind.CommonJS) return createRequire(importer).resolve(specifier)
    return fileURLToPath(import.meta.resolve(specifier, pathToFileURL(importer).href))
  }

  checkDependency(dependency: Dependency, importer: string): void {
    if (isBuiltin(dependency.specifier)) return
    const label = `${this.repoPath(importer)} ${dependency.kind === 'import' ? 'imports' : 'loads'} ${JSON.stringify(dependency.specifier)}`
    const base = dependency.kind === 'worker-path' ? this.packageRoot : dirname(importer)
    const expected = dependency.specifier.startsWith('file:') ? fileURLToPath(dependency.specifier) : resolve(base, dependency.specifier)
    const generated = this.generatedInputs.get(expected)
    if (generated && !existsSync(expected)) {
      this.failures.push(`${label}: generated input is missing; run ${generated.command} from the repository root`)
      return
    }
    let file: string | undefined
    try {
      file = this.resolveDependency(dependency, importer)
    } catch {
      this.failures.push(`${label}: cannot resolve a tracked file or installed dependency`)
      return
    }
    if (!file && dependency.kind === 'url') return
    if (!file || !existsSync(file)) {
      this.failures.push(`${label}: cannot resolve a tracked file or installed dependency`)
      return
    }
    this.checkResolvedDependency(file, label)
  }

  checkResolvedDependency(file: string, label: string): void {
    const target = realpathSync(file)
    if (target.split(sep).includes('node_modules')) return
    const declared = this.generatedInputs.get(file)
    if (declared && (this.tracked.has(this.repoPath(target)) || spawnSync('git', ['-C', this.repoRoot, 'check-ignore', '-q', '--', this.repoPath(target)]).status !== 0)) {
      this.failures.push(`${label}: generated input must be gitignored and untracked`)
      return
    }
    if (!this.tracked.has(this.repoPath(target)) && !declared) {
      this.failures.push(`${label}: ${this.repoPath(target)} is not tracked by git`)
      return
    }
    this.reached.add(relative(this.packageRoot, target).split(sep)[0])
    if (isSource(target) && !declared) this.queue.push(target)
  }

  async check(entryPoint: string): Promise<CheckResult> {
    const entries = readdirSync(this.packageRoot)
    const configFiles = entries.filter((file) => /^(?:[^/]+\.)?config\.[cm]?[jt]s$/.test(file))
    const vitestConfigs = new Set(configFiles.filter((file) => /^vitest(?:\.[^/]+)?\.config\./.test(file)))
    this.loadGeneratedInputs()
    this.addManifestRoots(vitestConfigs)
    for (const file of configFiles) this.addRoot(file)
    if (entryPoint.startsWith(`${this.packageRoot}${sep}`)) this.addRoot(entryPoint)
    for (const path of vitestConfigs) await this.addVitestRoots(path)
    this.visitSources()
    for (const entry of entries) {
      if (!this.reached.has(entry) && !dataEntries.has(entry)) this.failures.push(`unclassified package entry: ${entry}`)
    }
    if (this.failures.length === 0) return { status: 0, stdout: `Tracked imports checked in ${this.visited.size} source files.\n`, stderr: '' }
    return { status: 1, stdout: '', stderr: [this.failures.join('\n'), this.git('ls-files', '--others', '--exclude-standard', '--', this.packageRoot), this.git('status', '--ignored', '--porcelain', '--', this.packageRoot)].join('\n') + '\n' }
  }

  visitSources(): void {
    while (this.queue.length > 0) {
      const file = this.queue.pop()
      if (file === undefined || this.visited.has(file)) continue
      this.visited.add(file)
      this.reached.add(relative(this.packageRoot, file).split(sep)[0])
      for (const dependency of dependenciesIn(file, this.options)) this.checkDependency(dependency, file)
    }
  }
}

export async function checkTrackedImports(packageRoot: string, entryPoint = fileURLToPath(new URL('./check-tracked-imports.ts', import.meta.url))): Promise<CheckResult> {
  return new TrackedImportChecker(packageRoot).check(entryPoint)
}

export function checkClean(packageRoot: string): CheckResult {
  const git = (...args: string[]): string => execFileSync('git', ['-C', packageRoot].concat(args), { encoding: 'utf8' })
  const repoRoot = git('rev-parse', '--show-toplevel').trim()
  const packagePath = relative(repoRoot, packageRoot).split(sep).join('/')
  const changes = git('status', '--porcelain') + git('status', '--porcelain', '--ignored', '--', packageRoot, `:(top,exclude)${packagePath}/node_modules`)
  return changes.trim() ? { status: 1, stdout: '', stderr: `${changes.trim()}\n` } : { status: 0, stdout: 'Checkout unchanged; dependency and cache files inside node_modules are permitted.\n', stderr: '' }
}

export async function runTrackedImports(args: string[], entryPoint: string): Promise<void> {
  const clean = args.includes('--check-clean')
  if (!clean && !process.execArgv.includes('--experimental-import-meta-resolve')) {
    const child = spawnSync(process.execPath, process.execArgv.concat(['--experimental-import-meta-resolve', entryPoint], args), { stdio: 'inherit' })
    process.exitCode = child.status ?? 1
    return
  }
  const packageRoot = resolve(args.find((arg) => !arg.startsWith('--')) ?? dirname(dirname(entryPoint)))
  const result = clean ? checkClean(packageRoot) : await checkTrackedImports(packageRoot, entryPoint)
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exitCode = result.status
}
