import type { Grammar, LanguageRegistration } from 'shiki/core'
import { ResultBuilder } from '../build.ts'
import type { DocumentResult, MetadataTrack } from '../schema.ts'
import { isLanguageId } from '../validate.ts'
import { sourceLines, type LineSpan, type SourceLine } from './lines.ts'
import { readProductProfile } from './pins.ts'
import { validateMetadataOption } from './request.ts'

export interface NativeLanguage {
  readonly nativeId: number
  readonly languageId: string
  readonly scopeName: string
}

/** Allocation belongs to this request. Dependency lists and scope suffixes are never codebooks. */
export class LanguageCodebook {
  readonly identity: string
  readonly #names = new Map<number, string>()

  constructor(entries: readonly NativeLanguage[]) {
    const names = new Set<string>()
    const scopes = new Set<string>()
    for (const entry of entries) {
      if (!Number.isInteger(entry.nativeId) || entry.nativeId < 1 || entry.nativeId > 255)
        throw new Error(`native language ID ${entry.nativeId} is outside 1..255`)
      if (!isLanguageId(entry.languageId) || !/^\S+$/.test(entry.scopeName)) throw new Error('invalid canonical language binding')
      if (this.#names.has(entry.nativeId) || names.has(entry.languageId) || scopes.has(entry.scopeName)) throw new Error('duplicate or conflicting native language codebook')
      this.#names.set(entry.nativeId, entry.languageId)
      names.add(entry.languageId)
      scopes.add(entry.scopeName)
    }
    if (entries.length === 0) throw new Error('empty native language codebook')
    const canonical = entries.map(({ nativeId, languageId, scopeName }) => ({ nativeId, languageId, scopeName }))
    canonical.sort((left, right) => left.nativeId - right.nativeId)
    this.identity = JSON.stringify(canonical)
  }

  language(nativeId: number): string {
    const name = this.#names.get(nativeId)
    if (nativeId === 0 || name === undefined) throw new Error(`unset or unmapped native language ID ${nativeId}`)
    return name
  }
}

/** Pinned low eight language bits, independently exercised against both actual engines. */
export function decodeTokenLanguages(tokens: Uint32Array, length: number, codebook: LanguageCodebook): LineSpan<string>[] {
  if (tokens.length % 2 !== 0) throw new Error('malformed binary token pairs')
  const spans: LineSpan<string>[] = []
  let end = 0
  for (let index = 0; index < tokens.length; index += 2) {
    const from = tokens[index]
    const to = Math.min(tokens[index + 2] ?? length, length)
    if (from !== end || to < from || from > length) throw new Error('incomplete or unordered binary token coverage')
    const value = codebook.language(tokens[index + 1] & 255)
    if (to > from) spans.push({ from, to, value })
    end = to
  }
  if (end !== length) throw new Error('incomplete binary token coverage')
  return spans
}

export interface MetadataGap {
  readonly from: number
  readonly to: number
  readonly reason: string
}

export type MetadataAcquisition =
  | { readonly kind: 'empty' }
  | { readonly kind: 'measured'; readonly track: MetadataTrack; readonly codebook: string }
  | { readonly kind: 'unavailable'; readonly ranges: readonly MetadataGap[] }

export type BinaryResult = Pick<ReturnType<Grammar['tokenizeLine2']>, 'tokens' | 'stoppedEarly'>
export type BinaryObserver = (line: string, result: BinaryResult) => void

export function canonicalRoot(languageId: string, registrations: readonly LanguageRegistration[]): NativeLanguage {
  const selected = registrations.find(entry => entry.name === languageId)
  const pinned = readProductProfile().languages.registrations.find(entry => entry.name === languageId)
  if (!selected || !pinned || selected.scopeName !== pinned.scopeName) throw new Error(`invalid canonical registration for ${languageId}`)
  return { nativeId: 1, languageId: selected.name, scopeName: selected.scopeName }
}

/** JSON is the bounded proven whole-source root grammar. Other roots need independent semantics. */
export function rootSemanticsGap(languageId: string, length: number): MetadataGap[] {
  if (length === 0 || languageId === 'json') return []
  return [{ from: 0, to: length, reason: `independent embedded-language identity / whole-source semantics unavailable for ${languageId}` }]
}

function observedLines(source: string, profile: string): SourceLine[] {
  const lines = sourceLines(source)
  if (!profile.startsWith('product')) return lines
  return lines.map((line, index) => index === lines.length - 1 && line.text.endsWith('\r') ? { ...line, text: line.text.slice(0, -1) } : line)
}

function skipped(line: SourceLine, profile: string): boolean {
  if (profile.startsWith('raw')) return false
  const limit = readProductProfile().tokenization.lineLimit.settingDefault
  return line.text.length === 0 || (profile === 'shiki-api' ? line.text.length >= limit : line.text.length > limit)
}

function metadataTrack(spans: readonly LineSpan<string>[]): MetadataTrack {
  const languageIds: string[] = [], triples: number[] = []
  for (const span of spans) {
    let id = languageIds.indexOf(span.value)
    if (id < 0) id = languageIds.push(span.value) - 1
    if (triples.at(-1) === id && triples.at(-2) === span.from) triples[triples.length - 2] = span.to
    else triples.push(span.from, span.to, id)
  }
  return { languageIds, spans: triples }
}

/** Collect only calls actually made by the selected profile; never tokenize a missing line. */
export class ReferenceMetadataCapture {
  readonly #expected: readonly SourceLine[]
  readonly #source: string
  readonly #codebook: LanguageCodebook
  readonly #spans: LineSpan<string>[] = []
  readonly #gaps: MetadataGap[]
  #next = 0

  constructor(source: string, profile: string, codebook: LanguageCodebook, semanticGaps: readonly MetadataGap[]) {
    this.#source = source
    this.#codebook = codebook
    const lines = observedLines(source, profile)
    this.#expected = lines.filter(line => !skipped(line, profile))
    this.#gaps = semanticGaps.slice()
    for (const line of lines) this.#checkLine(line, profile)
  }

  #checkLine(line: SourceLine, profile: string): void {
    const end = line.start + line.text.length
    if (end < line.next) this.#gaps.push({ from: end, to: line.next, reason: 'physical separator or product final CR has no observed language' })
    if (line.text.length > 0 && skipped(line, profile))
      this.#gaps.push({ from: line.start, to: end, reason: 'profile line limit skipped binary observation' })
  }

  readonly observe: BinaryObserver = (text, result) => {
    const line = this.#expected[this.#next++]
    if (!line || text !== line.text) {
      this.#gaps.push({ from: 0, to: this.#source.length, reason: 'binary observation does not match the actual source line sequence' })
      return
    }
    try {
      if (result.stoppedEarly) throw new Error('binary tokenization stopped early')
      const spans = decodeTokenLanguages(result.tokens, text.length, this.#codebook)
      for (const span of spans) this.#spans.push({ ...span, from: line.start + span.from, to: line.start + span.to })
    } catch (error) {
      this.#gaps.push({ from: line.start, to: line.start + text.length, reason: error instanceof Error ? error.message : String(error) })
    }
  }

  outcome(): MetadataAcquisition {
    if (this.#source.length === 0) return { kind: 'empty' }
    const missing = this.#expected.slice(this.#next).map(line => ({ from: line.start, to: line.start + line.text.length, reason: 'missing binary observation' }))
    const ranges = this.#gaps.concat(missing)
    if (ranges.length > 0) return { kind: 'unavailable', ranges }
    return { kind: 'measured', track: metadataTrack(this.#spans), codebook: this.#codebook.identity }
  }
}

/** Instance-local, same-call observation. Restore even when the target or observer throws. */
export function observeBinaryLines<T>(grammar: Grammar, observe: BinaryObserver, run: () => T): T {
  const own = Object.getOwnPropertyDescriptor(grammar, 'tokenizeLine2')
  const original = grammar.tokenizeLine2
  grammar.tokenizeLine2 = function (...args: Parameters<Grammar['tokenizeLine2']>) {
    const result = original.apply(this, args)
    observe(args[0], result)
    return result
  }
  try {
    return run()
  } finally {
    if (own) Object.defineProperty(grammar, 'tokenizeLine2', own)
    else Reflect.deleteProperty(grammar, 'tokenizeLine2')
  }
}

interface MetadataRequest {
  readonly profileId: string
  readonly languageId: string
  readonly source: string
  readonly metadata?: 'required-language-v1'
}

export function requireReferenceMetadata(request: MetadataRequest, result: DocumentResult, acquisition?: MetadataAcquisition): DocumentResult {
  validateMetadataOption(request)
  if (request.metadata === undefined || result.status !== 'complete' || request.source.length === 0) return result
  const incomplete = (reason: string) => new ResultBuilder({ profileId: result.profileId, languageId: result.languageId, engine: result.engine }, request.source).incomplete('unsupported', reason)
  if (acquisition?.kind === 'unavailable')
    return incomplete(acquisition.ranges.map(gap => `required metadata [${gap.from}, ${gap.to}): ${gap.reason}`).join('; '))
  if (acquisition?.kind === 'measured') return {
    ...result, metadata: acquisition.track,
    engine: { ...result.engine, referenceMetadata: 'required-language-v1', metadataCodebook: acquisition.codebook,
      metadataSemantics: 'whole-source-root', metadataConfiguration: request.profileId.startsWith('raw') ? 'configured initialLanguage=1 (default was unset 0)' : 'selected Shiki canonical registration allocation=1' },
  }
  const binding = readProductProfile().languages.registrations.find(entry => entry.name === request.languageId)
  const expected = binding && new LanguageCodebook([{ nativeId: 1, languageId: binding.name, scopeName: binding.scopeName }]).identity
  if (!result.metadata || result.engine['referenceMetadata'] !== request.metadata || result.engine['metadataCodebook'] !== expected
    || result.engine['metadataSemantics'] !== 'whole-source-root' || rootSemanticsGap(request.languageId, request.source.length).length > 0
    || result.metadata.languageIds.some(name => name !== request.languageId))
    return incomplete(`required metadata [0, ${request.source.length}): missing measured metadata or canonical codebook evidence`)
  return result
}
