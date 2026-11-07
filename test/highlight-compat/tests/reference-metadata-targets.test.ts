import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import wasm from '@shikijs/engine-oniguruma/wasm-inlined'
import { createHighlighterCore, type LanguageRegistration } from 'shiki/core'
import { EncodedTokenMetadata } from '@shikijs/vscode-textmate'
import { languageRegistrations, themeModule } from '../src/oracles/assets.ts'
import { canonicalRoot, decodeTokenLanguages, LanguageCodebook, observeBinaryLines, ReferenceMetadataCapture } from '../src/oracles/metadata.ts'
import { loadRootGrammar, registrationGrammarSet } from '../src/oracles/raw.ts'
import { documentOracle } from '../src/oracles/oracles.ts'
import { ORACLE_PROFILES } from '../src/oracles/request.ts'
import { createIncrementalTokenizer } from '../src/oracles/product/tokenizer.ts'
import { tokenScopes } from '../src/oracles/product/scopedTokens.ts'
import { textmateEngine, type GrammarSet, type TextmateEngine } from '../src/oracles/textmate.ts'

const root: LanguageRegistration = { name: 'metadata-root', scopeName: 'source.metadata-root', repository: {}, embeddedLangs: ['metadata-child'],
  patterns: [{ begin: '\\[', end: '\\]', contentName: 'source.metadata-child', patterns: [{ include: 'source.metadata-child' }] }] }
const child: LanguageRegistration = { name: 'metadata-child', scopeName: 'source.metadata-child', repository: {}, patterns: [{ match: 'child', name: 'string.metadata-child' }] }
const sample = 'left [child] right'
const synthetic: GrammarSet = { rootScope: root.scopeName, grammar: scope => [root, child].find(entry => entry.scopeName === scope), injections: () => undefined }
const codebook = (rootId = 37, childId = 73) => new LanguageCodebook([
  { nativeId: rootId, languageId: root.name, scopeName: root.scopeName },
  { nativeId: childId, languageId: child.name, scopeName: child.scopeName },
])
let engines: TextmateEngine[]
let highlighter: Awaited<ReturnType<typeof createHighlighterCore>>

beforeAll(async () => {
  engines = [await textmateEngine('upstream'), await textmateEngine('shiki-fork')]
  highlighter = await createHighlighterCore({ engine: createOnigurumaEngine(wasm), themes: [await themeModule('github-dark')],
    langs: [child, root].concat(await languageRegistrations('javascript'), await languageRegistrations('jsx'), await languageRegistrations('html')) })
})
afterAll(() => highlighter?.dispose())

async function rawAllocation(engine: TextmateEngine, rootId: number, childId: number) {
  const { grammar, registry } = await loadRootGrammar(engine, synthetic, { initialLanguage: rootId, embeddedLanguages: { [child.scopeName]: childId } })
  try {
    const result = grammar.tokenizeLine2(sample, null)
    const capture = new ReferenceMetadataCapture(sample, 'raw', codebook(rootId, childId), [])
    capture.observe(sample, result)
    return { tokens: result.tokens, native: Array.from(result.tokens).filter((_value, index) => index % 2 === 1).map(value => value & 255), outcome: capture.outcome() }
  } finally { registry.dispose() }
}

describe('actual pinned binary allocations', () => {
  it.each(['javascript', 'jsx', 'json'])('uses the actual locked %s module bytes', (language) => {
    const require = createRequire(import.meta.url)
    const assets: unknown = JSON.parse(readFileSync(new URL('../manifest/assets.json', import.meta.url), 'utf8'))
    if (typeof assets !== 'object' || assets === null || !('grammars' in assets) || !Array.isArray(assets.grammars)) throw new Error('invalid grammar manifest')
    const entry: unknown = assets.grammars.find(item => item.name === language)
    if (typeof entry !== 'object' || entry === null || !('sha256' in entry)) throw new Error('missing locked grammar')
    expect(createHash('sha256').update(readFileSync(require.resolve(`@shikijs/langs/${language}`))).digest('hex')).toBe(entry.sha256)
  })
  it('bounds successful whole-source semantics to the actual JSON grammar without external includes or injections', async () => {
    const registrations = await languageRegistrations('json')
    expect(registrations.map(entry => entry.name)).toEqual(['json'])
    const json = registrations[0]
    expect(json.scopeName).toBe('source.json')
    expect(json.embeddedLangs ?? []).toEqual([])
    expect(json.embeddedLangsLazy ?? []).toEqual([])
    expect(json.injections ?? {}).toEqual({})
    expect(json.injectTo ?? []).toEqual([])
    expect(includes(json).every(include => include.startsWith('#') || include === '$self' || include === '$base')).toBe(true)
  })
  it.each([0, 1])('normalizes distinct root/child allocations on engine %i', async (index) => {
    const first = await rawAllocation(engines[index], 37, 73)
    const second = await rawAllocation(engines[index], 53, 91)
    expect(first.native).toEqual([37, 73, 37])
    expect(second.native).toEqual([53, 91, 53])
    expect(first.outcome.kind).toBe('measured')
    if (first.outcome.kind !== 'measured' || second.outcome.kind !== 'measured') throw new Error('missing observation')
    expect(first.outcome.track).toEqual({ languageIds: [root.name, child.name], spans: [0, 6, 0, 6, 11, 1, 11, 18, 0] })
    expect(second.outcome.track).toEqual(first.outcome.track)
    expect(first.outcome.codebook).not.toBe(second.outcome.codebook)
    const rootOnly = new LanguageCodebook([{ nativeId: 37, languageId: root.name, scopeName: root.scopeName }])
    expect(() => decodeTokenLanguages(first.tokens, sample.length, rootOnly)).toThrow('unmapped native language ID 73')
  })

  it.each(['javascript', 'jsx'])('binds actual %s to its canonical registration, with no other bit or scope change', async (language) => {
    const registrations = await languageRegistrations(language)
    const rootBinding = canonicalRoot(language, registrations)
    expect(rootBinding).toEqual({ nativeId: 1, languageId: language, scopeName: language === 'jsx' ? 'source.js.jsx' : 'source.js' })
    for (const engine of engines) await checkActualAllocation(engine, language, registrations)
  })

  it('rejects a canonical name bound to the other actual root', async () => {
    const registrations = await languageRegistrations('jsx')
    const wrong = registrations.map(entry => ({ ...entry, scopeName: 'source.js' }))
    expect(() => canonicalRoot('jsx', wrong)).toThrow('canonical registration')
  })
})

async function checkActualAllocation(engine: TextmateEngine, language: string, registrations: LanguageRegistration[]) {
  const grammars = registrationGrammarSet(language, registrations)
  const old = await loadRootGrammar(engine, grammars)
  const configured = await loadRootGrammar(engine, grammars, { initialLanguage: 1 })
  try {
    const source = language === 'jsx' ? 'const x = <A>🌿</A>;' : 'const x = "🌿";'
    expect(configured.grammar.tokenizeLine(source, null).tokens).toEqual(old.grammar.tokenizeLine(source, null).tokens)
    const before = old.grammar.tokenizeLine2(source, null).tokens
    const after = configured.grammar.tokenizeLine2(source, null).tokens
    expect(Array.from(before, (value, index) => index % 2 ? value & ~255 : value)).toEqual(Array.from(after, (value, index) => index % 2 ? value & ~255 : value))
    expect(Array.from(before).filter((_value, index) => index % 2).every(value => (value & 255) === 0)).toBe(true)
    expect(() => decodeTokenLanguages(before, source.length, new LanguageCodebook([canonicalRoot(language, registrations)]))).toThrow('language ID 0')
    const names = decodeTokenLanguages(after, source.length, new LanguageCodebook([canonicalRoot(language, registrations)]))
    expect(names.every(span => span.value === language)).toBe(true)
  } finally { old.registry.dispose(); configured.registry.dispose() }
}

describe('strict codebook and coverage', () => {
  it.each([0, 256, -1, 1.5])('rejects allocation %s before calling the target', (nativeId) => {
    expect(() => codebook(nativeId)).toThrow('1..255')
  })
  it('rejects duplicate IDs, duplicate names and conflicting canonical scope bindings', () => {
    expect(() => codebook(37, 37)).toThrow('codebook')
    const entry = { nativeId: 1, languageId: 'json', scopeName: 'source.json' }
    expect(() => new LanguageCodebook([entry, { ...entry, nativeId: 2 }])).toThrow('codebook')
    expect(() => new LanguageCodebook([entry, { ...entry, nativeId: 2, languageId: 'jsx' }])).toThrow('codebook')
  })
  it('canonicalizes entry and property order in the per-request codebook identity', () => {
    const first = { nativeId: 37, languageId: root.name, scopeName: root.scopeName }
    const second = { scopeName: child.scopeName, languageId: child.name, nativeId: 73 }
    expect(new LanguageCodebook([second, first]).identity).toBe(codebook().identity)
  })
  it.each([0, 99])('rejects emitted unset/unmapped ID %i with no successful partial track', (id) => {
    const capture = new ReferenceMetadataCapture('abc', 'raw', codebook(), [])
    capture.observe('abc', { tokens: new Uint32Array([0, id]), stoppedEarly: false })
    expect(capture.outcome()).toMatchObject({ kind: 'unavailable', ranges: [{ from: 0, to: 3, reason: expect.stringContaining('language ID') }] })
  })
  it('rejects stopped-early and missing observations', () => {
    const stopped = new ReferenceMetadataCapture('abc', 'raw', codebook(), [])
    stopped.observe('abc', { tokens: new Uint32Array([0, 37]), stoppedEarly: true })
    expect(stopped.outcome()).toMatchObject({ kind: 'unavailable', ranges: [{ from: 0, to: 3, reason: expect.stringContaining('stopped early') }] })
    expect(new ReferenceMetadataCapture('abc', 'raw', codebook(), []).outcome().kind).toBe('unavailable')
  })
  it.each([[0, 37, 2], [1, 37], [0, 37, 4, 73], []])('rejects malformed binary coverage %j', (...tokens) => {
    expect(() => decodeTokenLanguages(new Uint32Array(tokens), 3, codebook())).toThrow()
  })
  it('checks the decoder against the exported fork helper', () => {
    for (const packed of [37, 73, 0xdeadbeef >>> 0])
      expect(packed & 255).toBe(EncodedTokenMetadata.getLanguageId(packed))
  })
  it('does not strip an extra CR before CRLF in the product source-line sequence', () => {
    const capture = new ReferenceMetadataCapture('{}\r\r\n{}', 'product', codebook(), [])
    capture.observe('{}\r', { tokens: new Uint32Array([0, 37]), stoppedEarly: false })
    capture.observe('{}', { tokens: new Uint32Array([0, 37]), stoppedEarly: false })
    expect(capture.outcome()).toEqual({ kind: 'unavailable', codebook: codebook().identity,
      ranges: [{ from: 3, to: 5, reason: 'physical separator or product final CR has no observed language' }] })
  })
})

it('observes only nonempty within-limit calls while preserving the open-construct line sequence', () => {
  const source = '/*\r\n\r\n' + 'a'.repeat(20000) + '\n*/ const x = 1;\r'
  const calls: string[] = []
  const grammar = highlighter.getLanguage('javascript')
  const tokens = observeBinaryLines(grammar, line => { calls.push(line) }, () => highlighter.codeToTokensBase(source, {
    lang: 'javascript', theme: 'github-dark', includeExplanation: 'scopeName', tokenizeMaxLineLength: 20000, tokenizeTimeLimit: 0,
  }))
  expect(calls).toEqual(['/*', '*/ const x = 1;\r'])
  expect(tokens).toHaveLength(4)
  expect(tokens[1]).toEqual([])
  expect(tokens[2][0].explanation).toBeUndefined()
})
it.each([root.name, 'html'])('does not infer an encoded child in %s', (lang) => {
  const grammar = highlighter.getLanguage(lang)
  const source = lang === 'html' ? '<script>const x = 1;</script>' : sample
  let ids: number[] = []
  const tokens = observeBinaryLines(grammar, (_line, result) => {
    ids = ids.concat(nativeIds(result.tokens))
  }, () => highlighter.codeToTokensBase(source, { lang, theme: 'github-dark', includeExplanation: 'scopeName', tokenizeTimeLimit: 0 }))
  expect(new Set(ids)).toEqual(new Set([1]))
  const childScope = lang === 'html' ? 'source.js' : child.scopeName
  expect(hasScope(tokens, childScope)).toBe(true)
  expect(tokens.flat().every(token => !('languageId' in token))).toBe(true)
})
it('restores the exact own-property state on observer failure and target failure', () => {
  const grammar = highlighter.getLanguage(root.name)
  const descriptor = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  expect(() => observeBinaryLines(grammar, () => { throw new Error('observation failed') }, () => grammar.tokenizeLine2(sample, null, 0))).toThrow('observation failed')
  expect(grammar.tokenizeLine2).toBe(original)
  expect(Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')).toEqual(descriptor)
  expect(() => observeBinaryLines(grammar, () => undefined, () => { throw new Error('target failed') })).toThrow('target failed')
  expect(Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')).toEqual(descriptor)
  expect(grammar.tokenizeLine2(sample, null, 0).stoppedEarly).toBe(false)
})

function nativeIds(tokens: Uint32Array): number[] {
  return Array.from(tokens).filter((_value, index) => index % 2).map(value => value & 255)
}

function includes(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const own = 'include' in value && typeof value.include === 'string' ? [value.include] : []
  return own.concat(Object.values(value).flatMap(includes))
}

it('scopes native ID 1 to each actual selected Shiki registration, including aliases', () => {
  expect(highlighter.getLanguage('js').name).toBe('javascript')
  for (const language of ['javascript', 'jsx']) {
    const grammar = highlighter.getLanguage(language)
    const source = language === 'jsx' ? 'const x = <A/>;' : 'const x = 1;'
    expect(grammar.name).toBe(language)
    expect(new Set(nativeIds(grammar.tokenizeLine2(source, null, 0).tokens))).toEqual(new Set([1]))
  }
})

function hasScope(lines: ReturnType<typeof highlighter.codeToTokensBase>, scopeName: string): boolean {
  const scopes = lines.flat().flatMap(token => token.explanation ?? []).flatMap(part => part.scopes)
  return scopes.some(scope => scope.scopeName === scopeName)
}

function snapshot(tokenizer: Awaited<ReturnType<typeof createIncrementalTokenizer>>['tokenizer']) {
  return JSON.stringify(tokenizer.getSnapshot().lines.map(line => ({ text: line.text,
    tokens: line.tokens.map(token => ({ ...token, scopes: tokenScopes(token) })) })))
}

it('product observation stays inside the same owner, preserves full snapshot and scope/binary states, and cannot contaminate later defaults', async () => {
  const grammar = highlighter.getLanguage('jsx')
  const binary = vi.spyOn(grammar, 'tokenizeLine2')
  const scope = vi.spyOn(grammar, 'tokenizeLine')
  const source = 'const x = <A>\r\n\r\n{1}</A>;\n' + 'a'.repeat(20001) + '\nconst y = "🌿";\r'
  const options = { highlighter, lang: 'jsx', theme: 'github-dark', code: source, maxLineLength: 20000 }
  try {
    const baseline = (await createIncrementalTokenizer(options)).tokenizer
    expect(binary).not.toHaveBeenCalled()
    scope.mockClear()
    const observed: string[] = []
    const actual = (await createIncrementalTokenizer({ ...options, binaryObserver: line => { observed.push(line) } })).tokenizer
    expect(snapshot(actual)).toBe(snapshot(baseline))
    expect(observed).toEqual(['const x = <A>', '{1}</A>;', 'const y = "🌿";'])
    expect(binary.mock.calls).toEqual(scope.mock.calls)
    expect(binary.mock.results.every((result, index) => result.type === 'return' && result.value.ruleStack.equals(scope.mock.results[index].value.ruleStack))).toBe(true)
    expect(actual.untokenizedLineCount()).toBe(1)
    await expect(createIncrementalTokenizer({ ...options, binaryObserver: () => { throw new Error('observer failed') } })).rejects.toThrow('observer failed')
    binary.mockClear()
    expect(snapshot((await createIncrementalTokenizer(options)).tokenizer)).toBe(snapshot(baseline))
    expect(binary).not.toHaveBeenCalled()
  } finally { binary.mockRestore(); scope.mockRestore() }
})

describe.each(ORACLE_PROFILES)('%s bounded line controls', (profileId) => {
  it.each([19999, 20000, 20001])('preserves its own %i line limit without another tokenizer', async (length) => {
    const source = '"' + 'a'.repeat(length - 2) + '"'
    const result = await documentOracle({ kind: 'document', profileId, languageId: 'json', source, themeIds: ['github-dark'], metadata: 'required-language-v1' })
    const skipped = profileId === 'shiki-api' ? length >= 20000 : profileId.startsWith('product') && length > 20000
    expect(result.status).toBe(skipped ? 'unsupported' : 'complete')
    if (result.status === 'complete') expect(result.metadata).toEqual({ languageIds: ['json'], spans: [0, length, 0] })
    if (skipped) expect(result.diagnostics.join('\n')).toContain(`[0, ${length})`)
  })
  it('preserves the final bare CR rule', async () => {
    const result = await documentOracle({ kind: 'document', profileId, languageId: 'json', source: '{}\r', themeIds: ['github-dark'], metadata: 'required-language-v1' })
    expect(result.status).toBe(profileId.startsWith('product') ? 'unsupported' : 'complete')
    if (profileId.startsWith('product')) expect(result.diagnostics.join('\n')).toContain('[2, 3)')
  })
})
