#!/usr/bin/env node
// Derives product-profile.json and assets.json from a Platform checkout. Every input is read as
// data: no Platform or package module is imported or evaluated.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const MANIFEST_DIR = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PLATFORM_ROOT = '/work/projects/platform'
const PROFILE_FILE = 'product-profile.json'
const ASSETS_FILE = 'assets.json'

const SOURCE = {
  languages: 'editor/packages/highlighting/src/languages.ts',
  service: 'editor/packages/highlighting/src/service.ts',
  highlightingTheme: 'editor/packages/highlighting/src/theme.ts',
  highlightingPlugin: 'editor/packages/highlighting/src/plugin.ts',
  shikiPlugin: 'editor/packages/editor/src/shiki/plugin.ts',
  worker: 'editor/packages/editor/src/shiki/shiki.worker.ts',
  workerClient: 'editor/packages/editor/src/shiki/workerClient.ts',
  workerTypes: 'editor/packages/editor/src/shiki/workerTypes.ts',
  tokenizer: 'editor/packages/editor/src/shiki/tokenizer.ts',
  scopedTokens: 'editor/packages/editor/src/shiki/scopedTokens.ts',
  scopePath: 'editor/packages/editor/src/shiki/scopePath.ts',
  editorTokens: 'editor/packages/editor/src/shiki/editor-tokens.ts',
  packedTokens: 'editor/packages/editor/src/syntax/packedTokens.ts',
  shikiTheme: 'editor/packages/editor/src/shiki/theme.ts',
  themeExtract: 'editor/packages/editor/src/shiki/theme-extract.ts',
  effectiveTheme: 'editor/packages/editor/src/theme.ts',
  themeStyleUtils: 'editor/packages/editor/src/style-utils.ts',
  vscodeThemes: 'editor/packages/editor/src/shiki/vscode-themes.ts',
  themeLoaders: 'packages/client-core/src/themes/registration.ts',
  hostCatalog: 'apps/web/src/lib/code-theme/utils/catalog.ts',
  hostRegistrationQuery: 'apps/web/src/lib/code-theme/state/registration-query.ts',
  hostService: 'apps/web/src/lib/highlighting/state/service.ts',
  settings: 'packages/contracts/src/settings/keys.ts',
  lock: 'bun.lock',
}

// Hashed so a change to the Tree-sitter inventory inputs fails --check here too.
const HASHED_INPUTS = [
  'editor/packages/tree-sitter-languages/languages.json',
  'editor/packages/tree-sitter-languages/languages.lock.json',
  'editor/packages/tree-sitter-languages/src/catalog.generated.ts',
  'editor/packages/tree-sitter-languages/src/query-captures.ts',
  'editor/packages/tree-sitter/src/treeSitter/markdown.ts',
  'editor/packages/tree-sitter/src/treeSitter/treeSitter.worker.ts',
  'editor/packages/tree-sitter-languages/package.json',
  'editor/packages/tree-sitter/package.json',
]

// Workspaces whose Shiki declarations the product's highlighting imports resolve through.
const WORKSPACES = ['editor/packages/editor', 'editor/packages/highlighting', 'packages/client-core']

export class ExtractionError extends Error {}

const fail = (message) => new ExtractionError(message)
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const gitBlob = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
const byKey = (key) => (left, right) => (left[key] < right[key] ? -1 : left[key] > right[key] ? 1 : 0)
const sortedStrings = (values) => [...values].sort()
const numeric = (text) => Number(text.replaceAll('_', ''))

// ---------------------------------------------------------------------------------------------
// Readers for the formats the checkout ships. Each rejects structure it does not recognise.

/** JSON with comments and trailing commas, as `bun.lock` is written. */
export function parseJsonc(text) {
  let uncommented = ''
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '"') {
      const end = stringEnd(text, index)
      uncommented += text.slice(index, end)
      index = end
      continue
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end
      uncommented += ' '
      continue
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2)
      if (end === -1) throw fail('bun.lock has an unterminated block comment')
      index = end + 2
      uncommented += ' '
      continue
    }
    uncommented += char
    index += 1
  }
  let out = ''
  let previous = ''
  for (let at = 0; at < uncommented.length; at += 1) {
    const char = uncommented[at]
    if (char === '"') {
      const end = stringEnd(uncommented, at)
      out += uncommented.slice(at, end)
      previous = '"'
      at = end - 1
      continue
    }
    if (char === ',' && previous && !'[{,:'.includes(previous)) {
      let next = at + 1
      while (/\s/.test(uncommented[next] ?? '') && next < uncommented.length) next += 1
      if (uncommented[next] === ']' || uncommented[next] === '}') continue
    }
    out += char
    if (!/\s/.test(char)) previous = char
  }
  return parseJson(out, 'bun.lock')
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw fail(`${label}: ${error.message}`)
  }
}

function stringEnd(text, start) {
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1
    else if (text[index] === '"') return index + 1
  }
  throw fail('bun.lock has an unterminated string')
}

function splitLockKey(key) {
  const parts = key.split('/')
  const segments = []
  for (let index = 0; index < parts.length; index += 1) {
    if (!parts[index].startsWith('@')) segments.push(parts[index])
    else segments.push(`${parts[index]}/${parts[++index]}`)
  }
  return segments
}

/** The lock key Bun resolves `dependency` to from `parentKey`: nested copy first, then outward. */
export function resolveLockKey(lock, parentKey, dependency) {
  const segments = splitLockKey(parentKey)
  for (let depth = segments.length; depth >= 0; depth -= 1) {
    const key = [...segments.slice(0, depth), dependency].join('/')
    if (Object.hasOwn(lock.packages, key)) return key
  }
  return null
}

function decodePayload(line, prefix, label) {
  if (!line?.startsWith(prefix) || !line.endsWith('))')) throw fail(`${label}: payload line not found`)
  const literal = parseJson(line.slice(prefix.length, -2), label)
  if (typeof literal !== 'string') throw fail(`${label}: payload is not a string literal`)
  return parseJson(literal, label)
}

const GRAMMAR_PREFIX = 'const lang = Object.freeze(JSON.parse('
const IMPORT_LINE = /^import (\w+) from '\.\/([^'/]+)\.mjs'$/

/** A generated `@shikijs/langs` grammar module: imports, one payload, and its export array. */
export function decodeGrammarModule(text, label = 'grammar module') {
  const lines = text.split('\n')
  const imports = []
  let at = 0
  for (; IMPORT_LINE.test(lines[at]); at += 1) {
    const [, identifier, target] = lines[at].match(IMPORT_LINE)
    imports.push({ identifier, target })
  }
  if (imports.length > 0 && lines[at++] !== '') throw fail(`${label}: unrecognised line ${at}`)
  const grammar = decodePayload(lines[at++], GRAMMAR_PREFIX, label)
  expectLines(lines, at, ['', 'export default ['], label)
  at += 2
  const spreads = []
  for (; lines[at]?.startsWith('...'); at += 1) spreads.push(lines[at].slice(3).replace(/,$/, ''))
  if (spreads.join() !== imports.map((entry) => entry.identifier).join()) {
    throw fail(`${label}: export spreads do not match its imports`)
  }
  expectLines(lines, at, ['lang', ']', ''], label)
  if (lines.length !== at + 3) throw fail(`${label}: unrecognised trailing content`)
  return { grammar, imports: imports.map((entry) => entry.target) }
}

function expectLines(lines, at, expected, label) {
  for (let offset = 0; offset < expected.length; offset += 1) {
    if (lines[at + offset] !== expected[offset]) throw fail(`${label}: unrecognised line ${at + offset + 1}`)
  }
}

const ALIAS_MODULE = /^\/\* Alias (\S+) for (\S+) \*\/\nexport \{ default \} from '\.\/([^'/]+)\.mjs'\n$/

export function decodeAliasModule(text, label = 'alias module') {
  const match = text.match(ALIAS_MODULE)
  if (!match || match[2] !== match[3]) throw fail(`${label}: not an alias re-export`)
  return { alias: match[1], target: match[2] }
}

export function decodeThemeModule(text, label = 'theme module') {
  const lines = text.split('\n')
  const header = lines[0]?.match(/^\/\* Theme: (\S+) \*\/$/)
  if (!header || lines.length !== 3 || lines[2] !== '') throw fail(`${label}: not a theme module`)
  return { id: header[1], theme: decodePayload(lines[1], 'export default Object.freeze(JSON.parse(', label) }
}

/** A generated catalog array of JSON objects whose `import` values are lazy `import()` calls. */
function decodeCatalogArray(file, name, packagePrefix) {
  const start = file.text.indexOf(`const ${name} = [`)
  const end = file.text.indexOf('\n];', start)
  if (start === -1 || end === -1) throw fail(`${file.label}: ${name} not found`)
  let imports = 0
  const body = file.text
    .slice(start + `const ${name} = `.length, end + 2)
    .replace(/"import": \(\(\) => import\("([^"]+)"\)\)/g, (_, specifier) => {
      imports += 1
      return `"import": ${JSON.stringify(specifier)}`
    })
  const entries = parseJson(body, `${file.label}: ${name}`)
  if (entries.length !== imports) throw fail(`${file.label}: ${name} has an unrecognised import`)
  for (const entry of entries) {
    if (!entry.import.startsWith(packagePrefix)) throw fail(`${file.label}: ${entry.id} imports ${entry.import}`)
  }
  return { entries, evidence: span(file, start, end + 2) }
}

function decodeNameList(file, declaration, pattern) {
  const start = file.text.indexOf(`${declaration} = [\n`)
  const end = file.text.indexOf('\n]', start)
  if (start === -1 || end === -1) throw fail(`${file.label}: ${declaration} not found`)
  const lines = file.text.slice(start + `${declaration} = [\n`.length, end).split('\n')
  const names = lines.map((line) => line.match(pattern)?.[1])
  if (names.includes(undefined)) throw fail(`${file.label}: ${declaration} has an unrecognised entry`)
  return { names, evidence: span(file, start, end + 2) }
}

// ---------------------------------------------------------------------------------------------
// Citations. A citation is recomputed from the file each run, so it cannot go stale.

function lineAt(text, index) {
  let line = 1
  for (let next = text.indexOf('\n'); next !== -1 && next < index; next = text.indexOf('\n', next + 1)) line += 1
  return line
}

function span(file, start, end) {
  const first = lineAt(file.text, start)
  const last = lineAt(file.text, Math.max(start, end - 1))
  return first === last ? `${file.label}:${first}` : `${file.label}:${first}-${last}`
}

/** The citation of `anchor`, which must occur exactly once in `file`. */
function cite(file, anchor) {
  const at = file.text.indexOf(anchor)
  if (at === -1) throw fail(`${file.label} no longer contains ${JSON.stringify(anchor)}`)
  if (file.text.indexOf(anchor, at + 1) !== -1) throw fail(`${file.label} contains ${JSON.stringify(anchor)} more than once`)
  return span(file, at, at + anchor.length)
}

/** Every match of `pattern` in `file`, with its citation. */
function matches(file, pattern, { count } = {}) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const found = [...file.text.matchAll(new RegExp(pattern.source, flags))].map((match) => ({
    groups: match.slice(1),
    evidence: span(file, match.index, match.index + match[0].length),
  }))
  if (count !== undefined && found.length !== count) {
    throw fail(`${file.label}: expected ${count} match(es) of ${pattern}, found ${found.length}`)
  }
  return found
}

const single = (file, pattern) => matches(file, pattern, { count: 1 })[0]

function consumeEntries(text, pattern, label) {
  const entries = []
  let end = 0
  for (const match of text.matchAll(new RegExp(pattern.source, 'gm'))) {
    if (text.slice(end, match.index).trim()) throw fail(`${label}: unrecognised entry`)
    entries.push(match.slice(1))
    end = match.index + match[0].length
  }
  if (text.slice(end).trim()) throw fail(`${label}: unrecognised entry`)
  return entries
}

function blockEntries(file, blockPattern, entryPattern) {
  const block = single(file, blockPattern)
  const entries = consumeEntries(block.groups[0], entryPattern, block.evidence)
  return { entries, evidence: block.evidence }
}

// Only literal data is accepted. Expressions, comments, escapes and template strings need review.
function sourceLiteral(text, label) {
  const token = /\s+|'[^'\\\r\n]*'|"[^"\\\r\n]*"|[A-Za-z_]\w*|-?\d+(?:\.\d+)?|[\[\]{},:]/y
  let json = ''
  let at = 0
  while (at < text.length) {
    token.lastIndex = at
    const match = token.exec(text)
    if (!match) throw fail(`${label}: unrecognised literal at ${at}`)
    const value = match[0]
    at = token.lastIndex
    if (value.startsWith("'") || value.startsWith('"')) {
      json += JSON.stringify(value.slice(1, -1))
      continue
    }
    if (/^[A-Za-z_]/.test(value) && !['true', 'false', 'null'].includes(value)) {
      if (!/^\s*:/.test(text.slice(at))) throw fail(`${label}: unrecognised literal value ${value}`)
      json += JSON.stringify(value)
      continue
    }
    json += value
  }
  return parseJsonc(json)
}

// ---------------------------------------------------------------------------------------------
// The checkout: tracked source inputs and installed packages.

function openCheckout(root) {
  const files = new Map()
  const read = (path) => {
    const existing = files.get(path)
    if (existing) return existing
    const full = join(root, path)
    if (!existsSync(full)) throw fail(`Platform input ${path} is missing`)
    const bytes = readFileSync(full)
    const file = { label: path, bytes, text: bytes.toString('utf8'), sha256: sha256(bytes) }
    files.set(path, file)
    return file
  }
  return { root, files, read }
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    throw fail(`git ${args[0]} failed in ${root}: ${error.message}`)
  }
}

/** The commit whose tracked content equals every source input the manifests were derived from. */
function platformIdentity(checkout) {
  const paths = sortedStrings(checkout.files.keys())
  const commit = git(checkout.root, ['rev-parse', 'HEAD']).trim()
  const listing = git(checkout.root, ['ls-tree', '-r', '--full-tree', 'HEAD', '--', ...paths])
  const blobs = new Map(
    listing
      .split('\n')
      .filter(Boolean)
      .map((line) => [line.split('\t')[1], line.split('\t')[0].split(' ')[2]]),
  )
  const drifted = paths.filter((path) => blobs.get(path) !== gitBlob(checkout.files.get(path).bytes))
  if (drifted.length > 0) throw fail(`Platform inputs differ from Platform HEAD ${commit}: ${drifted.join(', ')}`)
  return {
    commit,
    inputs: paths.map((path) => ({ path, sha256: checkout.files.get(path).sha256 })),
  }
}

/** Follows symlinks with each target resolved against the link's own path, staying inside `root`. */
function followLinks(path, root) {
  let current = path
  for (let hops = 0; hops < 32; hops += 1) {
    const stat = lstatSync(current, { throwIfNoEntry: false })
    if (!stat) return null
    if (!stat.isSymbolicLink()) {
      if (!current.startsWith(root + sep)) throw fail(`${path} resolves outside the Platform root`)
      return current
    }
    current = resolve(dirname(current), readlinkSync(current))
  }
  throw fail(`${path} has a symlink loop`)
}

function installedPackage(checkout, fromDir, name) {
  for (let dir = fromDir; dir.startsWith(checkout.root); dir = dirname(dir)) {
    const candidate = basename(dir) === 'node_modules' ? join(dir, name) : join(dir, 'node_modules', name)
    const found = followLinks(candidate, checkout.root)
    if (found) return openPackage(found)
    if (dir === checkout.root) break
  }
  throw fail(`${name} is not installed where ${fromDir} imports it`)
}

function openPackage(dir) {
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) throw fail(`${dir} has no package.json`)
  const bytes = readFileSync(manifestPath)
  const manifest = JSON.parse(bytes.toString('utf8'))
  return {
    dir,
    manifest,
    name: manifest.name,
    version: manifest.version,
    label: `${manifest.name}@${manifest.version}`,
    manifestSha256: sha256(bytes),
    files: new Map(),
  }
}

function packageFile(pkg, path, { optional = false } = {}) {
  const full = join(pkg.dir, path)
  if (!existsSync(full)) {
    if (optional) return null
    throw fail(`${pkg.label} is missing ${path}`)
  }
  const bytes = readFileSync(full)
  const file = { label: `${pkg.label}/${path}`, path, bytes, text: bytes.toString('utf8'), sha256: sha256(bytes) }
  pkg.files.set(path, file)
  return file
}

/** The file an export subpath selects under the default import conditions. */
function exportTarget(pkg, subpath) {
  let target = pkg.manifest.exports?.[subpath]
  while (target && typeof target === 'object') target = target.import ?? target.default
  if (typeof target !== 'string') throw fail(`${pkg.label} does not export ${subpath}`)
  return target.replace(/^\.\//, '')
}

// ---------------------------------------------------------------------------------------------
// Lock identities.

function lockClosure(checkout) {
  const lockFile = checkout.read(SOURCE.lock)
  const lock = parseJsonc(lockFile.text)
  if (!lock.packages || !lock.workspaces) throw fail('bun.lock has no packages or workspaces')
  const declarations = workspaceDeclarations(checkout, lock)
  const records = new Map()
  const queue = declarations.map((declaration) => declaration.lockKey)
  while (queue.length > 0) {
    const key = queue.shift()
    if (records.has(key)) continue
    const record = lockRecord(lockFile, lock, key)
    records.set(key, record)
    for (const dependency of Object.keys({ ...record.dependencies, ...record.optionalDependencies })) {
      const child = resolveLockKey(lock, key, dependency)
      if (!child) throw fail(`bun.lock has no entry for ${dependency}, a dependency of ${key}`)
      queue.push(child)
    }
  }
  return { declarations, packages: [...records.values()].sort(byKey('lockKey')) }
}

const DEPENDENCY_KINDS = ['dependencies', 'devDependencies', 'peerDependencies']

function workspaceDeclarations(checkout, lock) {
  const declarations = []
  for (const workspace of WORKSPACES) {
    const manifestFile = checkout.read(`${workspace}/package.json`)
    const manifest = JSON.parse(manifestFile.text)
    const locked = lock.workspaces[workspace]
    if (!locked) throw fail(`bun.lock has no workspace ${workspace}`)
    const shikiDependencies = DEPENDENCY_KINDS.flatMap((kind) =>
      Object.entries(manifest[kind] ?? {}).map(([name, range]) => ({ kind, name, range })),
    ).filter(({ name }) => name === 'shiki' || name.startsWith('@shikijs/'))
    for (const { kind, name, range } of shikiDependencies) {
      if (locked[kind]?.[name] !== range) throw fail(`bun.lock and ${workspace}/package.json disagree on ${name}`)
      const lockKey = resolveLockKey(lock, manifest.name, name)
      if (!lockKey) throw fail(`bun.lock cannot resolve ${name} for ${workspace}`)
      const evidence = cite(manifestFile, `${JSON.stringify(name)}: ${JSON.stringify(range)}`)
      declarations.push({ workspace, kind, name, range, lockKey, evidence })
    }
  }
  return declarations
}

function lockRecord(lockFile, lock, key) {
  const [ident, , meta = {}, integrity = null] = lock.packages[key]
  const at = ident.lastIndexOf('@')
  return {
    lockKey: key,
    name: ident.slice(0, at),
    version: ident.slice(at + 1),
    integrity,
    dependencies: meta.dependencies ?? {},
    optionalDependencies: meta.optionalDependencies ?? {},
    evidence: cite(lockFile, `\n    ${JSON.stringify(key)}: [`).replace(/:(\d+)-(\d+)$/, ':$2'),
  }
}

// ---------------------------------------------------------------------------------------------
// Installed Shiki packages, resolved from the workspaces that import them.

function installedShiki(checkout, closure) {
  const from = (workspace) => join(checkout.root, workspace)
  const shiki = installedPackage(checkout, from('editor/packages/editor'), 'shiki')
  const packages = {
    shiki,
    langs: installedPackage(checkout, shiki.dir, '@shikijs/langs'),
    themes: installedPackage(checkout, shiki.dir, '@shikijs/themes'),
    core: installedPackage(checkout, shiki.dir, '@shikijs/core'),
    oniguruma: installedPackage(checkout, from('editor/packages/editor'), '@shikijs/engine-oniguruma'),
  }
  packages.primitive = installedPackage(checkout, packages.core.dir, '@shikijs/primitive')
  packages.textmate = installedPackage(checkout, packages.primitive.dir, '@shikijs/vscode-textmate')
  const sameAs = [
    [installedPackage(checkout, from('editor/packages/highlighting'), 'shiki'), shiki],
    [installedPackage(checkout, from('packages/client-core'), '@shikijs/themes'), packages.themes],
  ]
  for (const [imported, expected] of sameAs) {
    if (imported.dir !== expected.dir) throw fail(`${imported.label} resolves to two installs`)
  }
  const installed = Object.values(packages).map((pkg) => installedRecord(pkg, closure))
  return { packages, installed: installed.sort(byKey('name')) }
}

function installedRecord(pkg, closure) {
  const record = closure.packages.find((entry) => entry.name === pkg.name && entry.version === pkg.version)
  if (!record) throw fail(`installed ${pkg.label} is not in the locked dependency closure`)
  return { name: pkg.name, version: pkg.version, lockKey: record.lockKey, packageJsonSha256: pkg.manifestSha256 }
}

// ---------------------------------------------------------------------------------------------
// Grammar and theme assets.

function readGrammars(langs) {
  const index = packageFile(langs, 'dist/index.mjs')
  const canonical = decodeNameList(index, 'export const languageNames', /^"([^"]+)",?$/)
  const aliases = decodeNameList(index, 'export const languageAliasNames', /^"([^"]+)",?$/)
  const modules = new Map()
  for (const name of canonical.names) modules.set(name, readGrammar(langs, name))
  const aliasModules = aliases.names.map((alias) => readAlias(langs, alias, modules))
  for (const module of modules.values()) {
    const missing = (module.imports ?? []).filter((target) => !modules.has(target))
    if (missing.length > 0) throw fail(`${module.label} imports unknown grammars ${missing.join(', ')}`)
  }
  return { modules, aliasModules, evidence: { canonical: canonical.evidence, aliases: aliases.evidence } }
}

function readGrammar(langs, name) {
  const path = exportTarget(langs, `./${name}`)
  const file = packageFile(langs, path, { optional: true })
  const base = { name, package: langs.name, version: langs.version, path, label: `${langs.label}/${path}` }
  if (!file) return { ...base, sha256: null, status: 'unresolved', imports: null, grammar: null, evidence: null }
  const { grammar, imports } = decodeGrammarModule(file.text, file.label)
  if (grammar.name !== name) throw fail(`${file.label} registers ${grammar.name}`)
  if (typeof grammar.scopeName !== 'string' || grammar.scopeName.length === 0) {
    throw fail(`${file.label} needs a nonempty string scopeName`)
  }
  const payloadAt = file.text.indexOf(GRAMMAR_PREFIX)
  const exportAt = file.text.indexOf('export default [')
  const evidence = {
    payload: span(file, payloadAt, file.text.indexOf('\n', payloadAt)),
    imports: imports.length > 0 ? span(file, 0, payloadAt - 1) : null,
    export: span(file, exportAt, file.text.length),
  }
  return { ...base, sha256: file.sha256, status: 'resolved', imports, grammar, evidence }
}

function readAlias(langs, alias, modules) {
  const path = exportTarget(langs, `./${alias}`)
  const file = packageFile(langs, path, { optional: true })
  const base = { alias, package: langs.name, version: langs.version, path }
  if (!file) return { ...base, target: null, sha256: null, status: 'unresolved' }
  const decoded = decodeAliasModule(file.text, file.label)
  if (decoded.alias !== alias || !modules.has(decoded.target)) throw fail(`${file.label} is not an alias of a known grammar`)
  return { ...base, target: decoded.target, sha256: file.sha256, status: 'resolved' }
}

function readThemes(themes) {
  const index = packageFile(themes, 'dist/index.mjs')
  const list = decodeNameList(index, 'export const themeNames', /^ {2}'([^']+)',$/)
  const assets = list.names.map((id) => {
    const path = exportTarget(themes, `./${id}`)
    const file = packageFile(themes, path, { optional: true })
    const base = { id, package: themes.name, version: themes.version, path }
    if (!file) return { ...base, sha256: null, status: 'unresolved', theme: null }
    const decoded = decodeThemeModule(file.text, file.label)
    if (decoded.id !== id || decoded.theme.name !== id) throw fail(`${file.label} does not define theme ${id}`)
    return { ...base, sha256: file.sha256, status: 'resolved', theme: decoded.theme }
  })
  return { assets, evidence: list.evidence }
}

/** The default export of a grammar module, flattened: dependencies first, then its own grammar. */
function exportOrder(modules, name) {
  const module = modules.get(name)
  if (!module.imports) return null
  const order = []
  for (const target of module.imports) {
    const nested = exportOrder(modules, target)
    if (!nested) return null
    order.push(...nested)
  }
  order.push(name)
  return order
}

/** The registrations the worker keeps: the first of each (name, scopeName) pair. */
function dedupedRegistrations(modules, order) {
  if (!order) return null
  const seen = new Set()
  const kept = []
  for (const name of order) {
    const grammar = modules.get(name).grammar
    const key = `${grammar.name}\0${grammar.scopeName}`
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(name)
  }
  return kept
}

function registrationRecord(module, publicIds) {
  const grammar = module.grammar ?? {}
  const field = (key) => grammar[key] ?? null
  return {
    name: module.name,
    status: module.status,
    public: publicIds.has(module.name),
    scopeName: field('scopeName'),
    aliases: field('aliases'),
    embeddedLangs: field('embeddedLangs'),
    embeddedLangsLazy: field('embeddedLangsLazy'),
    injectTo: field('injectTo'),
    injectionSelector: field('injectionSelector'),
    inlineInjectionSelectors: grammar.injections ? sortedStrings(Object.keys(grammar.injections)) : null,
    balancedBracketSelectors: field('balancedBracketSelectors'),
    unbalancedBracketSelectors: field('unbalancedBracketSelectors'),
    moduleImports: module.imports,
    moduleEvidence: module.evidence,
  }
}

// This package ships a self-contained entry today. Future one-line local ESM dependencies are
// fingerprinted recursively; other dependency syntax fails before a partial closure is emitted.
function readExecutableClosure(pkg, entryPaths) {
  const pending = [...entryPaths]
  const visited = new Set()
  while (pending.length > 0) {
    const path = pending.shift()
    if (visited.has(path)) continue
    visited.add(path)
    const file = packageFile(pkg, path)
    const imports = /^(?:import(?:\s+[^;\n]+?\s+from)?|export\s+[^;\n]+?\s+from)\s*['"]([^'"\n]+)['"];?\s*$/gm
    const rest = file.text.replace(imports, (_, specifier) => {
      if (!specifier.startsWith('.')) throw fail(`${file.label}: unrecognised external dependency ${specifier}`)
      const target = resolve(pkg.dir, dirname(path), specifier)
      if (!target.startsWith(pkg.dir + sep)) throw fail(`${file.label}: dependency escapes the package`)
      pending.push(target.slice(pkg.dir.length + 1))
      return ''
    })
    if (/\b(?:import|require)\b|(?<!\.)\bfrom\b/.test(rest)) throw fail(`${file.label}: unrecognised dependency syntax`)
  }
  return sortedStrings(visited)
}

function readEngine(packages) {
  const { oniguruma, shiki } = packages
  const implementationPath = exportTarget(oniguruma, '.')
  const paths = readExecutableClosure(oniguruma, [implementationPath, exportTarget(oniguruma, './wasm-inlined')])
  const implementation = oniguruma.files.get(implementationPath)
  const inlinedPath = exportTarget(oniguruma, './wasm-inlined')
  const inlined = packageFile(oniguruma, inlinedPath)
  const base64 = single(inlined, /^var binary = Uint8Array\.from\(atob\("([A-Za-z0-9+/=]+)"\), c => c\.charCodeAt\(0\)\);$/m)
  const wasm = Buffer.from(base64.groups[0], 'base64')
  if (wasm.subarray(0, 4).toString('hex') !== '0061736d') throw fail(`${inlined.label} does not hold a WASM binary`)
  const raw = packageFile(shiki, 'dist/onig.wasm', { optional: true })
  return {
    inlined,
    record: {
      implementation: { package: oniguruma.name, version: oniguruma.version, path: implementationPath, sha256: implementation.sha256 },
      localDependencyClosure: paths.filter((path) => path !== implementationPath && path !== inlinedPath),
      module: { package: oniguruma.name, version: oniguruma.version, path: inlinedPath, sha256: inlined.sha256 },
      wasm: { bytes: wasm.length, sha256: sha256(wasm), evidence: base64.evidence },
      rawWasm: raw && {
        package: shiki.name,
        version: shiki.version,
        path: raw.path,
        sha256: raw.sha256,
        sameBytesAsInlined: raw.sha256 === sha256(wasm),
      },
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Product configuration read from the Platform sources.

function stringList(text) {
  return consumeEntries(text, /'([^'\\\r\n]+)'(?:\s*,|(?=\s*$))/, 'source string list').map(([value]) => value)
}

function productLanguages(checkout, catalog, modules) {
  const languages = checkout.read(SOURCE.languages)
  const plugin = checkout.read(SOURCE.shikiPlugin)
  const service = checkout.read(SOURCE.service)
  const overrides = blockEntries(
    languages,
    /const EDITOR_LANGUAGE_GRAMMARS: Readonly<Record<string, BundledLanguageId>> = \{\n([\s\S]*?)\n\}/,
    /^\s+(\w+): '([^']+)',$/,
  )
  const inferred = single(languages, /const EXTENSION_INFERRED_LANGUAGES = new Set\(\[([^\]]*)\]\)/)
  const defaults = blockEntries(plugin, /const DEFAULT_LANGUAGE_MAP: ShikiLanguageMap = \{\n([\s\S]*?)\n\}/, /^\s+(\w+): '([^']+)',$/)
  const preload = single(service, /const DEFAULT_PRELOAD_GRAMMARS = \[\n([\s\S]*?)\n\] as const/)

  const byAlias = new Map()
  const collisions = []
  for (const info of catalog) {
    for (const key of [info.id, ...(info.aliases ?? [])]) {
      if (byAlias.has(key) && byAlias.get(key) !== info.id) collisions.push({ key, first: byAlias.get(key), last: info.id })
      byAlias.set(key, info.id)
    }
  }
  const overrideMap = Object.fromEntries(overrides.entries)
  const excluded = new Set(stringList(inferred.groups[0]))
  const unsorted = Object.fromEntries([...byAlias, ...Object.entries(overrideMap)].filter(([id]) => !excluded.has(id)))
  const documentMap = Object.fromEntries(sortedStrings(Object.keys(unsorted)).map((key) => [key, unsorted[key]]))
  const grammarFor = (label) => overrideMap[label.trim().toLowerCase()] ?? byAlias.get(label.trim().toLowerCase()) ?? null
  const unknownTargets = [...Object.values(overrideMap), ...defaults.entries.map(([, grammar]) => grammar)].filter(
    (grammar) => !modules.has(grammar),
  )
  if (unknownTargets.length > 0) throw fail(`product language maps name unknown grammars ${unknownTargets.join(', ')}`)

  return {
    labelResolution: {
      rule: 'A label is trimmed and lowercased, then looked up in the editor overrides, then in the catalog ids and aliases; no match is plain text.',
      overrides: { entries: overrideMap, evidence: overrides.evidence },
      precedence: cite(languages, 'return EDITOR_LANGUAGE_GRAMMARS[key] ?? GRAMMAR_BY_ALIAS.get(key) ?? null'),
      normalization: cite(languages, 'const key = language.trim().toLowerCase()'),
      catalogAliasSource: cite(languages, '...(info.aliases ?? []).map((alias) => [alias, info.id as BundledLanguageId] as const),'),
      laterEntryWins: collisions,
    },
    documentLanguageMap: {
      rule: 'Documents map every catalog id and alias plus the overrides, minus the ids left to extension inference.',
      excludedForExtensionInference: sortedStrings(excluded),
      excludedEvidence: inferred.evidence,
      evidence: cite(languages, '[...GRAMMAR_BY_ALIAS, ...Object.entries(EDITOR_LANGUAGE_GRAMMARS)].filter('),
      count: Object.keys(documentMap).length,
      entries: documentMap,
    },
    documentResolution: {
      rule: 'A document uses the configured map entry, then .tsx/.jsx extension inference, then the plugin default map.',
      extensionInference: matches(plugin, /if \(languageId === '(\w+)' && extension === '(\.\w+)'\) return '(\w+)'/, { count: 2 }).map(
        ({ groups, evidence }) => ({ languageId: groups[0], extension: groups[1], grammar: groups[2], evidence }),
      ),
      pluginDefaultMap: { entries: Object.fromEntries(defaults.entries), evidence: defaults.evidence },
      evidence: [
        cite(plugin, 'const configured = languages?.[options.languageId]'),
        cite(plugin, 'return extensionLang ?? DEFAULT_LANGUAGE_MAP[options.languageId] ?? null'),
      ],
    },
    preload: {
      rule: 'Without a host census these grammars load in the background after the first highlight.',
      grammars: stringList(preload.groups[0]).map((label) => ({ label, grammar: grammarFor(label) })),
      evidence: preload.evidence,
      delay: cite(checkout.read(SOURCE.worker), '    }, 1_000)'),
    },
    registrationLoading: {
      rule: "A grammar's registrations are its module's default export: dependencies first, then its own grammar; the worker keeps the first of each (name, scopeName).",
      evidence: [
        cite(languages, 'return module.default as unknown as readonly ShikiWorkerLanguageRegistration[]'),
        cite(checkout.read(SOURCE.worker), 'uniqueBy(registrations, (registration) => `${registration.name}\\u0000${registration.scopeName}`)'),
        cite(checkout.read(SOURCE.worker), 'await highlighter.loadLanguage(...(missing as unknown as LanguageRegistration[]))'),
      ],
    },
  }
}

function languagePolicies(checkout) {
  const service = checkout.read(SOURCE.service)
  const plugin = checkout.read(SOURCE.shikiPlugin)
  const worker = checkout.read(SOURCE.worker)
  const languages = checkout.read(SOURCE.languages)
  const plainText = single(service, /const PLAIN_TEXT = '([^']+)'/)
  return {
    sentinels: [
      {
        id: 'unknown-label-is-plain-text',
        value: plainText.groups[0],
        rule: 'A snippet label with no grammar is highlighted with no language and reports this language name.',
        evidence: [plainText.evidence, cite(service, 'language: lang ?? PLAIN_TEXT,'), cite(service, '      : []\n    const lang = grammar')],
      },
      {
        id: 'no-language-returns-theme-only',
        rule: 'The worker returns only the theme when the snippet has no language or no text.',
        evidence: [cite(worker, 'if (!payload.lang || payload.text.length === 0) return { theme }')],
      },
      {
        id: 'unmapped-document-has-no-session',
        rule: 'A document whose language resolves to no grammar gets no highlighter session.',
        evidence: [cite(plugin, '  const lang = shikiLanguageForDocument(sessionOptions, pluginOptions.languages)\n  if (!lang) return null')],
      },
      {
        id: 'no-worker-has-no-session',
        rule: 'Without a worker, documents get no highlighter session.',
        evidence: [cite(plugin, '  if (!owner.canUseWorker()) return null\n\n  const lang')],
      },
    ],
    loadErrors: [
      {
        id: 'known-grammar-load-failure',
        rule: "A known grammar that fails to load rejects the highlight with code 'failed', and the failed load is not cached.",
        evidence: [
          cite(service, "throw new HighlightingError('failed', `The ${grammar} grammar did not load`, {"),
          cite(service, 'void pending.catch(() => this.grammars.delete(language))'),
        ],
      },
      {
        id: 'unknown-grammar-load',
        rule: 'Loading a label with no grammar throws.',
        evidence: [cite(languages, 'if (!grammar) throw new Error(`No Shiki grammar for ${language}`)')],
      },
      {
        id: 'worker-failure',
        rule: "A worker error rejects with code 'failed'; an environment without workers rejects with 'unavailable'.",
        evidence: [
          cite(service, "throw new HighlightingError('failed', 'The highlighting worker failed', { cause: error })"),
          cite(service, "'This environment cannot start a highlighting worker',"),
        ],
      },
      {
        id: 'invalid-registrations',
        rule: 'A resolver answer with no registrations, or one without name and scopeName, throws; a failed answer is evicted from the cache.',
        evidence: [
          cite(plugin, 'throw new Error(`Shiki language resolver returned no registrations for ${language}`)'),
          cite(plugin, 'void pending.catch(() => languagePromises.delete(language))'),
        ],
      },
    ],
  }
}

function productThemes(checkout, themeCatalog) {
  const vscode = checkout.read(SOURCE.vscodeThemes)
  const loaders = checkout.read(SOURCE.themeLoaders)
  const host = checkout.read(SOURCE.hostCatalog)
  const service = checkout.read(SOURCE.service)
  const plugin = checkout.read(SOURCE.shikiPlugin)
  const theme = checkout.read(SOURCE.highlightingTheme)
  const block = single(vscode, /export const VSCODE_THEMES = \[\n([\s\S]*?)\n\] satisfies/)
  const entries = sourceLiteral(`[${block.groups[0]}]`, block.evidence)
  for (const entry of entries) {
    if (Object.keys(entry).sort().join() !== 'id,label,shikiName,type' || !['dark', 'light'].includes(entry.type)) {
      throw fail(`${vscode.label}: VSCODE_THEMES has an unrecognised entry`)
    }
    if (![entry.id, entry.label, entry.shikiName].every((value) => typeof value === 'string' && value.length > 0)) {
      throw fail(`${vscode.label}: VSCODE_THEMES needs string identifiers and labels`)
    }
  }
  const loaderEntries = blockEntries(
    loaders,
    /const VSCODE_THEME_LOADERS = \{\n([\s\S]*?)\n\} satisfies/,
    /^ {2}(?:'([\w-]+)'|(\w+)): \(\) => import\('([^']+)'\),$/,
  )
  const loaderById = new Map(loaderEntries.entries.map(([quoted, bare, specifier]) => [quoted ?? bare, { specifier }]))
  const packageIds = new Set(themeCatalog.map((asset) => asset.id))
  const nativeBlock = single(host, /const BUILTIN_EDITOR_THEMES = \[\n([\s\S]*?)\n\] as const satisfies/)
  const natives = sourceLiteral(`[${nativeBlock.groups[0]}]`, nativeBlock.evidence)
  for (const entry of natives) {
    if (Object.keys(entry).sort().join() !== 'editorTheme,id,label,type' || !['dark', 'light'].includes(entry.type)) {
      throw fail(`${host.label}: BUILTIN_EDITOR_THEMES has an unrecognised entry`)
    }
    if (![entry.id, entry.label].every((value) => typeof value === 'string' && value.length > 0)) {
      throw fail(`${host.label}: BUILTIN_EDITOR_THEMES needs string identifiers and labels`)
    }
  }
  const defaultTheme = single(service, /const DEFAULT_THEME_NAME = '([^']+)'/)
  const pluginDefault = single(plugin, /const DEFAULT_THEME = '([^']+)'/)
  return {
    vscode: entries.map(({ id, label, shikiName, type }) => ({
      id,
      label,
      shikiName,
      type,
      loader: loaderById.get(id)?.specifier ?? null,
      inPackage: packageIds.has(shikiName),
    })),
    vscodeEvidence: block.evidence,
    loaderEvidence: span(loaders, loaders.text.indexOf('const VSCODE_THEME_LOADERS'), loaders.text.indexOf('} satisfies')),
    hostOnly: entries.map((entry) => entry.shikiName).filter((id) => !packageIds.has(id)),
    packageOnly: sortedStrings([...packageIds].filter((id) => !loaderById.has(id))),
    native: natives.map(({ id, label, type }) => ({
      id, label, type,
      evidence: cite(host, `id: '${id}',\n    label: '${label}',\n    type: '${type}',`),
    })),
    defaults: {
      snippet: { theme: defaultTheme.groups[0], evidence: [defaultTheme.evidence, cite(service, 'bundledThemes[DEFAULT_THEME_NAME]()')] },
      plugin: { theme: pluginDefault.groups[0], evidence: pluginDefault.evidence },
    },
    policies: [
      {
        id: 'backend-by-theme-format',
        rule: 'Imported VS Code themes color documents through the Shiki highlighter; native palettes color through Tree-sitter captures.',
        evidence: [cite(service, "return theme.current().format === 'vscode'"), cite(service, 'if (structure && requested.format === \'editor\') {')],
      },
      {
        id: 'host-loader',
        rule: 'The host loads a selected theme as the default export of its bundled ESM module; there is no JSONC parsing or include resolution.',
        evidence: [cite(loaders, 'return loader().then((module) => module.default)'), cite(checkout.read(SOURCE.hostRegistrationQuery), 'const registration = await loadVscodeThemeRegistration(theme)')],
      },
      {
        id: 'worker-registration-copy',
        rule: 'Before the worker sees a registration, the service copies settings and tokenColors arrays and drops undefined workbench colors.',
        evidence: [
          cite(theme, 'colors: definedColors(registration.colors),'),
          cite(theme, 'settings: registration.settings?.map(copyThemeSetting),'),
          cite(theme, 'tokenColors: registration.tokenColors?.map(copyThemeSetting),'),
        ],
      },
      {
        id: 'content-revision-name',
        rule: 'A theme is loaded under a name that changes whenever its content does.',
        evidence: [cite(theme, 'return `${name}@${contentHash(JSON.stringify(content))}`')],
      },
      {
        id: 'native-palette-conversion',
        rule: 'A native palette converts to a TextMate theme with a source-scope foreground rule and one rule per mapped syntax color.',
        evidence: [
          cite(theme, 'return workerThemeRegistration(editorThemeToShikiTheme(palette, { name, type }), name)'),
          cite(checkout.read(SOURCE.shikiTheme), "{ scope: ['source'], settings: { foreground } },"),
        ],
      },
    ],
  }
}

function tokenization(checkout, packages) {
  const scoped = checkout.read(SOURCE.scopedTokens)
  const client = checkout.read(SOURCE.workerClient)
  const tokenizer = checkout.read(SOURCE.tokenizer)
  const settings = checkout.read(SOURCE.settings)
  const primitive = packageFile(packages.primitive, 'dist/index.mjs')
  const core = packageFile(packages.core, 'dist/index.mjs')
  const textmate = packageFile(packages.textmate, 'dist/index.js')

  const call = single(scoped, /grammar\.tokenizeLine\((\w+), (\w+), (\d+)\)/)
  const limitCheck = single(scoped, /if \(line\.length (>=?) maxLineLength\)/)
  const emptyCheck = cite(scoped, 'if (!line) return { tokens: [], state: previousState }')
  const setting = single(settings, /'editor\.maxTokenizationLineLength': defineSetting\(\{\n([\s\S]*?)\n {2}\}\),/)
  const settingField = (pattern) => {
    const found = [...setting.groups[0].matchAll(new RegExp(pattern.source, 'g'))]
    if (found.length !== 1) throw fail(`${settings.label}: setting field ${pattern} needs exactly one match`)
    return found[0].slice(1)
  }
  const [minimum, maximum] = settingField(/v\.minValue\(([\d_]+)\), v\.maxValue\(([\d_]+)\)/).map(numeric)
  const fallback = single(client, /export const DEFAULT_SHIKI_MAX_TOKENIZATION_LINE_LENGTH = ([\d_]+)/)
  const apiDefaults = single(primitive, /const \{ (tokenizeMaxLineLength = [^}]+) \} = options;/)
  const hastDefaults = single(core, /const \{ (mergeWhitespaces = [^}]+) \} = options;/)
  const apiLimit = single(primitive, /line\.length (>=?) tokenizeMaxLineLength/)
  const limit = numeric(settingField(/default: ([\d_]+),/)[0])
  const scope = settingField(/scope: '(\w+)',/)[0]
  if (![minimum, maximum, limit].every(Number.isSafeInteger) || minimum < 1 || maximum < minimum || limit < minimum || limit > maximum) {
    throw fail(`${settings.label}: setting field bounds or default are invalid`)
  }
  if (!['application', 'machine', 'window'].includes(scope)) throw fail(`${settings.label}: setting field scope is invalid`)
  const exceeds = (comparator, length) => (comparator === '>' ? length > limit : length >= limit)
  const outcome = (comparator, length) => (exceeds(comparator, length) ? 'plain' : 'tokenized')

  return {
    grammarCall: {
      rule: 'Each non-empty line within the limit is tokenized with the rule stack the previous line ended in; a time limit of 0 disables the time check.',
      timeLimit: Number(call.groups[2]),
      evidence: [call.evidence, cite(textmate, 'if (timeLimit !== 0) {')],
    },
    lineLimit: {
      rule: 'A line longer than the limit becomes one token with an empty scope path, painted with the theme defaults, and passes the incoming grammar state on unchanged.',
      productComparator: limitCheck.groups[0],
      emptyLineCheckedFirst: scoped.text.indexOf('if (!line) return') < scoped.text.indexOf('if (line.length'),
      setting: 'editor.maxTokenizationLineLength',
      settingDefault: limit,
      settingScope: scope,
      settingMinimum: minimum,
      settingMaximum: maximum,
      settingEvidence: setting.evidence,
      ownerFallback: numeric(fallback.groups[0]),
      shikiApiComparator: apiLimit.groups[0],
      // Reference adapters must reproduce these before any comparison near the limit is scored.
      referenceCases: [
        ...[limit - 1, limit, limit + 1].map((length) => ({
          id: `line-length-${length}`,
          length,
          product: outcome(limitCheck.groups[0], length),
          shikiTokenApiAtSameLimit: outcome(apiLimit.groups[0], length),
        })),
        {
          id: 'plain-line-inside-open-construct',
          rule: 'A line over the limit inside an unterminated construct leaves the next line in that construct, because the incoming state passes through.',
        },
      ],
      evidence: [
        limitCheck.evidence,
        cite(scoped, 'tokens: [scopedToken(line, 0, line.length, styleFor([]))],'),
        cite(scoped, 'untokenized: true,'),
        fallback.evidence,
        cite(client, 'if (value === undefined || !Number.isInteger(value) || value < 1)'),
        cite(client, 'if (this.openedLineLimit !== worker.maxTokenizationLineLength) this.opened = false'),
        cite(client, "{ type: 'highlight', ...request, maxLineLength: this.maxTokenizationLineLength() },"),
        cite(checkout.read(SOURCE.hostService), "maxTokenizationLineLength: () => readSettingsMirror()['editor.maxTokenizationLineLength'],"),
        cite(checkout.read(SOURCE.service), 'maxTokenizationLineLength: this.options.maxTokenizationLineLength,'),
        apiLimit.evidence,
      ],
    },
    lines: [
      {
        id: 'line-split',
        rule: 'Text splits on LF; a CR ending a line is removed from that line, and every separator counts as one UTF-16 unit in offsets.',
        evidence: [
          cite(tokenizer, "return code.split('\\n').map((line) => (line.endsWith('\\r') ? line.slice(0, -1) : line))"),
          cite(checkout.read(SOURCE.editorTokens), 'return lineStart + lineLength + (lineIndex < lineCount - 1 ? 1 : 0)'),
        ],
      },
      {
        id: 'empty-line',
        rule: 'An empty line yields no tokens and passes the incoming grammar state on unchanged.',
        evidence: [emptyCheck],
      },
      {
        id: 'incremental-edits',
        rule: 'An edit retokenizes from the state before its first line until the end state matches the old one; a batch applies highest offset first.',
        evidence: [
          cite(tokenizer, 'const initialState = start.line === 0 ? undefined : this.lines[start.line - 1]?.endState'),
          cite(tokenizer, 'if (this.statesEqual(state, this.lines[i - 1]?.endState)) break'),
          cite(tokenizer, 'return edits.toSorted(compareEditsDescending).map((edit) => this.applyEdit(edit))'),
          cite(scoped, 'left.stack.equals(right.stack)'),
        ],
      },
      {
        id: 'untokenized-count',
        rule: 'The tokenizer counts lines left plain by the limit, and every worker answer carries that count.',
        evidence: [cite(tokenizer, 'if (this.lines[index]?.untokenized) this.untokenized--'), cite(checkout.read(SOURCE.worker), 'untokenizedLines: state.tokenizer.untokenizedLineCount(),')],
      },
    ],
    installedShikiDefaults: {
      rule: 'Defaults of the installed Shiki token and HAST APIs. The product tokenizes through grammar.tokenizeLine directly, so none of them applies to it.',
      tokenApi: { values: destructuredDefaults(apiDefaults.groups[0]), evidence: apiDefaults.evidence },
      hastApi: { values: destructuredDefaults(hastDefaults.groups[0]), evidence: hastDefaults.evidence },
      tokenApiEmptyLine: cite(primitive, 'if (line === "") {'),
      colorReplacements: cite(primitive, 'const colorReplacements = resolveColorReplacements(theme, options);'),
    },
  }
}

function destructuredDefaults(text) {
  const entries = consumeEntries(text, /(\w+) = (true|false|-?\d+(?:\.\d+)?)(?:,\s*|(?=\s*$))/, 'Shiki option defaults')
  return Object.fromEntries(entries.map(([key, value]) => [key, JSON.parse(value)]))
}

function scopedOutput(checkout) {
  const scoped = checkout.read(SOURCE.scopedTokens)
  const editorTokens = checkout.read(SOURCE.editorTokens)
  const packed = checkout.read(SOURCE.packedTokens)
  const worker = checkout.read(SOURCE.worker)
  const bits = matches(editorTokens, /^const FONT_STYLE_(\w+) = (\d+)$/m)
  if (bits.length !== matches(editorTokens, /^const FONT_STYLE_\w+ =/m).length) {
    throw fail(`${editorTokens.label}: unrecognised font style constant`)
  }
  const packedType = single(packed, /export type PackedEditorTokens = \{\n([\s\S]*?)\n\}/)
  const engineImport = single(worker, /^import wasm from '([^']+)'$/m)
  const options = single(worker, /createHighlighterCore\(\{\n([\s\S]*?)\n {2}\}\)/)
  return {
    highlighter: {
      rule: 'The worker builds its highlighter with only these options and tokenizes through the product wrapper, not the Shiki token API.',
      options: consumeEntries(options.groups[0], /^ {4}(\w+): (?:createOnigurumaEngine\(wasm\)|\w+ as unknown as \w+\[\]),$/, options.evidence).map(([name]) => name),
      engineImport: engineImport.groups[0],
      evidence: [options.evidence, engineImport.evidence, cite(worker, 'engine: createOnigurumaEngine(wasm),')],
    },
    scopes: [
      {
        id: 'scope-stack-interning',
        rule: 'Tokens with the same ordered scope list share one style entry keyed by the whole list.',
        evidence: [cite(scoped, "const key = scopes.join('\\u0000')"), cite(scoped, 'for (const scope of scopes) path = new ScopePath(path, scope)')],
      },
      {
        id: 'theme-matching',
        rule: 'Theme rules are matched from the outermost scope inward; a match overrides the foreground unless it is 0 and the font style unless it is -1.',
        evidence: [
          cite(scoped, 'for (const path of paths.reverse()) {'),
          cite(scoped, 'if (match.foregroundId !== 0) foreground = match.foregroundId'),
          cite(scoped, 'if (match.fontStyle !== -1) fontStyle = match.fontStyle'),
        ],
      },
      {
        id: 'recolor-without-reparse',
        rule: 'A theme change recolors the retained scope entries without tokenizing again.',
        evidence: [cite(scoped, 'for (const style of styles.values()) applyTheme(style, theme)')],
      },
      {
        id: 'token-boundaries',
        rule: 'Tokens starting at or past the line end are dropped; every other raw token becomes one token, with no coalescing.',
        evidence: [cite(scoped, '.filter((token) => token.startIndex < line.length)'), cite(scoped, 'scopedToken(line, token.startIndex, token.endIndex, styleFor(token.scopes)),')],
      },
      {
        id: 'public-token-fields',
        rule: 'A token exposes content, offset, color and fontStyle; its scopes stay private to the tokenizer.',
        evidence: [cite(scoped, 'const TOKEN_STYLE_PROPERTIES = {'), cite(checkout.read(SOURCE.scopePath), 'export class ScopePath implements TextmateScopePath {')],
      },
    ],
    editorTokens: {
      rule: 'Tokens become editor tokens at document offsets; empty tokens and tokens with no style are dropped, and equal styles share one palette entry.',
      fontStyleBits: Object.fromEntries(bits.map(({ groups }) => [groups[0].toLowerCase(), Number(groups[1])])),
      packedFields: consumeEntries(packedType.groups[0], /^ {2}readonly (\w+): (?:Uint32Array|readonly EditorTokenStyle\[\]|boolean)$/, packedType.evidence).map(([name]) => name),
      evidence: [
        ...bits.map((bit) => bit.evidence),
        cite(editorTokens, 'return Object.keys(style).length > 0 ? style : null'),
        cite(editorTokens, 'return `${token.color ?? \'\'}\\u0000${token.bgColor ?? \'\'}\\u0000${fontStyle}`'),
        cite(editorTokens, '    const entry = internEditorTokenStyle(token, palette)\n    if (!entry) continue\n\n    const start = lineStart + token.offset\n    writePackedEditorToken('),
        packedType.evidence,
      ],
    },
  }
}

function registryBehaviour(packages) {
  const primitive = packages.primitive.files.get('dist/index.mjs') ?? packageFile(packages.primitive, 'dist/index.mjs')
  return [
    { id: 'first-registration-wins', rule: 'Loading a grammar whose name is already loaded does nothing.', evidence: [cite(primitive, 'if (this.getGrammar(lang.name)) return;')] },
    { id: 'bracket-selectors', rule: 'Balanced bracket selectors default to every scope.', evidence: [cite(primitive, 'balancedBracketSelectors: lang.balancedBracketSelectors || ["*"],')] },
    {
      id: 'lazy-embedding-reload',
      rule: 'Loading a grammar reloads every loaded grammar that lists it in embeddedLangsLazy.',
      evidence: [cite(primitive, 'const embeddedLazilyBy = new Set([...this._langMap.values()].filter((i) => i.embeddedLangsLazy?.includes(lang.name)));')],
    },
    { id: 'injection-lookup', rule: 'Injections registered with injectTo apply to every dotted prefix of the target scope.', evidence: [cite(primitive, 'getInjections(scopeName) {')] },
    { id: 'grammar-aliases', rule: "A grammar's own aliases are registered with it.", evidence: [cite(primitive, 'this._alias[alias] = lang.name;')] },
    {
      id: 'theme-normalization',
      rule: 'Shiki moves tokenColors to settings when settings is absent, defaults the type to dark, and replaces non-hex colors with generated placeholders.',
      evidence: [
        cite(primitive, 'if (theme.tokenColors && !theme.settings) {'),
        cite(primitive, 'theme.type ||= "dark";'),
        cite(primitive, 'const replaceFg = setting.settings?.foreground && !setting.settings.foreground.startsWith("#");'),
      ],
    },
  ]
}

// ---------------------------------------------------------------------------------------------
// Structural assets are a separately authored inventory, validated before either output is written.

function validateStructuralInventory(checkout) {
  const inventory = parseJson(readFileSync(join(MANIFEST_DIR, 'tree-sitter-languages.json'), 'utf8'), 'structural inventory')
  for (const input of inventory.inputs) {
    if (checkout.read(input.file).sha256 !== input.sha256) throw fail(`structural input ${input.file} changed`)
  }
  const pending = [inventory]
  while (pending.length > 0) {
    const value = pending.shift()
    if (value === null || typeof value !== 'object') continue
    if (Object.hasOwn(value, 'platformPath')) validateStructuralAsset(checkout, value)
    pending.push(...Object.values(value))
  }
  for (const language of inventory.languages) {
    for (const query of Object.values(language.queries)) validateStructuralQuery(checkout, query, inventory.registry.captureMappings)
  }
}

function validateStructuralAsset(checkout, asset) {
  if (typeof asset.platformPath !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '')) {
    throw fail('structural asset needs a platformPath and SHA-256')
  }
  const path = resolve(checkout.root, asset.platformPath)
  if (!path.startsWith(checkout.root + sep)) throw fail('structural asset path escapes Platform')
  if (!existsSync(path)) throw fail(`structural asset ${asset.platformPath} is missing`)
  if (sha256(readFileSync(path)) !== asset.sha256) throw fail(`structural asset ${asset.platformPath} changed`)
  if (asset.lockedSha256 && asset.lockedSha256 !== asset.sha256) throw fail(`structural asset ${asset.platformPath} disagrees with its lock`)
}

function validateStructuralQuery(checkout, query, mappings) {
  if (query.files.length === 0) {
    if (query.combinedLockedSha256 !== null && query.combinedLockedSha256 !== sha256('')) {
      throw fail('structural empty query has a nonempty combined hash')
    }
    return
  }
  const content = query.files.map((file) => readFileSync(join(checkout.root, file.platformPath), 'utf8')).join('\n')
  const mapped = content.replace(/;[^\n]*|"(?:\\.|[^"\\])*"|@([a-zA-Z_][a-zA-Z0-9_.-]*)/g, (token, name) => {
    if (!name || !Object.hasOwn(mappings, name)) return token
    return `@${mappings[name]}`
  })
  if (sha256(mapped) !== query.combinedLockedSha256) throw fail('structural query composition changed')
}

// ---------------------------------------------------------------------------------------------
// Assembly.

export function derive(platformRoot) {
  const checkout = openCheckout(resolve(platformRoot))
  for (const path of Object.values(SOURCE)) checkout.read(path)
  for (const path of HASHED_INPUTS) checkout.read(path)
  validateStructuralInventory(checkout)
  const closure = lockClosure(checkout)
  const { packages, installed } = installedShiki(checkout, closure)

  const catalogFile = packageFile(packages.shiki, exportTarget(packages.shiki, './langs'))
  const bundle = single(catalogFile, /^import \{[^}]+\} from "\.\/(langs-bundle-full-[\w-]+\.mjs)";$/m)
  const bundleFile = packageFile(packages.shiki, `dist/${bundle.groups[0]}`)
  const catalog = decodeCatalogArray(bundleFile, 'bundledLanguagesInfo', '@shikijs/langs/')
  const themeCatalogFile = packageFile(packages.shiki, exportTarget(packages.shiki, './themes'))
  const themeCatalog = decodeCatalogArray(themeCatalogFile, 'bundledThemesInfo', '@shikijs/themes/')

  const grammars = readGrammars(packages.langs)
  const themes = readThemes(packages.themes)
  const engine = readEngine(packages)
  const publicIds = new Set(catalog.entries.map((entry) => entry.id))
  const catalogTargets = catalog.entries.map((entry) => entry.import.slice('@shikijs/langs/'.length))
  const unknown = catalogTargets.filter((target) => !grammars.modules.has(target))
  if (unknown.length > 0) throw fail(`${bundleFile.label} imports unknown grammars ${unknown.join(', ')}`)
  const themeIds = themes.assets.map((asset) => asset.id)
  if (sortedStrings(themeCatalog.entries.map((entry) => entry.id)).join() !== sortedStrings(themeIds).join()) {
    throw fail(`${themeCatalogFile.label} and the @shikijs/themes index list different themes`)
  }

  const catalogOrders = new Map(catalogTargets.map((target) => [target, exportOrder(grammars.modules, target)]))
  const unresolvedCatalogIds = catalog.entries
    .filter((entry) => catalogOrders.get(entry.import.slice('@shikijs/langs/'.length)) === null)
    .map((entry) => entry.id)
  const registrationClosure = {
    status: unresolvedCatalogIds.length > 0 ? 'unresolved' : 'resolved',
    unresolvedCatalogIds,
  }
  const reachable = new Set()
  const queue = [...catalogTargets]
  while (queue.length > 0) {
    const name = queue.shift()
    if (reachable.has(name)) continue
    reachable.add(name)
    queue.push(...(grammars.modules.get(name).imports ?? []))
  }
  const hostThemes = productThemes(checkout, themes.assets)
  const hostThemeIds = new Set(hostThemes.vscode.map((theme) => theme.shikiName))

  const profile = {
    schema: 'highlight-compat/product-profile@1',
    platform: null,
    packages: {
      declarations: closure.declarations,
      lockClosure: closure.packages,
      installed,
    },
    engine: {
      name: 'oniguruma',
      rule: 'The worker passes the inlined Oniguruma WASM to createOnigurumaEngine.',
      ...engine.record,
    },
    languages: {
      catalog: {
        rule: 'The product selects grammars from Shiki’s bundled language catalog by id or catalog alias.',
        evidence: catalog.evidence,
        aliasCount: catalog.entries.reduce((sum, entry) => sum + (entry.aliases?.length ?? 0), 0),
        entries: catalog.entries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          aliases: entry.aliases ?? [],
          module: entry.import,
          registrationStatus: catalogOrders.get(entry.import.slice('@shikijs/langs/'.length)) === null ? 'unresolved' : 'resolved',
          registrations: dedupedRegistrations(grammars.modules, catalogOrders.get(entry.import.slice('@shikijs/langs/'.length))),
        })),
      },
      registrations: [...grammars.modules.values()].map((module) => ({
        ...registrationRecord(module, publicIds),
        reachableFromCatalog: reachable.has(module.name) || (registrationClosure.status === 'unresolved' ? null : false),
      })),
      registrationEvidence: grammars.evidence,
      registrationClosure,
      ...productLanguages(checkout, catalog.entries, grammars.modules),
      ...languagePolicies(checkout),
    },
    themes: { ...hostThemes, packageCatalog: { count: themeIds.length, evidence: themes.evidence } },
    tokenization: tokenization(checkout, packages),
    output: scopedOutput(checkout),
    registry: registryBehaviour(packages),
  }

  const assets = {
    schema: 'highlight-compat/assets@1',
    platformCommit: null,
    grammars: [...grammars.modules.values()].map((module) => ({
      name: module.name,
      package: module.package,
      version: module.version,
      path: module.path,
      sha256: module.sha256,
      status: module.status,
      public: publicIds.has(module.name),
      imports: module.imports,
    })),
    aliases: grammars.aliasModules,
    themes: themes.assets.map(({ theme, ...asset }) => ({ ...asset, hostSelectable: hostThemeIds.has(asset.id) })),
    engine: [engine.record.module, ...(engine.record.rawWasm ? [engine.record.rawWasm] : [])],
    runtime: runtimeFiles(packages, new Set([...grammarPaths(grammars), ...themes.assets.map((asset) => asset.path), engine.record.module.path])),
  }

  const identity = platformIdentity(checkout)
  profile.platform = identity
  assets.platformCommit = identity.commit
  return { profile, assets }
}

function grammarPaths(grammars) {
  return [...[...grammars.modules.values()].map((module) => module.path), ...grammars.aliasModules.map((alias) => alias.path)]
}

function runtimeFiles(packages, assetPaths) {
  const records = []
  for (const pkg of Object.values(packages)) {
    for (const file of pkg.files.values()) {
      if (assetPaths.has(file.path) && (pkg === packages.langs || pkg === packages.themes || pkg === packages.oniguruma)) continue
      if (file.path === 'dist/onig.wasm') continue
      records.push({ package: pkg.name, version: pkg.version, path: file.path, sha256: file.sha256 })
    }
  }
  return records.sort((left, right) => `${left.package}/${left.path}`.localeCompare(`${right.package}/${right.path}`))
}

// ---------------------------------------------------------------------------------------------
// CLI.

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`

function differences(expected, actual, path = '$', found = []) {
  if (found.length >= 20 || Object.is(expected, actual)) return found
  const bothObjects = typeof expected === 'object' && typeof actual === 'object' && expected && actual
  if (!bothObjects || Array.isArray(expected) !== Array.isArray(actual)) {
    found.push(path)
    return found
  }
  for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    differences(expected[key], actual[key], Array.isArray(expected) ? `${path}[${key}]` : `${path}.${key}`, found)
  }
  return found
}

function parseArgs(argv) {
  const options = { check: false, strictCommit: false, platformRoot: DEFAULT_PLATFORM_ROOT, manifestDir: MANIFEST_DIR }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') options.check = true
    else if (arg === '--strict-commit') options.strictCommit = true
    else if (arg === '--platform-root') options.platformRoot = argv[++index]
    else if (arg === '--manifest-dir') options.manifestDir = argv[++index]
    else throw fail(`unknown argument ${arg}; usage: extract-product-profile.mjs [--check] [--strict-commit] [--platform-root DIR] [--manifest-dir DIR]`)
    if (options.platformRoot === undefined || options.manifestDir === undefined) throw fail(`${arg} needs a directory`)
  }
  return options
}

function summary({ profile, assets }) {
  const unresolved = [...assets.grammars, ...assets.aliases, ...assets.themes].filter((asset) => asset.status !== 'resolved').length
  return [
    `platform ${profile.platform.commit}`,
    `catalog languages ${profile.languages.catalog.entries.length} (${profile.languages.catalog.aliasCount} aliases)`,
    `grammar registrations ${profile.languages.registrations.length}`,
    `alias modules ${assets.aliases.length}`,
    `themes: package ${assets.themes.length}, host vscode ${profile.themes.vscode.length}, native ${profile.themes.native.length}`,
    `unresolved assets ${unresolved}`,
  ].join('\n')
}

export function main(argv) {
  let options
  let derived
  try {
    options = parseArgs(argv)
    derived = derive(options.platformRoot)
  } catch (error) {
    if (!(error instanceof ExtractionError)) throw error
    console.error(`extraction failed: ${error.message}`)
    return 1
  }
  const outputs = [
    [PROFILE_FILE, derived.profile],
    [ASSETS_FILE, derived.assets],
  ]
  if (!options.check) {
    for (const [name, value] of outputs) writeFileSync(join(options.manifestDir, name), serialize(value))
    console.log(summary(derived))
    return 0
  }
  const recorded = outputs.map(([name, value]) => {
    const path = join(options.manifestDir, name)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    return { name, value, current, parsed: current === null ? null : JSON.parse(current) }
  })
  const baselineCommit = recorded[0].parsed?.platform?.commit
  const matchingCommits = typeof baselineCommit === 'string' && recorded[1].parsed?.platformCommit === baselineCommit
  let drifted = false
  for (const { name, value, current, parsed } of recorded) {
    let expected = value
    if (!options.strictCommit && matchingCommits) {
      expected = name === PROFILE_FILE
        ? { ...value, platform: { ...value.platform, commit: baselineCommit } }
        : { ...value, platformCommit: baselineCommit }
    }
    if (current === serialize(expected)) {
      console.log(`${name}: ok`)
      continue
    }
    drifted = true
    const paths = current === null ? ['file missing'] : differences(parsed, expected)
    console.log(`${name}: drift at ${paths.join(', ')}`)
  }
  if (!drifted && !options.strictCommit && matchingCommits && baselineCommit !== derived.profile.platform.commit) {
    console.log(`platform moved ${baselineCommit} -> ${derived.profile.platform.commit}, cited content unchanged`)
  }
  console.log(summary(derived))
  return drifted ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
