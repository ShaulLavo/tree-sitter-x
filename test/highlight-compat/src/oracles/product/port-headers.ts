import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PORT_DIR = fileURLToPath(new URL('./', import.meta.url))

/** What a ported file's header claims: the Platform file, commit and blob sha256 it was ported from. */
export interface PortHeader {
  readonly file: string
  readonly platformPath: string
  readonly commit: string
  readonly sha256: string
}

const HEADER = /^\/\/ Port of Platform (\S+)\n\/\/ platform-commit: ([0-9a-f]{40})\n\/\/ platform-blob-sha256: ([0-9a-f]{64})\n/

export function parsePortHeader(file: string, text: string): PortHeader | undefined {
  const match = HEADER.exec(text)
  if (match === null) return undefined
  const [, platformPath = '', commit = '', sha256 = ''] = match
  return { file, platformPath, commit, sha256 }
}

/** Every file in this directory that starts with a port header. */
export function portHeaders(dir = PORT_DIR): PortHeader[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .flatMap((name) => parsePortHeader(name, readFileSync(join(dir, name), 'utf8')) ?? [])
}

/** Each header must name the locked commit and a cited source with the same blob hash. */
export function portProblems(
  headers: readonly PortHeader[],
  platform: { readonly commit: string; readonly inputs: readonly { readonly path: string; readonly sha256: string }[] },
): string[] {
  return headers.flatMap((header) => {
    const cited = platform.inputs.find((input) => input.path === header.platformPath)
    if (cited === undefined) return [`${header.file}: ${header.platformPath} is not a cited source in product-profile.json`]
    const problems: string[] = []
    if (header.commit !== platform.commit) problems.push(`${header.file}: ported from ${header.commit}, the profile locks ${platform.commit}`)
    if (header.sha256 !== cited.sha256) {
      problems.push(`${header.file}: ported blob ${header.sha256}, product-profile.json cites ${cited.sha256}; re-port ${header.platformPath}`)
    }
    return problems
  })
}
