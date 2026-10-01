import { readFileSync } from 'node:fs'

export const harnessRoot = new URL('../../', import.meta.url)

export interface ManifestFile {
  readonly id: string
  readonly repository: string
  readonly revision: string
  readonly path: string
  readonly sha256: string
  readonly bytes: number
  readonly roles: readonly string[]
  readonly decision?: string
  readonly decisionReason?: string
  readonly sourceFileId?: string
  readonly grammarExpectationId?: string
  readonly languageIds?: readonly string[]
  readonly provenance?: {
    readonly category: string
    readonly licenseStatus: string
    readonly licenseRefs: readonly string[]
  }
}

export interface ManifestSource {
  readonly id: string
  readonly family: string
  readonly fileIds: readonly string[]
  readonly dependencyFileIds?: readonly string[]
  readonly counts: { readonly selectedCandidateFiles: number; readonly inventoryFiles: number }
}

export interface ManifestGrammar {
  readonly id: string
  readonly grammarFileId?: string
  readonly referenceCheckoutRevision?: string
  readonly upstreamVersion?: string
  readonly productPackage?: string
  readonly expectedOutputGenerationRevision?: string | null
  readonly coreComparison?: { readonly productSha256: string }
}

export interface FixtureManifest {
  readonly sources: readonly ManifestSource[]
  readonly files: readonly ManifestFile[]
  readonly grammarExpectations: readonly ManifestGrammar[]
  readonly product: { readonly revision: string; readonly package: string; readonly version: string }
  readonly counts: { readonly selectedCandidatePrimaryArtifactFiles: number; readonly skippedPrimaryArtifacts: number }
  readonly licenses: readonly { readonly id: string; readonly spdx: string | null; readonly fileId: string }[]
  readonly repositories: readonly { readonly id: string; readonly url: string; readonly revision: string }[]
}

// This is a committed, independently reviewed inventory, not a user-supplied document.
export function readManifest(): FixtureManifest {
  return JSON.parse(readFileSync(new URL('manifest/fixture-sources.json', harnessRoot), 'utf8')) as FixtureManifest
}
