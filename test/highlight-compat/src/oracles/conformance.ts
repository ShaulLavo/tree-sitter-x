import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GrammarSet, TextmateToken } from './textmate.ts'
import { upstreamTextmate } from './textmate.ts'

export const VENDOR_ROOT = fileURLToPath(new URL('../../vendor/vscode-textmate/', import.meta.url))
const FIXTURE_SOURCES = fileURLToPath(new URL('../../manifest/fixture-sources.json', import.meta.url))

export type SuiteId = 'first-mate' | 'suite1' | 'suite1-while'

/** Suite id, its vendored path and its source id in fixture-sources.json. */
export const SUITES: Readonly<Record<SuiteId, { readonly path: string; readonly sourceId: string }>> = {
  'first-mate': { path: 'test-cases/first-mate/tests.json', sourceId: 'vscode-textmate-first-mate' },
  suite1: { path: 'test-cases/suite1/tests.json', sourceId: 'vscode-textmate-suite1' },
  'suite1-while': { path: 'test-cases/suite1/whileTests.json', sourceId: 'vscode-textmate-while-tests' },
}

export const SUITE_IDS = Object.keys(SUITES) as SuiteId[]

export interface ExpectedToken {
  readonly value: string
  readonly scopes: readonly string[]
}

export interface ConformanceCase {
  readonly desc: string
  readonly grammars: readonly string[]
  readonly grammarPath?: string
  readonly grammarScopeName?: string
  readonly grammarInjections?: readonly string[]
  readonly lines: readonly { readonly line: string; readonly tokens: readonly ExpectedToken[] }[]
}

export interface CaseRef {
  readonly suite: SuiteId
  readonly index: number
}

export const caseLabel = (ref: CaseRef, conformance: ConformanceCase): string => `${ref.suite}#${ref.index} ${conformance.desc}`

export function loadSuite(suite: SuiteId): ConformanceCase[] {
  return JSON.parse(readFileSync(join(VENDOR_ROOT, SUITES[suite].path), 'utf8')) as ConformanceCase[]
}

interface InventorySource {
  readonly id: string
  readonly caseInventory: readonly { readonly index: number; readonly decision: string }[]
}

/** Every case fixture-sources.json selects; the SQL case it skips stays out. */
export function selectedCases(): CaseRef[] {
  const sources = (JSON.parse(readFileSync(FIXTURE_SOURCES, 'utf8')) as { sources: InventorySource[] }).sources
  return SUITE_IDS.flatMap((suite) => {
    const inventory = sources.find((source) => source.id === SUITES[suite].sourceId)
    if (inventory === undefined) throw new Error(`fixture-sources.json has no source ${SUITES[suite].sourceId}`)
    return inventory.caseInventory.filter((entry) => entry.decision !== 'skip').map((entry) => ({ suite, index: entry.index }))
  })
}

export function loadCase(ref: CaseRef): ConformanceCase {
  const conformance = loadSuite(ref.suite)[ref.index]
  if (conformance === undefined) throw new Error(`${ref.suite} has no case ${ref.index}`)
  return conformance
}

/** The upstream runner's own rule: on a non-empty line, expected tokens with empty values are dropped. */
export function expectedTokens(line: string, tokens: readonly ExpectedToken[]): readonly ExpectedToken[] {
  return line.length > 0 ? tokens.filter((token) => token.value.length > 0) : tokens
}

/** Maps tokens the way the upstream runner does: the value is the token's text within the line. */
export function actualTokens(line: string, tokens: readonly TextmateToken[]): ExpectedToken[] {
  return tokens.map((token) => ({ value: line.substring(token.startIndex, token.endIndex), scopes: token.scopes }))
}

/** Both engines receive grammars parsed by upstream's parseRawGrammar, so only tokenization differs. */
export function caseGrammarSet(ref: CaseRef, conformance: ConformanceCase): GrammarSet {
  const suiteDir = join(VENDOR_ROOT, SUITES[ref.suite].path, '..')
  const byScope = new Map<string, object>()
  let rootScope = conformance.grammarScopeName
  for (const path of conformance.grammars) {
    const grammar = upstreamTextmate.parseRawGrammar(readFileSync(join(suiteDir, path), 'utf8'), path)
    byScope.set(grammar.scopeName, grammar)
    if (rootScope === undefined && path === conformance.grammarPath) rootScope = grammar.scopeName
  }
  if (rootScope === undefined) throw new Error(`${caseLabel(ref, conformance)}: no root grammar`)
  const root = rootScope
  return {
    rootScope: root,
    grammar: (scopeName) => byScope.get(scopeName),
    injections: (scopeName) => (scopeName === root ? conformance.grammarInjections?.slice() : undefined),
  }
}
