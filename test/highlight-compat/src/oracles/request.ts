import type { CompleteResult } from '../schema.ts'
import type { CaseRef, ExpectedToken } from './conformance.ts'

/** The reference profiles this harness implements; `vscode` has no adapter yet. */
export type OracleProfileId = 'raw' | 'raw:shiki-fork' | 'shiki-api' | 'product' | 'product:warm'

export const ORACLE_PROFILES: readonly OracleProfileId[] = ['raw', 'raw:shiki-fork', 'shiki-api', 'product', 'product:warm']

/** Profiles that can load arbitrary TextMate grammars, and so run the conformance suites. */
export type ConformanceProfileId = Extract<OracleProfileId, 'raw' | 'raw:shiki-fork'>

export const CONFORMANCE_PROFILES: readonly ConformanceProfileId[] = ['raw', 'raw:shiki-fork']

/** `languageId` is a Shiki grammar name, used for the grammar and the result alike. */
export interface DocumentRequest {
  readonly kind: 'document'
  readonly profileId: OracleProfileId
  readonly languageId: string
  readonly source: string
  readonly themeIds: readonly string[]
  readonly metadata?: 'required-language-v1'
}

/** Validate the serializable option before dispatch, including callers outside TypeScript. */
export function validateMetadataOption(request: { readonly metadata?: unknown }): void {
  for (const key of Object.keys(request)) {
    if (!['kind', 'profileId', 'languageId', 'source', 'themeIds', 'metadata'].includes(key))
      throw new Error(`unknown request option ${key}`)
  }
  if (Object.hasOwn(request, 'metadata') && request.metadata !== 'required-language-v1')
    throw new Error('metadata must be required-language-v1 when present')
}

export interface ConformanceRequest extends CaseRef {
  readonly kind: 'conformance'
  readonly profileId: ConformanceProfileId
}

export type OracleRequest = DocumentRequest | ConformanceRequest

/** Actual tokens per case line, mapped as the upstream runner maps them, plus the same run as a result. */
export interface ConformanceAnswer {
  readonly lines: readonly (readonly ExpectedToken[])[]
  readonly result: CompleteResult
}

export type WorkerReply = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string }
