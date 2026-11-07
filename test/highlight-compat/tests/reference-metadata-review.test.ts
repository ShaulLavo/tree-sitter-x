import { afterAll, beforeAll, expect, it } from 'vitest'
import { createHighlighterCore, type Grammar } from 'shiki/core'
import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import wasm from '@shikijs/engine-oniguruma/wasm-inlined'
import { languageRegistrations, themeModule } from '../src/oracles/assets.ts'
import { observeBinaryLines } from '../src/oracles/metadata.ts'
import { ORACLE_PROFILES } from '../src/oracles/request.ts'
import { runDocument } from '../src/oracles/run.ts'

let highlighter: Awaited<ReturnType<typeof createHighlighterCore>>
beforeAll(async () => {
  highlighter = await createHighlighterCore({ engine: createOnigurumaEngine(wasm),
    langs: await languageRegistrations('json'), themes: [await themeModule('github-dark')] })
})
afterAll(() => highlighter?.dispose())

const tokenize = () => highlighter.codeToTokensBase('{"x":"🌿"}', {
  lang: 'json', theme: 'github-dark', includeExplanation: 'scopeName', tokenizeTimeLimit: 0,
})

it.each(ORACLE_PROFILES)('independently admits actual whole-source JSON through runDocument for %s', async profileId => {
  const source = '{"x":"🌿"}'
  const result = await runDocument({ kind: 'document', profileId, languageId: 'json', source,
    themeIds: ['github-dark'], metadata: 'required-language-v1' })
  expect(result.status).toBe('complete')
  if (result.status !== 'complete') throw new Error(result.diagnostics.join('\n'))
  expect(result.metadata).toEqual({ languageIds: ['json'], spans: [0, source.length, 0] })
})

it('independently preserves a writable own data property, output, arguments and receiver', () => {
  const grammar = highlighter.getLanguage('json')
  const saved = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  const baseline = tokenize()
  const inputs: Parameters<Grammar['tokenizeLine2']>[] = []
  const tracked: Grammar['tokenizeLine2'] = function (this: Grammar, ...args) {
    expect(this).toBe(grammar)
    inputs.push(args)
    return original.apply(this, args)
  }
  Object.defineProperty(grammar, 'tokenizeLine2', { value: tracked, configurable: true, writable: true, enumerable: false })
  const descriptor = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  try {
    expect(observeBinaryLines(grammar, () => undefined, tokenize)).toEqual(baseline)
    expect(inputs).toHaveLength(1)
    expect(inputs[0][0]).toBe('{"x":"🌿"}')
    expect(inputs[0][2]).toBe(0)
    expect(Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')).toEqual(descriptor)
  } finally { restore(grammar, saved) }
})

function restore(grammar: Grammar, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) Object.defineProperty(grammar, 'tokenizeLine2', descriptor)
  else Reflect.deleteProperty(grammar, 'tokenizeLine2')
}

it('can observe a configurable getter-only method without replacing its accessor', () => {
  const grammar = highlighter.getLanguage('json')
  const saved = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  Object.defineProperty(grammar, 'tokenizeLine2', { configurable: true, get: () => original })
  const descriptor = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  let calls = 0
  try {
    expect(() => observeBinaryLines(grammar, () => { calls++ }, tokenize)).not.toThrow()
    expect(calls).toBe(1)
    expect(Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')).toEqual(descriptor)
  } finally { restore(grammar, saved) }
})

it.each(['success', 'observer failure', 'target failure'])('does not leave the observer installed behind an own setter after %s', mode => {
  const grammar = highlighter.getLanguage('json')
  const saved = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  let current = original
  let setterCalls = 0
  Object.defineProperty(grammar, 'tokenizeLine2', { configurable: true, enumerable: true,
    get: () => current, set: (value: Grammar['tokenizeLine2']) => { setterCalls++; current = value } })
  const descriptor = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const failure = new Error(mode)
  const observer = () => { if (mode === 'observer failure') throw failure }
  const run = () => { if (mode === 'target failure') throw failure; return tokenize() }
  try {
    if (mode === 'success') observeBinaryLines(grammar, observer, run)
    else expect(() => observeBinaryLines(grammar, observer, run)).toThrow(failure)
    expect(Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')).toEqual(descriptor)
    expect(grammar.tokenizeLine2).toBe(original)
    expect(setterCalls).toBe(0)
  } finally { restore(grammar, saved) }
})

it('does not mutate an inherited setter or retain a wrapper after deleting the temporary own method', () => {
  const grammar = highlighter.getLanguage('json')
  const saved = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  const prototype: object = Object.getPrototypeOf(grammar)
  const layer: object = Object.create(prototype)
  let current = original
  Object.defineProperty(layer, 'tokenizeLine2', { configurable: true,
    get: () => current, set: (value: Grammar['tokenizeLine2']) => { current = value } })
  Reflect.deleteProperty(grammar, 'tokenizeLine2')
  Object.setPrototypeOf(grammar, layer)
  try {
    observeBinaryLines(grammar, () => undefined, tokenize)
    expect(Object.hasOwn(grammar, 'tokenizeLine2')).toBe(false)
    expect(grammar.tokenizeLine2).toBe(original)
  } finally { Object.setPrototypeOf(grammar, prototype); restore(grammar, saved) }
})

async function freshGrammar() {
  const owner = await createHighlighterCore({ engine: createOnigurumaEngine(wasm),
    langs: await languageRegistrations('json'), themes: [await themeModule('github-dark')] })
  const run = () => owner.codeToTokensBase('123', { lang: 'json', theme: 'github-dark', tokenizeTimeLimit: 0 })
  const baseline = run()
  return { owner, grammar: owner.getLanguage('json'), run, baseline }
}

it.each(['accessor', 'read-only'])('rejects a non-configurable %s before mutation', async shape => {
  const target = await freshGrammar(), original = target.grammar.tokenizeLine2
  let reads = 0
  const getter = () => { reads++; return original }
  const descriptor = shape === 'accessor' ? { configurable: false, get: getter }
    : { configurable: false, writable: false, value: original }
  Object.defineProperty(target.grammar, 'tokenizeLine2', descriptor)
  const saved = Object.getOwnPropertyDescriptor(target.grammar, 'tokenizeLine2')
  try {
    expect(() => observeBinaryLines(target.grammar, () => undefined, target.run)).toThrow()
    expect(reads).toBe(0)
    expect(Object.getOwnPropertyDescriptor(target.grammar, 'tokenizeLine2')).toEqual(saved)
    expect(target.run()).toEqual(target.baseline)
  } finally { target.owner.dispose() }
})

it('observes and restores a non-configurable writable data property', async () => {
  const target = await freshGrammar(), original = target.grammar.tokenizeLine2
  Object.defineProperty(target.grammar, 'tokenizeLine2', { configurable: false, writable: true, value: original })
  const saved = Object.getOwnPropertyDescriptor(target.grammar, 'tokenizeLine2')
  try {
    expect(observeBinaryLines(target.grammar, () => undefined, target.run)).toEqual(target.baseline)
    expect(Object.getOwnPropertyDescriptor(target.grammar, 'tokenizeLine2')).toEqual(saved)
    expect(target.run()).toEqual(target.baseline)
  } finally { target.owner.dispose() }
})

it('leaves a nonextensible grammar and its default method unchanged', async () => {
  const target = await freshGrammar(), original = target.grammar.tokenizeLine2
  Object.preventExtensions(target.grammar)
  try {
    expect(() => observeBinaryLines(target.grammar, () => undefined, target.run)).toThrow()
    expect(Object.hasOwn(target.grammar, 'tokenizeLine2')).toBe(false)
    expect(target.grammar.tokenizeLine2).toBe(original)
    expect(target.run()).toEqual(target.baseline)
  } finally { target.owner.dispose() }
})
