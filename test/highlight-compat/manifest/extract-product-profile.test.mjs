import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { describe, test } from 'vitest'
import { fileURLToPath } from 'node:url'

import {
  decodeAliasModule,
  decodeGrammarModule,
  decodeThemeModule,
  parseJsonc,
  resolveLockKey,
} from './extract-product-profile.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, 'extract-product-profile.mjs')

function grammarModule(imports, grammar) {
  const head = imports.map((name) => `import ${name.replace(/-/g, '_')} from './${name}.mjs'\n`)
  const spreads = imports.map((name) => `...${name.replace(/-/g, '_')},\n`)
  const payload = JSON.stringify(JSON.stringify(grammar))
  const blank = imports.length > 0 ? '\n' : ''
  return `${head.join('')}${blank}const lang = Object.freeze(JSON.parse(${payload}))\n\nexport default [\n${spreads.join('')}lang\n]\n`
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
