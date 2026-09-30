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

function scratchGit(root, args) {
  const result = spawnSync('git', [
    '-C', root,
    '-c', 'user.name=Profile fixture',
    '-c', 'user.email=profile-fixture@example.invalid',
    '-c', 'commit.gpgSign=false',
    '-c', 'core.hooksPath=/dev/null',
    ...args,
  ], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function pinnedSnapshot(inputs) {
  const overrides = Object.fromEntries(inputs.map(({ path }) => [path, readFileSync(join(platformRoot, path))]))
  const root = mirror(overrides)
  unlinkSync(join(root, '.git'))
  scratchGit(root, ['init', '-q', '--initial-branch=snapshot'])
  scratchGit(root, ['add', '-f', '--', ...inputs.map(({ path }) => path)])
  scratchGit(root, ['commit', '-q', '-m', 'Record cited inputs'])
  const commit = scratchGit(root, ['rev-parse', 'HEAD'])
  const dir = mkdtempSync(join(scratch, 'manifest-'))
  const generated = run(['--platform-root', root, '--manifest-dir', dir])
  assert.equal(generated.status, 0, generated.stderr)
  return { root, dir, commit }
}

function replaceLinkedAsset(root, path, content) {
  materialize(root, dirname(path))
  unlinkSync(join(root, path))
  if (content !== null) writeFileSync(join(root, path), content)
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

  test('--check reports an unrelated moved commit and leaves the baseline untouched', () => {
    const { root, dir, commit } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    scratchGit(root, ['commit', '-q', '--allow-empty', '-m', 'Move without changing cited content'])
    const moved = scratchGit(root, ['rev-parse', 'HEAD'])
    assert.notEqual(moved, commit)
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 0, checked.stderr + checked.stdout)
    assert.ok(checked.stdout.includes(`platform moved ${commit} -> ${moved}, cited content unchanged`))
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--strict-commit rejects unrelated commit movement without writes', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    scratchGit(root, ['commit', '-q', '--allow-empty', '-m', 'Move without changing cited content'])
    const checked = run(['--check', '--strict-commit', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stdout, /drift at \$\.platform\.commit/)
    assert.doesNotMatch(checked.stdout, /cited content unchanged/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects inconsistent baseline commit identities', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const path = join(dir, 'assets.json')
    const assets = JSON.parse(readFileSync(path, 'utf8'))
    assets.platformCommit = '0'.repeat(40)
    writeFileSync(path, `${JSON.stringify(assets, null, 2)}\n`)
    const before = snapshotDir(dir)
    scratchGit(root, ['commit', '-q', '--allow-empty', '-m', 'Move with inconsistent baseline identities'])
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stdout, /assets\.json: drift at \$\.platformCommit/)
    assert.doesNotMatch(checked.stdout, /cited content unchanged/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects a moved commit that changes a cited source', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    const path = 'editor/packages/editor/src/shiki/scopedTokens.ts'
    writeFileSync(join(root, path), `${readFileSync(join(root, path), 'utf8')}\n`)
    scratchGit(root, ['add', '--', path])
    scratchGit(root, ['commit', '-q', '-m', 'Change a cited source'])
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1, checked.stderr + checked.stdout)
    assert.match(checked.stdout, /platform\.inputs\[\d+\]\.sha256/)
    assert.doesNotMatch(checked.stdout, /cited content unchanged/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects changed assets after unrelated commit movement', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    const path = `${LANGS_DIST}/tsx.mjs`
    const module = readFileSync(join(root, path), 'utf8')
    replaceLinkedAsset(root, path, module.replace('source.tsx', 'source.changed-tsx'))
    scratchGit(root, ['commit', '-q', '--allow-empty', '-m', 'Move with asset drift'])
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stdout, /assets\.json: drift at/)
    assert.match(checked.stdout, /\.sha256/)
    assert.doesNotMatch(checked.stdout, /cited content unchanged/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects unresolved closures after unrelated commit movement', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    replaceLinkedAsset(root, `${LANGS_DIST}/vue.mjs`, null)
    scratchGit(root, ['commit', '-q', '--allow-empty', '-m', 'Move with unresolved closure'])
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stdout, /drift at/)
    assert.doesNotMatch(checked.stdout, /cited content unchanged/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects changed Oniguruma implementation bytes without writes', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const path = 'node_modules/.bun/@shikijs+engine-oniguruma@4.4.3/node_modules/@shikijs/engine-oniguruma/dist/index.mjs'
    const before = snapshotDir(dir)
    replaceLinkedAsset(root, path, `${readFileSync(join(root, path), 'utf8')}\n`)
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('--check rejects a missing Oniguruma implementation without writes', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const before = snapshotDir(dir)
    replaceLinkedAsset(root, 'node_modules/.bun/@shikijs+engine-oniguruma@4.4.3/node_modules/@shikijs/engine-oniguruma/dist/index.mjs', null)
    const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
    assert.equal(checked.status, 1)
    assert.match(checked.stderr, /index\.mjs/)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('Oniguruma executable local dependencies are fingerprinted', () => {
    const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
    const path = 'node_modules/.bun/@shikijs+engine-oniguruma@4.4.3/node_modules/@shikijs/engine-oniguruma/dist/index.mjs'
    replaceLinkedAsset(root, path, `import './dependency.mjs';\n${readFileSync(join(root, path), 'utf8')}`)
    const dependency = join(root, dirname(path), 'dependency.mjs')
    writeFileSync(dependency, 'export const marker = 1;\n')
    const generated = run(['--platform-root', root, '--manifest-dir', dir])
    assert.equal(generated.status, 0, generated.stderr)
    const before = snapshotDir(dir)
    writeFileSync(dependency, 'export const marker = 2;\n')
    assert.equal(run(['--check', '--platform-root', root, '--manifest-dir', dir]).status, 1)
    assert.deepEqual(snapshotDir(dir), before)
    unlinkSync(dependency)
    assert.equal(run(['--check', '--platform-root', root, '--manifest-dir', dir]).status, 1)
    assert.deepEqual(snapshotDir(dir), before)
  })

  test('unhandled Oniguruma dependency syntax fails extraction', () => {
    const path = 'node_modules/.bun/@shikijs+engine-oniguruma@4.4.3/node_modules/@shikijs/engine-oniguruma/dist/index.mjs'
    const text = readFileSync(join(platformRoot, path), 'utf8')
    assert.throws(() => derive(mirror({ [path]: `${text}\nconst dependency = import('./dependency.mjs');\n` })), /dependency/)
  })

  test('--check validates every structural platformPath against its bytes without writes', () => {
    const structural = JSON.parse(readFileSync(join(here, 'tree-sitter-languages.json'), 'utf8'))
    const cases = [
      [structural.languages[0].queries.highlights.files[1].platformPath, '; changed query\n'],
      [structural.languages[0].wasm.platformPath, null],
      [structural.markdown.resolver.platformPath, 'changed resolver'],
      [structural.runtime.wasm.platformPath, 'changed runtime'],
    ]
    for (const [path, content] of cases) {
      const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
      const before = snapshotDir(dir)
      replaceLinkedAsset(root, path, content)
      const checked = run(['--check', '--platform-root', root, '--manifest-dir', dir])
      assert.equal(checked.status, 1, path)
      assert.match(checked.stderr, /structural/)
      assert.deepEqual(snapshotDir(dir), before)
    }
  })

  test('committed theme implementation changes fail the content check', () => {
    for (const path of [
      'editor/packages/editor/src/shiki/theme-extract.ts',
      'editor/packages/editor/src/theme.ts',
      'editor/packages/editor/src/style-utils.ts',
    ]) {
      const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
      const before = snapshotDir(dir)
      replaceLinkedAsset(root, path, `${readFileSync(join(root, path), 'utf8')}\n`)
      scratchGit(root, ['add', '-f', '--', path])
      scratchGit(root, ['commit', '-q', '-m', 'Change theme implementation'])
      assert.equal(run(['--check', '--platform-root', root, '--manifest-dir', dir]).status, 1, path)
      assert.deepEqual(snapshotDir(dir), before)
    }
  })

  test('source maps reject multiline entries and template values without partial output', () => {
    const path = 'editor/packages/highlighting/src/languages.ts'
    const original = readFileSync(join(platformRoot, path), 'utf8')
    for (const replacement of ["javascriptreact:\n    'jsx',", 'javascriptreact: `jsx`,']) {
      const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
      writeFileSync(join(root, path), original.replace("javascriptreact: 'jsx',", replacement))
      scratchGit(root, ['add', '--', path])
      scratchGit(root, ['commit', '-q', '-m', 'Change map syntax'])
      const before = snapshotDir(dir)
      assert.throws(() => derive(root), /unrecognised/)
      for (const args of [[], ['--check']]) {
        assert.equal(run([...args, '--platform-root', root, '--manifest-dir', dir]).status, 1)
        assert.deepEqual(snapshotDir(dir), before)
      }
    }
  })

  test('source lists reject quoted comments and template strings without invented entries', () => {
    const path = 'editor/packages/highlighting/src/languages.ts'
    const original = readFileSync(join(platformRoot, path), 'utf8')
    for (const replacement of ["new Set(['javascript', /* 'ruby' is a comment */ 'typescript'])", 'new Set([`javascript`, \'typescript\'])']) {
      const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
      writeFileSync(join(root, path), original.replace("new Set(['javascript', 'typescript'])", replacement))
      scratchGit(root, ['add', '--', path])
      scratchGit(root, ['commit', '-q', '-m', 'Change list syntax'])
      assert.throws(() => derive(root), /unrecognised/)
    }
  })

  test('theme entry readers reject unconsumed configuration', () => {
    const path = 'packages/client-core/src/themes/registration.ts'
    const { root } = pinnedSnapshot(first.profile.platform.inputs)
    const original = readFileSync(join(root, path), 'utf8')
    writeFileSync(join(root, path), original.replace("andromeeda: () => import('@shikijs/themes/andromeeda'),", "andromeeda:\n    () => import('@shikijs/themes/andromeeda'),"))
    scratchGit(root, ['add', '--', path])
    scratchGit(root, ['commit', '-q', '-m', 'Change loader syntax'])
    assert.throws(() => derive(root), /unrecognised/)
  })

  test('missing or unrecognized setting fields throw before generation or checking writes', () => {
    const path = 'packages/contracts/src/settings/keys.ts'
    const original = readFileSync(join(platformRoot, path), 'utf8')
    const start = original.indexOf("'editor.maxTokenizationLineLength': defineSetting({")
    const end = original.indexOf('\n  }),', start)
    const setting = original.slice(start, end)
    for (const replacement of [setting.replace("scope: 'application',", "scope: ('application'),"), setting.replace("    scope: 'application',\n", '')]) {
      const { root, dir } = pinnedSnapshot(first.profile.platform.inputs)
      writeFileSync(join(root, path), original.slice(0, start) + replacement + original.slice(end))
      scratchGit(root, ['add', '--', path])
      scratchGit(root, ['commit', '-q', '-m', 'Change setting syntax'])
      const before = snapshotDir(dir)
      assert.throws(() => derive(root), /setting field/)
      for (const args of [[], ['--check']]) {
        assert.equal(run([...args, '--platform-root', root, '--manifest-dir', dir]).status, 1)
        assert.deepEqual(snapshotDir(dir), before)
      }
    }
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

  test('a grammar with a missing, empty or nonstring scopeName fails extraction', () => {
    const path = `${LANGS_DIST}/tsx.mjs`
    const { grammar, imports } = decodeGrammarModule(readFileSync(join(platformRoot, path), 'utf8'))
    for (const scopeName of [undefined, '', 42]) {
      const malformed = { ...grammar, scopeName }
      const root = mirror({ [path]: grammarModule(imports, malformed) })
      assert.throws(() => derive(root), /tsx\.mjs.*scopeName/)
    }
  })

  test('a source file that differs from Platform HEAD fails extraction', () => {
    const path = 'editor/packages/editor/src/shiki/scopedTokens.ts'
    const source = readFileSync(join(platformRoot, path), 'utf8')
    assert.throws(() => derive(mirror({ [path]: `${source}\n` })), /differ from Platform HEAD/)
  })
})
