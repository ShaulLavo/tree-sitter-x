import type { ThemedToken } from 'shiki/core'
import { ResultBuilder } from '../../build.ts'
import type { CompleteResult, ReferenceProfileId } from '../../schema.ts'
import { languageRegistrations, themeModule, warmLanguages } from '../assets.ts'
import { type LineSpan, SEPARATOR_SCOPES, SEPARATOR_STYLE, type SourceLine, sourceLines, writeTrack } from '../lines.ts'
import { PINS, pinLabel, readProductProfile } from '../pins.ts'
import { resolvedStyle } from '../resolved-style.ts'
import { tokenScopes } from './scopedTokens.ts'
import { workerThemeRegistration } from './theme.ts'
import { createIncrementalTokenizer, type TokenLineSnapshot } from './tokenizer.ts'
import { ensureHighlighter, ensureLanguages, uniqueLanguageRegistrations } from './worker.ts'

/** `cold` registers the document grammar's module only; `warm` also every language it lazily embeds. */
export type Registration = 'cold' | 'warm'

export interface ProductRequest {
  readonly profileId: ReferenceProfileId
  readonly languageId: string
  readonly source: string
  readonly themeIds: readonly string[]
}

async function highlighterFor(request: ProductRequest, registration: Registration) {
  const [first, ...rest] = await Promise.all(
    request.themeIds.map(async (themeId) => workerThemeRegistration(await themeModule(themeId), themeId)),
  )
  if (first === undefined) throw new Error('the product tokenizer needs a theme')
  const highlighter = await ensureHighlighter({
    languageRegistrations: await languageRegistrations(request.languageId),
    themeRegistration: first,
    themeRegistrations: rest,
  })
  const embedded = registration === 'warm' ? warmLanguages(request.languageId).slice(1) : []
  const registrations = (await Promise.all(embedded.map(languageRegistrations))).flat()
  await ensureLanguages(highlighter, uniqueLanguageRegistrations(registrations))
  return { highlighter, embedded }
}

/**
 * The product's line texts at exact source offsets. Its splitLines also strips a CR that ends the
 * final segment with no LF after it; that unit then has no token and is tiled like a terminator.
 */
function productLines(source: string, snapshot: readonly TokenLineSnapshot[]): SourceLine[] {
  const lines = sourceLines(source)
  if (snapshot.length !== lines.length) throw new Error(`the tokenizer split ${snapshot.length} lines, the source has ${lines.length}`)
  return lines.map((line, index) => {
    const text = snapshot[index]?.text ?? ''
    if (text === line.text) return line
    if (index === lines.length - 1 && line.text === `${text}\r`) return { ...line, text }
    throw new Error(`tokenizer line ${index} diverges from the source`)
  })
}

const tokenSpans = <V>(line: TokenLineSnapshot | undefined, value: (token: ThemedToken) => V): LineSpan<V>[] =>
  (line?.tokens ?? []).map((token) => ({ from: token.offset, to: token.offset + token.content.length, value: value(token) }))

export async function productDocument(request: ProductRequest, registration: Registration): Promise<CompleteResult> {
  const profile = readProductProfile()
  const maxLineLength = profile.tokenization.lineLimit.settingDefault
  const { highlighter, embedded } = await highlighterFor(request, registration)
  const { tokenizer } = await createIncrementalTokenizer({
    lang: request.languageId,
    theme: request.themeIds[0] ?? '',
    code: request.source,
    highlighter,
    maxLineLength,
  })
  const snapshot = tokenizer.getSnapshot().lines
  const lines = productLines(request.source, snapshot)
  const engine = {
    adapter: `port of the Platform ${profile.platform.commit} shiki tokenizer`,
    shiki: pinLabel(PINS.shiki),
    textmate: pinLabel(PINS.shikiTextmate),
    oniguruma: pinLabel(PINS.shikiOniguruma),
    onigurumaWasmSha256: profile.engine.wasm.sha256,
    grammars: pinLabel(PINS.langs),
    themes: pinLabel(PINS.themes),
    maxLineLength: String(maxLineLength),
    registration,
    ...(registration === 'warm' ? { preregistered: embedded.join(' ') } : {}),
  }
  const builder = new ResultBuilder({ profileId: request.profileId, languageId: request.languageId, engine }, request.source)
  const plain = tokenizer.untokenizedLineCount()
  if (plain > 0) builder.diagnostic(`${plain} line(s) longer than ${maxLineLength} units stay one plain token`)
  writeTrack(lines, (line) => tokenSpans(snapshot[line], tokenScopes), (from, to, value) => builder.scope(from, to, value), SEPARATOR_SCOPES)
  request.themeIds.forEach((themeId, index) => {
    if (index > 0) tokenizer.setTheme(themeId)
    const styled = (token: ThemedToken) => resolvedStyle(token.color ?? '', token.fontStyle ?? 0)
    writeTrack(lines, (line) => tokenSpans(snapshot[line], styled), (from, to, value) => builder.style(themeId, from, to, value), SEPARATOR_STYLE)
  })
  return builder.complete()
}
