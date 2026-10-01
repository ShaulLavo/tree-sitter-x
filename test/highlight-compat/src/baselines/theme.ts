import { normalizeTheme } from 'shiki/core'
import { Theme } from '@shikijs/vscode-textmate'
import type { IRawTheme } from '@shikijs/vscode-textmate'
import { ResultBuilder } from '../build.ts'
import type { CompleteResult, ProfileId } from '../schema.ts'
import { themeModule } from '../oracles/assets.ts'
import { ORACLE_THEMES } from '../oracles/pins.ts'
import { ScopePath } from '../oracles/product/scopePath.ts'
import { workerThemeRegistration } from '../oracles/product/theme.ts'
import { vscodeRawTheme } from '../oracles/raw.ts'
import { resolvedStyle } from '../oracles/resolved-style.ts'
import type { ScopeInterval } from './compose.ts'

export type StyleReference = 'raw' | 'product'

export async function referenceTheme(themeId: string, reference: StyleReference): Promise<Theme> {
  const module = await themeModule(themeId)
  const input = reference === 'raw' ? vscodeRawTheme(module) : normalizeTheme(workerThemeRegistration(module))
  return Theme.createFromRawTheme(input as IRawTheme)
}

export function styleForScopes(theme: Theme, scopes: readonly string[]) {
  const defaults = theme.getDefaults()
  let foreground = defaults.foregroundId, fontStyle = defaults.fontStyle
  let path: ScopePath | null = null
  for (const scope of scopes) {
    path = new ScopePath(path, scope)
    const match = theme.match(path)
    if (match === null) continue
    if (match.foregroundId !== 0) foreground = match.foregroundId
    if (match.fontStyle !== -1) fontStyle = match.fontStyle
  }
  return resolvedStyle(theme.getColorMap()[foreground] ?? '', fontStyle)
}

export async function paintScopes(profileId: ProfileId, languageId: string, source: string, intervals: readonly ScopeInterval[], reference: StyleReference, engine: Readonly<Record<string, string>>, diagnostics: readonly string[] = []): Promise<CompleteResult> {
  const builder = new ResultBuilder({ profileId, languageId, engine: { ...engine, styleReference: reference, themeMatcher: '@shikijs/vscode-textmate@10.0.2 Theme' } }, source)
  for (const diagnostic of diagnostics) builder.diagnostic(diagnostic)
  for (const interval of intervals) builder.scope(interval.from, interval.to, interval.scopes)
  for (const themeId of ORACLE_THEMES) {
    const theme = await referenceTheme(themeId, reference)
    for (const interval of intervals) builder.style(themeId, interval.from, interval.to, /^\r?\n$/.test(source.slice(interval.from, interval.to)) ? {} : styleForScopes(theme, interval.scopes))
  }
  return builder.complete()
}
