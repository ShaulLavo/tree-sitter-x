import type {
  CompleteResult,
  IncompleteResult,
  IncompleteStatus,
  MetadataTrack,
  ProfileId,
  Style,
  StyleTrack,
} from './schema.ts'
import { sourceSha256 } from './source.ts'
import { canonicalStyle, styleKey } from './style.ts'
import { isLanguageId, isScopeName, isThemeId, parseResult, styleErrors } from './validate.ts'

export interface ResultHeader {
  readonly profileId: ProfileId
  readonly languageId: string
  readonly documentRevision?: number
  readonly engine?: Readonly<Record<string, string>>
}

class Interner<T> {
  readonly values: T[] = []
  readonly #indices = new Map<string, number>()

  index(key: string, make: () => T): number {
    const known = this.#indices.get(key)
    if (known !== undefined) return known
    this.#indices.set(key, this.values.length)
    this.values.push(make())
    return this.values.length - 1
  }
}

class SpanWriter {
  readonly spans: number[] = []
  readonly #label: string
  readonly #limit: number
  #end = 0

  constructor(label: string, limit: number) {
    this.#label = label
    this.#limit = limit
  }

  /** Call before interning, so a rejected write changes nothing. */
  require(from: number, to: number): void {
    if (from !== this.#end || !Number.isInteger(to) || to <= from || to > this.#limit) {
      throw new RangeError(`${this.#label}: span [${from}, ${to}) must start at ${this.#end} and end after it, by ${this.#limit}`)
    }
  }

  push(from: number, to: number, value: number): void {
    this.spans.push(from, to, value)
    this.#end = to
  }

  requireEnd(): void {
    if (this.#end !== this.#limit) throw new RangeError(`${this.#label}: clipped at ${this.#end} of ${this.#limit}`)
  }
}

class StyleWriter {
  readonly styles = new Interner<Style>()
  readonly writer: SpanWriter

  constructor(themeId: string, limit: number) {
    this.writer = new SpanWriter(`style ${themeId}`, limit)
  }
}


/** Collects raw (uncoalesced) spans and interns names, paths and styles in first-use order. */
export class ResultBuilder {
  readonly #profileId: ProfileId
  readonly #languageId: string
  readonly #documentRevision: number
  readonly #engine: Readonly<Record<string, string>>
  readonly #sourceLength: number
  readonly #sourceSha256: string
  readonly #names = new Interner<string>()
  readonly #paths = new Interner<number[]>()
  readonly #scopes: SpanWriter
  readonly #languageIds = new Interner<string>()
  readonly #languages: SpanWriter
  readonly #themes = new Map<string, StyleWriter>()
  readonly #diagnostics: string[] = []
  #published = false

  constructor(header: ResultHeader, source: string) {
    this.#profileId = header.profileId
    this.#languageId = header.languageId
    this.#documentRevision = header.documentRevision ?? 0
    this.#engine = Object.fromEntries(Object.entries(header.engine ?? {}))
    this.#sourceLength = source.length
    this.#sourceSha256 = sourceSha256(source)
    this.#scopes = new SpanWriter('scopes', source.length)
    this.#languages = new SpanWriter('metadata', source.length)
  }

  scope(from: number, to: number, scopes: readonly string[]): this {
    this.#requireOpen()
    const bad = scopes.find((name) => !isScopeName(name))
    if (bad !== undefined) throw new RangeError(`scope name ${JSON.stringify(bad)} must be non-empty without whitespace`)
    this.#scopes.require(from, to)
    const path = this.#paths.index(scopes.join(' '), () =>
      scopes.map((name) => this.#names.index(name, () => name)),
    )
    this.#scopes.push(from, to, path)
    return this
  }

  language(from: number, to: number, languageId: string): this {
    this.#requireOpen()
    if (!isLanguageId(languageId)) throw new RangeError(`language id ${JSON.stringify(languageId)} is not a valid language id`)
    this.#languages.require(from, to)
    this.#languages.push(from, to, this.#languageIds.index(languageId, () => languageId))
    return this
  }

  style(themeId: string, from: number, to: number, style: Style): this {
    this.#requireOpen()
    if (!isThemeId(themeId)) throw new RangeError(`theme id ${JSON.stringify(themeId)} must be non-empty without whitespace`)
    const theme = this.#themes.get(themeId) ?? new StyleWriter(themeId, this.#sourceLength)
    theme.writer.require(from, to)
    const canonical = canonicalStyle(style)
    const errors = styleErrors(canonical)
    if (errors.length > 0) throw new RangeError(`theme ${themeId}: ${errors.join('; ')}`)
    this.#themes.set(themeId, theme)
    theme.writer.push(from, to, theme.styles.index(styleKey(canonical), () => canonical))
    return this
  }

  diagnostic(text: string): this {
    this.#requireOpen()
    this.#diagnostics.push(text)
    return this
  }

  /** Publishes the result and seals the builder, so the published arrays never change again. */
  complete(): CompleteResult {
    this.#requireOpen()
    this.#scopes.requireEnd()
    if (this.#languages.spans.length > 0) this.#languages.requireEnd()
    for (const theme of this.#themes.values()) theme.writer.requireEnd()
    const result = parseResult({
      ...this.#common(),
      status: 'complete',
      scopeNames: this.#names.values,
      paths: this.#paths.values,
      spans: this.#scopes.spans,
      ...this.#metadata(),
      ...this.#styles(),
    })
    if (result.status !== 'complete') throw new RangeError(`published status ${result.status}, expected complete`)
    this.#published = true
    return result
  }

  incomplete(status: IncompleteStatus, reason: string): IncompleteResult {
    this.#requireOpen()
    const result = parseResult({
      ...this.#common(),
      diagnostics: [...this.#diagnostics, reason],
      status,
      scopeNames: [],
      paths: [],
      spans: [],
    })
    if (result.status === 'complete') throw new RangeError('published status complete, expected incomplete')
    this.#published = true
    return result
  }

  #requireOpen(): void {
    if (this.#published) throw new Error('ResultBuilder: result already published; start a new builder')
  }

  #common() {
    return {
      schema: 1 as const,
      profileId: this.#profileId,
      languageId: this.#languageId,
      sourceSha256: this.#sourceSha256,
      sourceLength: this.#sourceLength,
      documentRevision: this.#documentRevision,
      diagnostics: this.#diagnostics,
      engine: this.#engine,
    }
  }

  #metadata(): { metadata?: MetadataTrack } {
    if (this.#languages.spans.length === 0) return {}
    return { metadata: { languageIds: this.#languageIds.values, spans: this.#languages.spans } }
  }

  #styles(): { styles?: Record<string, StyleTrack> } {
    if (this.#themes.size === 0) return {}
    const entries = [...this.#themes].map(([themeId, theme]): [string, StyleTrack] => [
      themeId,
      { styles: theme.styles.values, spans: theme.writer.spans },
    ])
    // fromEntries defines own properties, so a theme named "__proto__" stays a theme.
    return { styles: Object.fromEntries(entries) }
  }
}
