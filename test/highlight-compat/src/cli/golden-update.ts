import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { GOLDEN_ROOT, referenceRefusal, updateGoldens } from '../golden.ts'
import { isReferenceProfile } from '../schema.ts'
import { goldenProducers } from '../golden-producers.ts'

const USAGE = 'usage: npm run golden:update -- --profile <reference profile, e.g. product or product:warm> [--root <dir>]'

interface Options {
  readonly profile: string
  readonly root: string
}

function parseOptions(argv: readonly string[]): Options | undefined {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { profile: { type: 'string' }, root: { type: 'string' } },
    })
    if (values.profile === undefined) return undefined
    return { profile: values.profile, root: values.root ?? GOLDEN_ROOT }
  } catch {
    return undefined
  }
}

export async function main(argv: readonly string[], producers = goldenProducers): Promise<number> {
  const options = parseOptions(argv)
  if (options === undefined) {
    console.error(USAGE)
    return 2
  }
  const { profile, root } = options
  if (!isReferenceProfile(profile)) {
    console.error(referenceRefusal(profile))
    return 2
  }
  const producer = producers[profile]
  if (producer === undefined) {
    console.error(`no golden producer registered for profile ${JSON.stringify(profile)}`)
    return 2
  }
  try {
    const update = await updateGoldens(root, profile, producer)
    console.log(`${profile}: ${update.written.length} written, ${update.unchanged.length} unchanged, ${update.removed.length} removed`)
    for (const path of update.written) console.log(`wrote ${path}`)
    for (const path of update.removed) console.log(`removed ${path}`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2))
