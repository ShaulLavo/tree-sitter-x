import type { LanguageRegistration, ThemeRegistration } from 'shiki/core'
import { readProductProfile } from './pins.ts'

/** A grammar's registrations as the product loads them: its module's default export, dependencies first. */
export async function languageRegistrations(grammar: string): Promise<LanguageRegistration[]> {
  const module = (await import(/* @vite-ignore */ `@shikijs/langs/${grammar}`)) as { default: LanguageRegistration[] }
  return module.default
}

/** The grammar, then every language its registrations list as lazily embedded, transitively. */
export function warmLanguages(grammar: string): string[] {
  const registrations = new Map(readProductProfile().languages.registrations.map((entry) => [entry.name, entry]))
  const order: string[] = []
  const visit = (name: string): void => {
    if (order.includes(name)) return
    const entry = registrations.get(name)
    if (entry === undefined) throw new Error(`product-profile.json has no registration named ${JSON.stringify(name)}`)
    order.push(name)
    for (const dependency of entry.moduleImports) visit(dependency)
    for (const lazy of entry.embeddedLangsLazy ?? []) visit(lazy)
  }
  visit(grammar)
  return order
}

export type ThemeModule = ThemeRegistration & { readonly name: string }

/** A bundled theme's default export. Throws when a scopeless rule sets a font style. */
export async function themeModule(themeId: string): Promise<ThemeModule> {
  const module = (await import(/* @vite-ignore */ `@shikijs/themes/${themeId}`)) as { default: ThemeModule }
  const theme = module.default
  const rules = theme.settings ?? theme.tokenColors ?? []
  const global = rules.find((rule) => rule.scope === undefined && rule.settings.fontStyle !== undefined)
  if (global !== undefined) throw new Error(`theme ${themeId}: a default font style breaks the resolved-style convention`)
  return theme
}
