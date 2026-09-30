import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  decodeAliasModule,
  decodeGrammarModule,
  decodeThemeModule,
  derive,
  parseJsonc,
  resolveLockKey,
} from './extract-product-profile.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'extract-product-profile.mjs')
const platformRoot = process.env.PLATFORM_ROOT ?? '/work/projects/platform'
const scratch = mkdtempSync(join(tmpdir(), 'tsx-l0-profile-test-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

const LANGS_DIST = 'node_modules/.bun/@shikijs+langs@4.4.3/node_modules/@shikijs/langs/dist'
const THEMES_DIST = 'node_modules/.bun/@shikijs+themes@4.4.3/node_modules/@shikijs/themes/dist'

function grammarModule(imports, grammar) {
  const head = imports.map((name) => `import ${name.replace(/-/g, '_')} from './${name}.mjs'\n`)
  const spreads = imports.map((name) => `...${name.replace(/-/g, '_')},\n`)
  const payload = JSON.stringify(JSON.stringify(grammar))
  const blank = imports.length > 0 ? '\n' : ''
  return `${head.join('')}${blank}const lang = Object.freeze(JSON.parse(${payload}))\n\nexport default [\n${spreads.join('')}lang\n]\n`
}

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
}

function snapshotDir(dir) {
  return readdirSync(dir)
    .sort()
    .map((name) => {
      const path = join(dir, name)
      return [name, statSync(path).mtimeMs, readFileSync(path, 'utf8')]
    })
}

// A checkout whose entries are symlinks into the real Platform root, with only the named files replaced.
function mirror(overrides) {
  const root = mkdtempSync(join(scratch, 'mirror-'))
  populate(root, platformRoot)
  for (const [path, content] of Object.entries(overrides)) {
    materialize(root, dirname(path))
    unlinkSync(join(root, path))
    if (content !== null) writeFileSync(join(root, path), content)
  }
  return root
}

function populate(dir, real) {
  for (const name of readdirSync(real)) symlinkSync(join(real, name), join(dir, name))
}

function materialize(root, path) {
  if (path === '.' || path === '') return
  materialize(root, dirname(path))
  const target = join(root, path)
  if (!lstatSync(target).isSymbolicLink()) return
  unlinkSync(target)
  mkdirSync(target)
  populate(target, join(platformRoot, path))
}

describe('readers', () => {
  test('parseJsonc drops trailing commas but keeps string content', () => {
    const parsed = parseJsonc('{\n  "a": ["x,]", "y",],\n  "b": { "c": "// not a comment", },\n}\n')
    assert.deepEqual(parsed, { a: ['x,]', 'y'], b: { c: '// not a comment' } })
  })

  test('parseJsonc rejects an unterminated block comment without hanging', () => {
    const code = `import assert from 'node:assert/strict';
      import { parseJsonc } from ${JSON.stringify(script)};
      assert.throws(() => parseJsonc('{"a": 1, /* unfinished'), /unterminated block comment/);`
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      encoding: 'utf8',
      timeout: 2000,
    })
    assert.equal(result.error, undefined, result.error?.message)
    assert.equal(result.status, 0, result.stderr)
  })

  test('parseJsonc rejects malformed strings and commas', () => {
    assert.throws(() => parseJsonc('{"a": "unfinished}'), /unterminated string/)
    assert.throws(() => parseJsonc('{"a": "\\q"}'), /bun\.lock/)
    assert.throws(() => parseJsonc('{"a": [1,,]}'), /bun\.lock/)
    assert.throws(() => parseJsonc('{"a": [,]}'), /bun\.lock/)
    assert.throws(() => parseJsonc('{,}'), /bun\.lock/)
    assert.throws(() => parseJsonc('{"a": 1,,'), /bun\.lock/)
    assert.throws(() => parseJsonc('{"a": 1/* separated */2}'), /bun\.lock/)
  })

  test('parseJsonc handles long trailing whitespace and comments after commas', () => {
    assert.deepEqual(parseJsonc(`{"a": [1,${' '.repeat(128)}]}`), { a: [1] })
    assert.deepEqual(parseJsonc('{"a": [1, /* closed */], // tail\n}'), { a: [1] })
  })

  test('resolveLockKey prefers the nested copy, then its ancestors, then the hoisted one', () => {
    const lock = { packages: { 'b': [], 'a/@s/c/b': [], '@s/c': [] } }
    assert.equal(resolveLockKey(lock, 'a/@s/c', 'b'), 'a/@s/c/b')
    assert.equal(resolveLockKey(lock, 'a', '@s/c'), '@s/c')
    assert.equal(resolveLockKey(lock, 'x', 'b'), 'b')
    assert.equal(resolveLockKey(lock, 'x', 'missing'), null)
  })

  test('decodeGrammarModule decodes an escaped payload and keeps import order', () => {
    const grammar = { name: 'demo', scopeName: 'source.demo', patterns: [{ match: '\\"\\\\s' }] }
    const decoded = decodeGrammarModule(grammarModule(['css', 'html-derivative'], grammar))
    assert.deepEqual(decoded.grammar, grammar)
    assert.deepEqual(decoded.imports, ['css', 'html-derivative'])
    assert.deepEqual(decodeGrammarModule(grammarModule([], grammar)).imports, [])
  })

  test('decodeGrammarModule rejects spreads that differ from imports', () => {
    const text = grammarModule(['css', 'html'], { name: 'x' }).replace('...css,\n...html,', '...html,\n...css,')
    assert.throws(() => decodeGrammarModule(text), /spreads/)
  })

  test('decodeGrammarModule rejects unrecognised statements', () => {
    const module = grammarModule([], { name: 'x' })
    assert.throws(() => decodeGrammarModule(`${module}export const extra = 1\n`), /unrecognised/)
    assert.throws(() => decodeGrammarModule(`${module}\nexport const extra = 1\n`), /unrecognised/)
    assert.throws(() => decodeGrammarModule('const lang = JSON.parse("{}")\n'), /payload/)
  })

  test('decodeAliasModule accepts only the exact alias re-export', () => {
    const text = "/* Alias js for javascript */\nexport { default } from './javascript.mjs'\n"
    assert.deepEqual(decodeAliasModule(text), { alias: 'js', target: 'javascript' })
    assert.throws(() => decodeAliasModule(text.replace("'./javascript.mjs'", "'./ts.mjs'")), /alias/)
    assert.throws(() => decodeAliasModule(`${text}export const x = 1\n`), /alias/)
  })

  test('decodeThemeModule reads the theme payload and rejects extra statements', () => {
    const theme = { name: 'demo', tokenColors: [] }
    const text = `/* Theme: demo */\nexport default Object.freeze(JSON.parse(${JSON.stringify(JSON.stringify(theme))}))\n`
    assert.deepEqual(decodeThemeModule(text), { id: 'demo', theme })
    assert.throws(() => decodeThemeModule(`${text}export const x = 1\n`), /theme/)
  })
})

describe('the Platform checkout', () => {
  const first = derive(platformRoot)

  test('derivation is deterministic', () => {
    const second = derive(platformRoot)
    assert.equal(JSON.stringify(second), JSON.stringify(first))
  })

  test('catalog, registrations and themes are complete', () => {
    const { languages, themes } = first.profile
    assert.equal(languages.catalog.entries.length, 242)
    assert.equal(languages.registrations.length, 260)
    assert.equal(themes.vscode.length, 65)
    assert.equal(themes.native.length, 2)
    assert.ok(first.assets.grammars.every((asset) => asset.status === 'resolved'))
    const vue = languages.catalog.entries.find((entry) => entry.id === 'vue')
    assert.equal(vue.registrations.at(-1), 'vue')
    assert.ok(vue.registrations.indexOf('javascript') < vue.registrations.indexOf('vue'))
  })

  test('registrations cite their payload, imports and export order', () => {
    const records = first.profile.languages.registrations
    assert.ok(records.every((record) => /\.mjs:\d+(?:-\d+)?$/.test(record.moduleEvidence?.payload)))
    const vue = records.find((record) => record.name === 'vue')
    assert.match(vue.moduleEvidence.imports, /vue\.mjs:1-/)
    assert.match(vue.moduleEvidence.export, /vue\.mjs:\d+-\d+$/)
    const tsx = records.find((record) => record.name === 'tsx')
    assert.equal(tsx.moduleEvidence.imports, null)
    assert.equal(first.profile.languages.registrationClosure.status, 'resolved')
  })

  test('a missing grammar marks affected registration closures unresolved', () => {
    const changed = derive(mirror({ [`${LANGS_DIST}/javascript.mjs`]: null }))
    const { languages } = changed.profile
    const javascript = languages.registrations.find((record) => record.name === 'javascript')
    assert.equal(javascript.status, 'unresolved')
    assert.equal(javascript.moduleEvidence, null)
    const vue = languages.catalog.entries.find((entry) => entry.id === 'vue')
    assert.equal(vue.registrationStatus, 'unresolved')
    assert.equal(vue.registrations, null)
    assert.equal(languages.registrationClosure.status, 'unresolved')
    assert.ok(languages.registrationClosure.unresolvedCatalogIds.includes('vue'))
    assert.equal(javascript.reachableFromCatalog, true)
  })

  test('a missing root leaves hidden dependency reachability unknown', () => {
    const { languages } = derive(mirror({ [`${LANGS_DIST}/vue.mjs`]: null })).profile
    const hidden = languages.registrations.find((record) => record.name === 'vue-directives')
    assert.equal(hidden.status, 'resolved')
    assert.equal(hidden.reachableFromCatalog, null)
    const root = languages.registrations.find((record) => record.name === 'vue')
    assert.equal(root.reachableFromCatalog, true)
    assert.ok(languages.registrationClosure.unresolvedCatalogIds.includes('vue'))
  })

  test('an installed package version outside the lock fails extraction', () => {
    const path = 'node_modules/.bun/shiki@4.4.3/node_modules/shiki/package.json'
    const manifest = JSON.parse(readFileSync(join(platformRoot, path), 'utf8'))
    manifest.version = '0.0.0-mismatch'
    assert.throws(() => derive(mirror({ [path]: JSON.stringify(manifest) })), /not in the locked dependency closure/)
  })

  test('the line limit comes from the setting and the wrapper, and differs from the Shiki API', () => {
    const limit = first.profile.tokenization.lineLimit
    assert.equal(limit.settingDefault, 20000)
    assert.equal(limit.ownerFallback, 20000)
    assert.equal(limit.productComparator, '>')
    assert.equal(limit.shikiApiComparator, '>=')
    assert.equal(first.profile.tokenization.grammarCall.timeLimit, 0)
    const cases = limit.referenceCases.filter((entry) => entry.length !== undefined)
    assert.deepEqual(
      cases.map((entry) => [entry.length, entry.product, entry.shikiTokenApiAtSameLimit]),
      [
        [19999, 'tokenized', 'tokenized'],
        [20000, 'tokenized', 'plain'],
        [20001, 'plain', 'plain'],
      ],
    )
  })

  test('--check passes on freshly written manifests and writes nothing', () => {
    const dir = mkdtempSync(join(scratch, 'manifest-'))
    assert.equal(run(['--platform-root', platformRoot, '--manifest-dir', dir]).status, 0)
    const before = snapshotDir(dir)
    const checked = run(['--check', '--platform-root', platformRoot, '--manifest-dir', dir])
    assert.equal(checked.status, 0, checked.stderr)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check fails on a manifest edit and still writes nothing', () => {
    const dir = mkdtempSync(join(scratch, 'manifest-'))
    run(['--platform-root', platformRoot, '--manifest-dir', dir])
    const path = join(dir, 'product-profile.json')
    const profile = JSON.parse(readFileSync(path, 'utf8'))
    profile.tokenization.grammarCall.timeLimit = 500
    writeFileSync(path, `${JSON.stringify(profile, null, 2)}\n`)
    const before = snapshotDir(dir)
    const checked = run(['--check', '--platform-root', platformRoot, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stdout, /tokenization\.grammarCall\.timeLimit/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('a changed grammar asset is drift', () => {
    const tsx = readFileSync(join(platformRoot, LANGS_DIST, 'tsx.mjs'), 'utf8')
    const root = mirror({ [`${LANGS_DIST}/tsx.mjs`]: tsx.replace('"scopeName\\":\\"source.tsx\\"', '"scopeName\\":\\"source.tsx2\\"') })
    const changed = derive(root)
    const registration = changed.profile.languages.registrations.find((entry) => entry.name === 'tsx')
    assert.equal(registration.scopeName, 'source.tsx2')
    const before = first.assets.grammars.find((asset) => asset.name === 'tsx').sha256
    assert.notEqual(changed.assets.grammars.find((asset) => asset.name === 'tsx').sha256, before)
    const dir = mkdtempSync(join(scratch, 'manifest-'))
    run(['--platform-root', platformRoot, '--manifest-dir', dir])
    assert.equal(run(['--check', '--platform-root', root, '--manifest-dir', dir]).status, 1)
  })

  test('a missing theme asset is recorded as unresolved', () => {
    const changed = derive(mirror({ [`${THEMES_DIST}/nord.mjs`]: null }))
    const nord = changed.assets.themes.find((asset) => asset.id === 'nord')
    assert.deepEqual([nord.status, nord.sha256], ['unresolved', null])
  })

  test('a missing catalog index fails extraction', () => {
    assert.throws(() => derive(mirror({ [`${LANGS_DIST}/index.mjs`]: null })), /index\.mjs/)
  })

  test('a malformed grammar module fails extraction', () => {
    const tsx = readFileSync(join(platformRoot, LANGS_DIST, 'tsx.mjs'), 'utf8')
    assert.throws(() => derive(mirror({ [`${LANGS_DIST}/tsx.mjs`]: `${tsx}export const x = 1\n` })), /tsx\.mjs/)
  })

  test('a source file that differs from Platform HEAD fails extraction', () => {
    const path = 'editor/packages/editor/src/shiki/scopedTokens.ts'
    const source = readFileSync(join(platformRoot, path), 'utf8')
    assert.throws(() => derive(mirror({ [path]: `${source}\n` })), /differ from Platform HEAD/)
  })
})
