import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { languageRegistrations, themeModule } from '../src/oracles/assets.ts'
import { readProductProfile } from '../src/oracles/pins.ts'
import { parsePortHeader, PORT_DIR, portHeaders, portProblems } from '../src/oracles/product/port-headers.ts'
import { tokenScopes } from '../src/oracles/product/scopedTokens.ts'
import { workerThemeRegistration } from '../src/oracles/product/theme.ts'
import { createIncrementalTokenizer } from '../src/oracles/product/tokenizer.ts'
import { ensureHighlighter } from '../src/oracles/product/worker.ts'

const platform = readProductProfile().platform

describe('product port headers', () => {
  const headers = portHeaders()

  it('cover the tokenizer, scoped tokens, scope path, theme copy and worker registration', () => {
    expect(headers.map((header) => header.platformPath).sort()).toEqual([
      'editor/packages/editor/src/shiki/scopePath.ts',
      'editor/packages/editor/src/shiki/scopedTokens.ts',
      'editor/packages/editor/src/shiki/shiki.worker.ts',
      'editor/packages/editor/src/shiki/tokenizer.ts',
      'editor/packages/highlighting/src/theme.ts',
    ])
  })

  it("match product-profile.json's cited source hashes at the locked commit", () => {
    expect(portProblems(headers, platform)).toEqual([])
  })

  it('fail when a ported file records another blob hash', () => {
    const text = readFileSync(join(PORT_DIR, 'tokenizer.ts'), 'utf8')
    const mutated = text.replace(/(platform-blob-sha256: )([0-9a-f])/, (_all, label: string, digit: string) => `${label}${digit === '0' ? '1' : '0'}`)
    const header = parsePortHeader('tokenizer.ts', mutated)
    expect(header).toBeDefined()
    if (header === undefined) return
    expect(portProblems([header], platform)).toEqual([
      expect.stringContaining('tokenizer.ts: ported blob'),
    ])
  })

  it('fail when a ported file names another commit or an uncited source', () => {
    const [first] = headers
    if (first === undefined) throw new Error('no port headers')
    expect(portProblems([{ ...first, commit: 'f'.repeat(40) }], platform)).toEqual([expect.stringContaining('the profile locks')])
    expect(portProblems([{ ...first, platformPath: 'editor/x.ts' }], platform)).toEqual([expect.stringContaining('is not a cited source')])
  })
})

describe('ported product tokenizer', () => {
  const limit = 12
  let tokenizer: Awaited<ReturnType<typeof createIncrementalTokenizer>>['tokenizer']

  beforeAll(async () => {
    const highlighter = await ensureHighlighter({
      languageRegistrations: await languageRegistrations('typescript'),
      themeRegistration: workerThemeRegistration(await themeModule('github-dark'), 'github-dark'),
      themeRegistrations: [],
    })
    ;({ tokenizer } = await createIncrementalTokenizer({ lang: 'typescript', theme: 'github-dark', highlighter, maxLineLength: limit }))
  })

  const scopesOf = (code: string) => {
    tokenizer.reset(code)
    return tokenizer.getTokens().map((line) => line.map((token) => [token.content, tokenScopes(token).join(' ')]))
  }

  it('skips an empty line and keeps the state, so `1` stays inside the declaration', () => {
    expect(scopesOf('const x =\n\n1')[2]).toEqual([['1', 'source.ts meta.var.expr.ts constant.numeric.decimal.ts']])
  })

  it('tokenizes a line of exactly the limit and leaves a longer one as one scopeless token', () => {
    const [atLimit, over] = scopesOf(`let s = 'ab'\nlet s = 'abc'`)
    expect(atLimit?.length).toBeGreaterThan(1)
    expect(over).toEqual([["let s = 'abc'", '']])
    expect(tokenizer.untokenizedLineCount()).toBe(1)
  })

  it('strips a CR before LF from the line text', () => {
    tokenizer.reset('a\r\nb')
    expect(tokenizer.getSnapshot().lines.map((line) => line.text)).toEqual(['a', 'b'])
  })

  it('reaches the same tokens by incremental edits as by a fresh pass', () => {
    tokenizer.reset('/* a\nb */\nlet c = 1\n')
    tokenizer.applyEdits([{ from: 0, to: 2, text: '' }, { from: 18, to: 19, text: '2' }])
    const edited = tokenizer.getTokens().map((line) => line.map((token) => `${token.content}|${tokenScopes(token).join(' ')}`))
    expect(tokenizer.getCode()).toBe(' a\nb */\nlet c = 2\n')
    expect(scopesOf(' a\nb */\nlet c = 2\n').map((line) => line.map(([content, scopes]) => `${content}|${scopes}`))).toEqual(edited)
  })

  it('reads scopes only from its own tokens', () => {
    expect(() => tokenScopes({ content: 'x', offset: 0 })).toThrow('not a scoped token')
  })
})
