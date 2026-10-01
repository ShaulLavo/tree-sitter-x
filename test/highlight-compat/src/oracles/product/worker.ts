// Port of Platform editor/packages/editor/src/shiki/shiki.worker.ts
// platform-commit: 7f0dfc9e29fa9e3ee90c981147f77f6fcb656481
// platform-blob-sha256: 409f3bddc6be34895d0394592ebdfb37e7c743ecdee37210b7f4d013dd85bc95
// Changes: only the highlighter and registration path of openDocument (ensureHighlighter,
// ensureLanguages, the createHighlighterCore call and the unique* helpers), with the highlighter
// cache, message handling and packing left out. Registrations are Shiki's types, and the options
// object carries only the fields ensureHighlighter reads.
import { createOnigurumaEngine } from '@shikijs/engine-oniguruma'
import wasm from '@shikijs/engine-oniguruma/wasm-inlined'
import {
  createHighlighterCore,
  type HighlighterGeneric,
  type LanguageRegistration,
  type ThemeRegistrationAny,
} from 'shiki/core'

type ShikiWorkerLanguageRegistration = LanguageRegistration
type ShikiWorkerThemeRegistration = ThemeRegistrationAny

export interface ShikiWorkerDocumentOptions {
  readonly languageRegistrations: readonly ShikiWorkerLanguageRegistration[]
  readonly themeRegistration: ShikiWorkerThemeRegistration
  readonly themeRegistrations: readonly ShikiWorkerThemeRegistration[]
}

export const ensureHighlighter = async (
  options: ShikiWorkerDocumentOptions,
): Promise<HighlighterGeneric<string, string>> => {
  const languages = uniqueLanguageRegistrations(options.languageRegistrations)
  const themes = uniqueThemeRegistrations([
    options.themeRegistration,
    ...options.themeRegistrations,
  ])
  const highlighter = await ensureHighlighterFor(languages, themes)
  await ensureLanguages(highlighter, languages)

  return highlighter
}

export const ensureLanguages = async (
  highlighter: HighlighterGeneric<string, string>,
  registrations: readonly ShikiWorkerLanguageRegistration[],
): Promise<void> => {
  const loaded = new Set(highlighter.getLoadedLanguages())
  const missing = registrations.filter((registration) => !loaded.has(registration.name))
  if (missing.length === 0) return

  await highlighter.loadLanguage(...(missing as unknown as LanguageRegistration[]))
}

const ensureHighlighterFor = (
  languages: readonly ShikiWorkerLanguageRegistration[],
  themes: readonly ShikiWorkerThemeRegistration[],
): Promise<HighlighterGeneric<string, string>> =>
  createHighlighterCore({
    engine: createOnigurumaEngine(wasm),
    langs: languages as unknown as LanguageRegistration[],
    themes: themes as unknown as ThemeRegistrationAny[],
  }) as Promise<HighlighterGeneric<string, string>>

const themeRegistrationKey = (theme: ShikiWorkerThemeRegistration): string => JSON.stringify(theme)

export const uniqueLanguageRegistrations = (
  registrations: readonly ShikiWorkerLanguageRegistration[],
): ShikiWorkerLanguageRegistration[] =>
  uniqueBy(registrations, (registration) => `${registration.name}\u0000${registration.scopeName}`)

const uniqueThemeRegistrations = (
  registrations: readonly ShikiWorkerThemeRegistration[],
): ShikiWorkerThemeRegistration[] => uniqueBy(registrations, themeRegistrationKey)

const uniqueBy = <T>(items: readonly T[], keyFor: (item: T) => string): T[] => {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    const key = keyFor(item)
    if (seen.has(key)) continue

    seen.add(key)
    unique.push(item)
  }
  return unique
}
