import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import { createHighlighterCore, type ThemedToken } from 'shiki/core'
import { ResultBuilder } from '../build.ts'
import type { DocumentResult, ReferenceProfileId, Style } from '../schema.ts'
import { languageRegistrations, themeModule } from './assets.ts'
import { type LineSpan, SEPARATOR_SCOPES, SEPARATOR_STYLE, type SourceLine, sourceLines, writeTrack } from './lines.ts'
import { PINS, pinLabel, readProductProfile } from './pins.ts'
import { resolvedStyle } from './resolved-style.ts'
import { canonicalRoot, LanguageCodebook, observeBinaryLines, ReferenceMetadataCapture, requireReferenceMetadata, rootSemanticsGap } from './metadata.ts'
import { validateMetadataOption } from './request.ts'

const scopeName = (scope: { readonly scopeName: string }): string => scope.scopeName

export interface ShikiApiRequest {
  readonly profileId: ReferenceProfileId
  readonly languageId: string
  readonly source: string
  readonly themeIds: readonly string[]
  readonly metadata?: 'required-language-v1'
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
      spans.push({ from, to: from + part.content.length, value: part.scopes.map(scopeName) })
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

function writeScopes(builder: ResultBuilder, lines: readonly SourceLine[], tokens: readonly (readonly ThemedToken[])[]): void {
  const line = (at: number): SourceLine => lines[at] ?? { text: '', start: 0, next: 0 }
  writeTrack(lines, at => explanationSpans(line(at), tokens[at] ?? []), (from, to, value) => builder.scope(from, to, value), SEPARATOR_SCOPES)
}

/**
 * Ordinary `codeToTokensBase` at the product's line limit. The time limit is off because the API
 * never reports a line that stopped early; the process deadline bounds the work instead.
 */
export async function shikiApiDocument(request: ShikiApiRequest): Promise<DocumentResult> {
  validateMetadataOption(request)
  const maxLineLength = readProductProfile().tokenization.lineLimit.settingDefault
  const themes = await Promise.all(request.themeIds.map(themeModule))
  const registrations = await languageRegistrations(request.languageId)
  const highlighter = await createHighlighterCore({
    engine: createOnigurumaEngine(import('@shikijs/engine-oniguruma/wasm-inlined')),
    langs: registrations,
    themes,
  })
  try {
    return tokenizeDocument(request, highlighter, themes, maxLineLength, registrations)
  } finally {
    highlighter.dispose()
  }
}

function tokenizeDocument(request: ShikiApiRequest, highlighter: Awaited<ReturnType<typeof createHighlighterCore>>,
  themes: Awaited<ReturnType<typeof themeModule>>[], maxLineLength: number, registrations: Awaited<ReturnType<typeof languageRegistrations>>): DocumentResult {
  const grammar = highlighter.getLanguage(request.languageId)
  const root = request.metadata === undefined ? undefined : canonicalRoot(request.languageId, registrations)
  if (root && grammar.name !== root.languageId) throw new Error('selected Shiki canonical language differs from the pinned registration')
  const capture = root && new ReferenceMetadataCapture(request.source, request.profileId, new LanguageCodebook([root]), rootSemanticsGap(root.languageId, request.source.length))
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
  // Scopes come from the first theme's explanations, so the later passes skip them.
  const tokenize = (themeName: string, explain: boolean) => {
    const passOptions = explain ? options : { ...options, includeExplanation: false }
    const tokens = highlighter.codeToTokensBase(request.source, { lang: request.languageId, theme: themeName, ...passOptions })
    if (tokens.length !== lines.length) throw new Error(`Shiki split ${tokens.length} lines, the source has ${lines.length}`)
    return tokens
  }
  for (const [index, theme] of themes.entries()) {
    const tokens = index === 0 && capture ? observeBinaryLines(grammar, capture.observe, () => tokenize(theme.name, true)) : tokenize(theme.name, index === 0)
    const themeId = request.themeIds[index] ?? theme.name
    const line = (at: number): SourceLine => lines[at] ?? { text: '', start: 0, next: 0 }
    if (index === 0) writeScopes(builder, lines, tokens)
    writeTrack(lines, (at) => styleSpans(line(at), tokens[at] ?? []), (from, to, value) => builder.style(themeId, from, to, value), SEPARATOR_STYLE)
  }
  return requireReferenceMetadata(request, builder.complete(), capture?.outcome())
}
