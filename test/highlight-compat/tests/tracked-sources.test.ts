import { execFileSync } from 'node:child_process'
import { dirname, join, normalize } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// Statements only: the extraction tests build fixture modules from import text inside strings.
const IMPORT = /^\s*(?:import|export)\b[^'\n]*\bfrom '(\.{1,2}\/[^']+)'/gm

/** Files git would put in a fresh clone, relative to the harness root. */
function tracked(): Set<string> {
  const listing = execFileSync('git', ['ls-files', '-z', '--', '.'], { cwd: ROOT, encoding: 'utf8' })
  return new Set(listing.split('\0').filter(Boolean).map((path) => normalize(path)))
}

describe('the committed tree', () => {
  it('holds every file a tracked source imports by relative path', () => {
    const files = tracked()
    const missing = [...files]
      .filter((path) => /\.(ts|mjs)$/.test(path))
      .flatMap((path) =>
        [...readFileSync(join(ROOT, path), 'utf8').matchAll(IMPORT)]
          .map((match) => normalize(join(dirname(path), match[1] ?? '')))
          .filter((target) => !files.has(target))
          .map((target) => `${path} imports ${target}, which git does not track`),
      )
    expect(missing).toEqual([])
  })
})
