import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ResultBuilder } from '../build.ts'
import type { DocumentResult } from '../schema.ts'
import { languageRegistrations } from '../oracles/assets.ts'
import { checkAssets, parserUrl, PILOT_LANGUAGES, querySource, sha256, VENDOR_ROOT, VSCODE_COMMIT, VSCODE_QUERY_SHA256 } from './assets.ts'
import { CAPTURE_MAP_VERSION, captureScopes } from './capture-map.ts'
import { captureIntervals, composeCaptures } from './compose.ts'
import type { NamedCapture, ScopeInterval } from './compose.ts'
import { queryPatterns, requireSupportedOperators } from './query.ts'
import { paintScopes } from './theme.ts'
import type { StyleReference } from './theme.ts'

export type BaselineId = 'baseline:captures' | 'baseline:vscode-ts'

interface BindingNode { readonly startIndex: number; readonly endIndex: number }
interface BindingTree { readonly rootNode: BindingNode; delete(): void }
interface BindingLanguage { readonly abiVersion: number }
interface BindingQuery {
  readonly captureNames: readonly string[]
  captures(node: BindingNode): readonly NamedCapture[]
  didExceedMatchLimit(): boolean
  delete(): void
}
interface BindingParser { setLanguage(language: BindingLanguage): void; parse(source: string): BindingTree | null; delete(): void }
interface Binding {
  readonly Parser: { new(): BindingParser; init(): Promise<void> }
  readonly Language: { load(path: string): Promise<BindingLanguage> }
  readonly Query: { new(language: BindingLanguage, source: string): BindingQuery }
}

const BINDING_URL = new URL('../../../../lib/binding_web/web-tree-sitter.js', import.meta.url)

export interface QueryEvidence {
  readonly patterns: number
  readonly accepted: number
  readonly operations: readonly string[]
  readonly exclusions: readonly string[]
}

export interface BaselineScopes {
  readonly intervals: readonly ScopeInterval[]
  readonly engine: Readonly<Record<string, string>>
  readonly evidence: QueryEvidence
}

async function loadBinding(): Promise<Binding> {
  const problems = checkAssets()
  if (problems.length > 0) throw new Error(problems.join('\n'))
  const binding = await import(/* @vite-ignore */ BINDING_URL.href) as Binding
  await binding.Parser.init()
  return binding
}

export function baselineSupport(profileId: BaselineId, languageId: string): string | undefined {
  if (!(PILOT_LANGUAGES as readonly string[]).includes(languageId)) return `no pinned pilot parser for ${languageId}`
  if (profileId === 'baseline:vscode-ts' && languageId !== 'typescript' && languageId !== 'tsx') return 'VS Code TypeScript query applies only to the TypeScript and TSX variants'
  if (languageId === 'markdown') return 'pinned tree-sitter-md 0.1.1 uses MarkdownDocument.highlights; no external highlights query or markdown_inline parser is configured'
  return undefined
}

function compileQuery(binding: Binding, language: BindingLanguage, source: string, allowIncompatible: boolean): { query: BindingQuery; evidence: QueryEvidence } {
  const patterns = queryPatterns(source)
  const accepted: string[] = []
  const exclusions: string[] = []
  for (const pattern of patterns) {
    const label = `pattern ${pattern.index + 1} at query line ${pattern.line}`
    const operators = pattern.operators.filter(operator => operator !== 'is-not?')
    requireSupportedOperators(operators)
    if (pattern.operators.includes('is-not?')) {
      if ([...pattern.source.matchAll(/#is-not\?([^)]*)\)/g)].some(match => match[1]?.trim() !== 'local')) throw new Error(`${label}: unsupported property predicate`)
      exclusions.push(`${label}: #is-not? local needs local-variable analysis; the web binding returns refutedProperties without evaluating them`)
      continue
    }
    let query: BindingQuery
    try {
      query = new binding.Query(language, pattern.source)
    } catch (error) {
      if (!allowIncompatible) throw error
      exclusions.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    query.delete()
    accepted.push(pattern.source)
  }
  if (accepted.length === 0) throw new Error(`no compilable query patterns: ${exclusions.join('; ')}`)
  const query = new binding.Query(language, accepted.join('\n'))
  return { query, evidence: { patterns: patterns.length, accepted: accepted.length, operations: [...new Set(patterns.flatMap(pattern => pattern.operators))].sort(), exclusions } }
}

export async function baselineScopes(profileId: BaselineId, languageId: string, source: string): Promise<BaselineScopes> {
  const unsupported = baselineSupport(profileId, languageId)
  if (unsupported !== undefined) throw new Error(unsupported)
  const binding = await loadBinding()
  const language = await binding.Language.load(fileURLToPath(parserUrl(languageId)))
  const queryText = profileId === 'baseline:captures' ? querySource(languageId) : readFileSync(new URL('vscode-typescript.scm', VENDOR_ROOT), 'utf8')
  const { query, evidence } = compileQuery(binding, language, queryText, profileId === 'baseline:vscode-ts')
  const map = profileId === 'baseline:captures' ? captureScopes : (name: string) => [name]
  const parser = new binding.Parser()
  let tree: BindingTree | null = null
  try {
    for (const name of query.captureNames) map(name)
    parser.setLanguage(language)
    tree = parser.parse(source)
    if (tree === null) throw new Error('baseline parse returned no tree')
    const captures = captureIntervals(query.captures(tree.rootNode), query.captureNames)
    if (query.didExceedMatchLimit()) throw new Error('baseline query exceeded its match limit')
    const registrations = await languageRegistrations(languageId)
    const root = registrations.find(registration => registration.name === languageId)?.scopeName
    if (root === undefined) throw new Error(`no pinned root scope for ${languageId}`)
    return {
      intervals: composeCaptures(source, root, captures, map), evidence,
      engine: {
        binding: 'checkout lib/binding_web', parserABI: String(language.abiVersion),
        querySha256: sha256(queryText), captureMap: profileId === 'baseline:captures' ? CAPTURE_MAP_VERSION : 'identity TextMate capture names',
        querySource: profileId === 'baseline:captures' ? 'manifest/tree-sitter-languages.json' : `vscode ${VSCODE_COMMIT} typescript.scm ${VSCODE_QUERY_SHA256}`,
        composition: 'start ascending, end descending, pattern ascending, declared capture ordinal ascending; duplicates retained; root first; physical terminators empty',
        injections: 'outer tree only; injection grammars and local analysis are outside these diagnostic baselines',
      },
    }
  } finally {
    tree?.delete()
    parser.delete()
    query.delete()
  }
}

export async function baselineDocument(profileId: BaselineId, languageId: string, source: string, reference: StyleReference): Promise<DocumentResult> {
  const unsupported = baselineSupport(profileId, languageId)
  if (unsupported !== undefined) return new ResultBuilder({ profileId, languageId }, source).incomplete('unsupported', unsupported)
  try {
    const { intervals, engine, evidence } = await baselineScopes(profileId, languageId, source)
    return await paintScopes(profileId, languageId, source, intervals, reference, engine, evidence.exclusions)
  } catch (error) {
    return new ResultBuilder({ profileId, languageId }, source).incomplete('error', error instanceof Error ? error.message : String(error))
  }
}
