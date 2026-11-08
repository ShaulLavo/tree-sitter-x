import type { NativeThemeObservation } from '../native-theme-schema.ts'

export const ADMISSION_ROOT = new URL('../../../manifest/native-theme-admission/', import.meta.url)
export const ADMISSION_SCHEMA = 'native-theme-admission-oracle/v1'
export const CONTRACT_AUTHORITY = 'authored-design-010-parent-amendment/2026-11-08'
export const PROJECTION = {
  id: 'syntax-three-fields-and-untouched-ui/v1',
  effective: ['foreground', 'background', 'fontMask', 'fontStyle'],
  rawApplied: ['foreground', 'background', 'fontMask', 'fontStyle'],
  productApplied: ['foreground', 'fontMask', 'fontStyle'],
  upstreamMetrics: 'retained separately from projected fields when exposed by upstream',
  ui: 'omit validated null/string-arrays only for keys other than editor.foreground/editor.background/terminal.ansi*',
} as const

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type ObjectValue = { [key: string]: Json }
export interface Resource { readonly id: string; readonly bytes: string; readonly sha256: string }
export interface ResourceLocation {
  readonly kind: 'resource'
  readonly resource: string
  readonly jsonPointer: string
  readonly byteOffset: null
}
export interface Warning {
  readonly kind: 'outside-score'
  readonly resource: string
  readonly property: string
  readonly location?: ResourceLocation
}
export type Admission = { readonly kind: 'ok'; readonly warnings: readonly Warning[] }
  | { readonly kind: 'invalid' | 'unsupported'; readonly code: string; readonly location: Json }
export interface AdmissionInput {
  readonly id: string
  readonly group: string
  readonly root: string
  readonly resources: readonly Resource[]
  readonly edges: readonly { readonly from: string; readonly to: string; readonly ordinal: number }[]
  readonly baseFirst: readonly string[]
  readonly expanded: ObjectValue
  readonly stacks: readonly { readonly id: string; readonly scopes: readonly string[] }[]
  readonly contract: { readonly authority: typeof CONTRACT_AUTHORITY; readonly admission: Admission }
  readonly projection: 'untouched-ui' | 'none'
  readonly shikiApi: boolean
}
export interface TargetError { readonly kind: 'error'; readonly stage: string; readonly name: string; readonly message: string }
export interface Direct {
  readonly grammar: Json
  readonly at: number
  readonly rawScopes: Json
  readonly text: string
  readonly raw: Json
  readonly rawFork: Json
  readonly product: Json
  readonly shikiApi: Json
}
export interface Observation extends NativeThemeObservation {
  readonly id: string
  readonly scopes: readonly string[]
  readonly upstreamPartial: Json
  readonly direct: Direct | null
}
export type TargetObservation = TargetError | {
  readonly kind: 'observed'
  readonly normalized: Json
  readonly normalizedIdentity: string
  readonly cases: readonly Observation[]
}
export interface Attempt {
  readonly profile: 'raw' | 'product'
  readonly view: 'full' | 'typed-projection'
  readonly registration: ObjectValue
  readonly result: TargetObservation
}
export interface AdmissionFixture {
  readonly input: AdmissionInput
  readonly acquisitionIdentity: string
  readonly attempts: readonly Attempt[]
}
export interface AdmissionSuite {
  readonly schema: typeof ADMISSION_SCHEMA
  readonly identity: string
  readonly source: { readonly commit: string; readonly inputs: Readonly<Record<string, string>> }
  readonly projection: typeof PROJECTION
  readonly targets: Json
  readonly fixtures: readonly AdmissionFixture[]
  readonly transport: Json
}
