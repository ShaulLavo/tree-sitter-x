import { parentPort } from 'node:worker_threads'

import { ResultBuilder } from '../../src/build.ts'
import { compareResults } from '../../src/compare.ts'
import type { CompleteResult, ProfileId } from '../../src/schema.ts'

const LINE = 'const a = "x";     \n'
const SOURCE = LINE.repeat(5_000_000 / LINE.length)
const MATCH = ['source.ts', 'meta.var.expr.ts']
const MISMATCH = ['source.ts', 'comment.line.double-slash.ts']
const MISMATCHED_BLOCKS = new Set([1, 5001, 10001, 15001, 20001, 20002])
const RESTYLED_BLOCK = 3

interface Layout {
  readonly profileId: ProfileId
  readonly scopeLength: number
  readonly styleLength: number
  readonly mismatches: boolean
}

function build(layout: Layout): CompleteResult {
  const result = new ResultBuilder({ profileId: layout.profileId, languageId: 'typescript' }, SOURCE)
  for (let from = 0, block = 0; from < SOURCE.length; from += layout.scopeLength, block++) {
    const path = layout.mismatches && MISMATCHED_BLOCKS.has(block) ? MISMATCH : MATCH
    result.scope(from, from + layout.scopeLength, path)
  }
  for (let from = 0, block = 0; from < SOURCE.length; from += layout.styleLength, block++) {
    const foreground = layout.mismatches && block === RESTYLED_BLOCK ? '#ff0000' : '#d4d4d4'
    result.style('dark', from, from + layout.styleLength, { foreground })
  }
  return result.complete()
}

const reference = build({ profileId: 'vscode', scopeLength: 125, styleLength: 250, mismatches: false })
const candidate = build({ profileId: 'native', scopeLength: 200, styleLength: 400, mismatches: true })
const comparison = compareResults(reference, candidate, { source: SOURCE })

if (comparison.comparable && comparison.styles.dark?.compared === true) {
  const { scopes } = comparison
  const dark = comparison.styles.dark.report
  parentPort?.postMessage({
    sourceLength: SOURCE.length,
    spans: [reference.spans.length / 3, candidate.spans.length / 3],
    scopes: {
      all: scopes.agreement.all,
      nonWhitespace: scopes.agreement.nonWhitespace,
      mismatches: [scopes.mismatches.count, scopes.mismatches.units, scopes.mismatches.longest],
    },
    dark: {
      all: dark.agreement.all,
      mismatches: [dark.mismatches.count, dark.mismatches.units, dark.mismatches.longest],
      foreground: dark.fields.foreground,
    },
  })
}
