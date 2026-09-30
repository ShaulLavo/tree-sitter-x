import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { compareResults, type CompareOptions } from '../compare.ts'
import { formatComparison, writeReport } from '../report.ts'
import { readResultFile } from '../serialize.ts'

interface Sink {
  write(text: string): unknown
}

const USAGE = 'usage: npm run compare -- <reference.json> <candidate.json> [--source <file>] [--theme <id>] [--runs <n>] [--json <out.json>]\n'

interface Invocation {
  readonly referencePath: string
  readonly candidatePath: string
  readonly sourcePath?: string
  readonly themeId?: string
  readonly maxRuns?: number
  readonly jsonPath?: string
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseRuns(text: string | undefined): number | undefined {
  if (text === undefined) return undefined
  if (!/^\d+$/.test(text)) throw new RangeError(`--runs must be a non-negative integer, got ${JSON.stringify(text)}`)
  return Number(text)
}

function parseInvocation(argv: readonly string[]): Invocation {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      source: { type: 'string' },
      theme: { type: 'string' },
      runs: { type: 'string' },
      json: { type: 'string' },
    },
  })
  const [referencePath, candidatePath, ...rest] = positionals
  if (referencePath === undefined || candidatePath === undefined || rest.length > 0) {
    throw new RangeError(`expected exactly two result files, got ${positionals.length}`)
  }
  const maxRuns = parseRuns(values.runs)
  return {
    referencePath,
    candidatePath,
    ...(values.source === undefined ? {} : { sourcePath: values.source }),
    ...(values.theme === undefined ? {} : { themeId: values.theme }),
    ...(maxRuns === undefined ? {} : { maxRuns }),
    ...(values.json === undefined ? {} : { jsonPath: values.json }),
  }
}

function run(invocation: Invocation, out: Sink): void {
  const source = invocation.sourcePath === undefined ? undefined : readFileSync(invocation.sourcePath, 'utf8')
  // Each file is validated alone; compareResults decides what the source means for the pair.
  const reference = readResultFile(invocation.referencePath)
  const candidate = readResultFile(invocation.candidatePath)
  const options: CompareOptions = {
    ...(source === undefined ? {} : { source }),
    ...(invocation.themeId === undefined ? {} : { themeId: invocation.themeId }),
    ...(invocation.maxRuns === undefined ? {} : { maxRuns: invocation.maxRuns }),
  }
  const comparison = compareResults(reference, candidate, options)
  out.write(formatComparison(comparison))
  if (invocation.jsonPath !== undefined) writeReport(invocation.jsonPath, comparison)
}

/** 0 when both inputs are valid, whatever the report says; 2 on usage errors; 1 on unreadable or invalid input. */
export function main(argv: readonly string[], out: Sink = process.stdout, err: Sink = process.stderr): number {
  let invocation: Invocation
  try {
    invocation = parseInvocation(argv)
  } catch (error) {
    err.write(`${message(error)}\n${USAGE}`)
    return 2
  }
  try {
    run(invocation, out)
    return 0
  } catch (error) {
    err.write(`${message(error)}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
