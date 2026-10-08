export type ResultStatus = 'complete' | 'unsupported' | 'timeout' | 'error' | 'canceled'
export type IncompleteStatus = Exclude<ResultStatus, 'complete'>

export type ReferenceBase = 'product' | 'raw' | 'shiki-api' | 'vscode'
/** A reference base, optionally narrowed by a variant: `product`, `product:warm`, `raw:shiki-fork`. */
export type ReferenceProfileId = ReferenceBase | `${ReferenceBase}:${string}`
export type CandidateProfileId = 'native' | `baseline:${string}`
export type ProfileId = ReferenceProfileId | CandidateProfileId

export const REFERENCE_BASES: readonly ReferenceBase[] = ['product', 'raw', 'shiki-api', 'vscode']

const VARIANT = '[a-z0-9][a-z0-9._-]*'
const REFERENCE_PROFILE = new RegExp(`^(${REFERENCE_BASES.join('|')})(:${VARIANT})?$`)
const CANDIDATE_PROFILE = new RegExp(`^(native|baseline:${VARIANT})$`)

export function isReferenceProfile(profileId: string): profileId is ReferenceProfileId {
  return REFERENCE_PROFILE.test(profileId)
}

export function isProfileId(profileId: string): profileId is ProfileId {
  return isReferenceProfile(profileId) || CANDIDATE_PROFILE.test(profileId)
}

export const PROFILE_ID_GRAMMAR = `<${REFERENCE_BASES.join('|')}>[:variant], native or baseline:<name>`

export interface FontStyle {
  readonly bold?: true
  readonly italic?: true
  readonly underline?: true
  readonly strikethrough?: true
}

/** Absent fields inherit the theme default; `fontStyle: 'reset'` is an explicit empty font style. */
export interface Style {
  readonly foreground?: string
  readonly background?: string
  readonly fontStyle?: FontStyle | 'reset'
}

/** Flat triples `[from, to, valueIndex]` over half-open UTF-16 offsets. */
export type SpanTriples = readonly number[]

export interface MetadataTrack {
  readonly languageIds: readonly string[]
  readonly spans: SpanTriples
}

export interface StyleTrack {
  readonly styles: readonly Style[]
  readonly spans: SpanTriples
}

interface ResultCommon {
  readonly schema: 1
  readonly profileId: ProfileId
  readonly languageId: string
  /** sha256 of the source as WTF-8: UTF-8 for well-formed text, lone surrogates kept as 3-byte sequences. */
  readonly sourceSha256: string
  /** UTF-16 code units, `String.prototype.length`. */
  readonly sourceLength: number
  readonly documentRevision: number
  readonly diagnostics: readonly string[]
  /** Engine and asset identities only. Timing lives in `ResultTiming`. */
  readonly engine: Readonly<Record<string, string>>
}

/** Spans in every track tile `[0, sourceLength)`; names, paths and styles are interned in first-use order. */
export interface CompleteResult extends ResultCommon {
  readonly status: 'complete'
  readonly scopeNames: readonly string[]
  /** Ordered scope stacks, outermost first, as indices into `scopeNames`. */
  readonly paths: readonly (readonly number[])[]
  readonly spans: SpanTriples
  readonly metadata?: MetadataTrack
  readonly styles?: Readonly<Record<string, StyleTrack>>
}

/** A result that produced no trustworthy output; `diagnostics` says why. */
export interface IncompleteResult extends ResultCommon {
  readonly status: IncompleteStatus
  readonly scopeNames: readonly []
  readonly paths: readonly []
  readonly spans: readonly []
}

export type DocumentResult = CompleteResult | IncompleteResult

/** Work measurements for one result. Never part of golden equality. */
export interface ResultTiming {
  readonly profileId: ProfileId
  readonly languageId: string
  readonly fixtureId: string
  readonly sourceSha256: string
  readonly documentRevision: number
  readonly elapsedMs: number
}
