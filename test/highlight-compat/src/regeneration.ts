import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { artifactDifferences, artifactHash } from './artifacts.ts'
import type { GateTestCount } from './phase1-gate.ts'

export interface RegenerationSteps {
  readonly generate: (root: string) => Promise<void>
  readonly selfTests: (goldenRoot: string) => readonly GateTestCount[]
}

export async function regenerationRuns(scratch: string, steps: RegenerationSteps): Promise<{
  readonly first: string
  readonly second: string
  readonly firstHash: string
  readonly secondHash: string
  readonly counts: readonly GateTestCount[]
}> {
  const first = join(scratch, 'first'), second = join(scratch, 'second')
  await steps.generate(first)
  const counts = steps.selfTests(join(first, 'goldens'))
  const firstHash = artifactHash(first)
  await steps.generate(second)
  const secondHash = artifactHash(second)
  return { first, second, firstHash, secondHash, counts }
}

export interface PublicationOperations {
  readonly copy?: typeof cpSync
  readonly rename?: (source: string, destination: string) => void
}

export function publishArtifacts(generated: string, root: string, operations: PublicationOperations = {}): void {
  const copy = operations.copy ?? cpSync
  const rename = operations.rename ?? renameSync
  const staging = mkdtempSync(join(root, '.artifacts-'))
  const directories = ['goldens', 'reports'] as const
  const retired: string[] = [], installed: string[] = []
  let removeStaging = true
  try {
    mkdirSync(join(staging, 'old'))
    for (const directory of directories) {
      artifactHash(join(generated, directory))
      artifactHash(join(root, directory))
      copy(join(generated, directory), join(staging, directory), { recursive: true })
      if (artifactDifferences(join(generated, directory), join(staging, directory)).length > 0) throw new Error(`staged ${directory} bytes differ`)
    }
    for (const directory of directories) {
      if (!existsSync(join(root, directory))) continue
      rename(join(root, directory), join(staging, 'old', directory))
      retired.push(directory)
    }
    for (const directory of directories) {
      rename(join(staging, directory), join(root, directory))
      installed.push(directory)
    }
  } catch (error) {
    try {
      for (const directory of installed) rmSync(join(root, directory), { recursive: true, force: true })
      for (const directory of retired.reverse()) renameSync(join(staging, 'old', directory), join(root, directory))
    } catch (rollbackError) {
      removeStaging = false
      throw new AggregateError([error, rollbackError], `artifact publication and rollback failed; backups retained at ${staging}`)
    }
    throw error
  } finally {
    if (removeStaging) rmSync(staging, { recursive: true, force: true })
  }
}
