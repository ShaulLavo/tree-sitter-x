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
import { parseResult } from './validate.ts'

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

  push(from: number, to: number, value: number): void {
    if (from !== this.#end || !Number.isInteger(to) || to <= from || to > this.#limit) {
      throw new RangeError(`${this.#label}: span [${from}, ${to}) must start at ${this.#end} and end after it, by ${this.#limit}`)
    }
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

const SCOPE_NAME = /^\S+$/

/** Collects raw (uncoalesced) spans and interns names, paths and styles in first-use order. */
export class ResultBuilder {
  readonly #header: ResultHeader
  readonly #sourceLength: number
  readonly #sourceSha256: string
  readonly #names = new Interner<string>()
  readonly #paths = new Interner<number[]>()
  readonly #scopes: SpanWriter
  readonly #languageIds = new Interner<string>()
  readonly #languages: SpanWriter
  readonly #themes = new Map<string, StyleWriter>()
  readonly #diagnostics: string[] = []

  constructor(header: ResultHeader, source: string) {
    this.#header = header
    this.#sourceLength = source.length
    this.#sourceSha256 = sourceSha256(source)
    this.#scopes = new SpanWriter('scopes', source.length)
    this.#languages = new SpanWriter('metadata', source.length)
  }

  scope(from: number, to: number, scopes: readonly string[]): this {
    const bad = scopes.find((name) => !SCOPE_NAME.test(name))
    if (bad !== undefined) throw new RangeError(`scope name ${JSON.stringify(bad)} must be non-empty without whitespace`)
    const path = this.#paths.index(scopes.join(' '), () =>
      scopes.map((name) => this.#names.index(name, () => name)),
    )
    this.#scopes.push(from, to, path)
    return this
  }

  language(from: number, to: number, languageId: string): this {
    this.#languages.push(from, to, this.#languageIds.index(languageId, () => languageId))
    return this
  }

  style(themeId: string, from: number, to: number, style: Style): this {
    let theme = this.#themes.get(themeId)
    if (theme === undefined) {
      theme = new StyleWriter(themeId, this.#sourceLength)
      this.#themes.set(themeId, theme)
    }
    const canonical = canonicalStyle(style)
    theme.writer.push(from, to, theme.styles.index(styleKey(canonical), () => canonical))
    return this
  }

  diagnostic(text: string): this {
    this.#diagnostics.push(text)
    return this
  }

  complete(): CompleteResult {
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
    return result
  }

  incomplete(status: IncompleteStatus, reason: string): IncompleteResult {
    this.#diagnostics.push(reason)
    return { ...this.#common(), status, scopeNames: [], paths: [], spans: [] }
  }

  #common() {
    return {
      schema: 1 as const,
      profileId: this.#header.profileId,
      languageId: this.#header.languageId,
      sourceSha256: this.#sourceSha256,
      sourceLength: this.#sourceLength,
      documentRevision: this.#header.documentRevision ?? 0,
      diagnostics: this.#diagnostics,
      engine: this.#header.engine ?? {},
    }
  }

  #metadata(): { metadata?: MetadataTrack } {
    if (this.#languages.spans.length === 0) return {}
    return { metadata: { languageIds: this.#languageIds.values, spans: this.#languages.spans } }
  }

  #styles(): { styles?: Record<string, StyleTrack> } {
    if (this.#themes.size === 0) return {}
    const styles: Record<string, StyleTrack> = {}
    for (const [themeId, theme] of this.#themes) styles[themeId] = { styles: theme.styles.values, spans: theme.writer.spans }
    return { styles }
  }
}
