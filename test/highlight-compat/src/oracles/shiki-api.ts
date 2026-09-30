import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import { createHighlighterCore, type ThemedToken } from 'shiki/core'
import { ResultBuilder } from '../build.ts'
import type { CompleteResult, ReferenceProfileId, Style } from '../schema.ts'
import { languageRegistrations, themeModule } from './assets.ts'
import { type LineSpan, SEPARATOR_SCOPES, SEPARATOR_STYLE, type SourceLine, sourceLines, writeTrack } from './lines.ts'
import { PINS, pinLabel, readProductProfile } from './pins.ts'
import { resolvedStyle } from './resolved-style.ts'

export interface ShikiApiRequest {
  readonly profileId: ReferenceProfileId
  readonly languageId: string
  readonly source: string
  readonly themeIds: readonly string[]
}

function explanationSpans(line: SourceLine, tokens: readonly ThemedToken[]): LineSpan<readonly string[]>[] {
  const spans: LineSpan<readonly string[]>[] = []
  for (const token of tokens) {
    let from = token.offset - line.start
    if (token.explanation === undefined) {
      spans.push({ from, to: from + token.content.length, value: [] })
      continue
    }
    for (const part of token.explanation) {
      spans.push({ from, to: from + part.content.length, value: part.scopes.map((scope) => scope.scopeName) })
      from += part.content.length
    }
  }
  return spans
}

const styleSpans = (line: SourceLine, tokens: readonly ThemedToken[]): LineSpan<Style>[] =>
  tokens.map((token) => ({
    from: token.offset - line.start,
    to: token.offset - line.start + token.content.length,
    value: resolvedStyle(token.color ?? '', token.fontStyle ?? 0),
  }))

/**
 * Ordinary `codeToTokensBase` at the product's line limit. The time limit is off because the API
 * never reports a line that stopped early; the process deadline bounds the work instead.
 */
export async function shikiApiDocument(request: ShikiApiRequest): Promise<CompleteResult> {
  const maxLineLength = readProductProfile().tokenization.lineLimit.settingDefault
  const themes = await Promise.all(request.themeIds.map(themeModule))
  const highlighter = await createHighlighterCore({
    engine: createOnigurumaEngine(import('@shikijs/engine-oniguruma/wasm-inlined')),
    langs: await languageRegistrations(request.languageId),
    themes,
  })
  const options = { includeExplanation: 'scopeName', tokenizeMaxLineLength: maxLineLength, tokenizeTimeLimit: 0 } as const
  const lines = sourceLines(request.source)
  const engine = {
    api: 'codeToTokensBase',
    options: `includeExplanation=${options.includeExplanation} tokenizeMaxLineLength=${maxLineLength} tokenizeTimeLimit=0`,
    shiki: pinLabel(PINS.shiki),
    textmate: pinLabel(PINS.shikiTextmate),
    oniguruma: pinLabel(PINS.shikiOniguruma),
    grammars: pinLabel(PINS.langs),
    themes: pinLabel(PINS.themes),
  }
  const builder = new ResultBuilder({ profileId: request.profileId, languageId: request.languageId, engine }, request.source)
  const plain = lines.filter((line) => line.text.length >= maxLineLength).length
  if (plain > 0) builder.diagnostic(`${plain} line(s) of ${maxLineLength} units or more stay one plain token`)
  const tokenize = (themeName: string) => {
    const tokens = highlighter.codeToTokensBase(request.source, { lang: request.languageId, theme: themeName, ...options })
    if (tokens.length !== lines.length) throw new Error(`Shiki split ${tokens.length} lines, the source has ${lines.length}`)
    return tokens
  }
  themes.forEach((theme, index) => {
    const tokens = tokenize(theme.name)
    const themeId = request.themeIds[index] ?? theme.name
    const line = (at: number): SourceLine => lines[at] ?? { text: '', start: 0, next: 0 }
    if (index === 0) {
      writeTrack(lines, (at) => explanationSpans(line(at), tokens[at] ?? []), (from, to, value) => builder.scope(from, to, value), SEPARATOR_SCOPES)
    }
    writeTrack(lines, (at) => styleSpans(line(at), tokens[at] ?? []), (from, to, value) => builder.style(themeId, from, to, value), SEPARATOR_STYLE)
  })
  return builder.complete()
}
