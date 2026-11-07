import type { IRawTheme } from '@shikijs/vscode-textmate'
import type { ThemeModule } from './assets.ts'

export type NativeThemeProfile = 'raw' | 'product'
export type NativeThemeField<T> = { readonly kind: 'inherit' } | { readonly kind: 'set'; readonly value: T }
export interface NativeThemePartial {
  readonly foreground: NativeThemeField<string>
  readonly background: NativeThemeField<string>
  readonly fontMask: NativeThemeField<number>
}
export type NativeThemeFont = 'reset' | {
  readonly italic?: true
  readonly bold?: true
  readonly underline?: true
  readonly strikethrough?: true
}
export interface NativeThemeEffective {
  readonly foreground: string
  readonly background: string
  readonly fontMask: number
  readonly fontStyle: NativeThemeFont
}
export type NativeThemeApplied = NativeThemeEffective | Omit<NativeThemeEffective, 'background'>
export interface NativeThemeObservation {
  readonly effective: NativeThemeEffective
  readonly applied: NativeThemeApplied
  readonly trace: readonly { readonly scope: string; readonly partial: NativeThemePartial }[]
}
export interface NativeThemeStack {
  readonly id: string
  readonly scopes: readonly string[]
}
export interface NativeThemeSource {
  readonly id: string
  readonly file: string
  readonly bytes: string
  readonly sha256: string
}
export interface NativeThemeInput {
  readonly id: string
  readonly root: string
  readonly resources: readonly NativeThemeSource[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly ordinal: number }[]
  readonly expanded: ThemeModule
  readonly stacks: readonly NativeThemeStack[]
  readonly warnings: readonly { readonly kind: 'outside-score'; readonly resource: string; readonly property: string }[]
}
export interface NativeThemeFixture {
  readonly id: string
  readonly profile: NativeThemeProfile
  readonly acquisitionIdentity: string
  readonly contentIdentity: string
  readonly normalizedSettingsIdentity: string
  readonly input: NativeThemeInput
  readonly normalized: IRawTheme
  readonly defaults: NativeThemeEffective
  readonly cases: readonly (NativeThemeStack & NativeThemeObservation)[]
}
export interface NativeThemeTargets {
  readonly fork: { readonly version: '10.0.2'; readonly sha256: string }
  readonly raw: { readonly version: '9.3.2'; readonly sha256: string; readonly commit: string }
  readonly shiki: { readonly version: '4.4.3'; readonly sha256: string; readonly coreSha256: string }
  readonly oniguruma: { readonly version: '2.0.1'; readonly wasmSha256: string }
  readonly product: { readonly commit: string; readonly themeSha256: string; readonly tokensSha256: string }
}
export interface NativeThemeSuite {
  readonly schema: 'native-theme-oracle/v1'
  readonly identity: string
  readonly targets: NativeThemeTargets
  readonly fixtures: readonly NativeThemeFixture[]
}

export const NATIVE_THEME_MANIFEST = new URL('../../manifest/native-themes/', import.meta.url)
