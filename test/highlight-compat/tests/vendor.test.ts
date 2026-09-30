import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCase, selectedCases, SUITES, SUITE_IDS, VENDOR_ROOT } from '../src/oracles/conformance.ts'

interface RecordedFile {
  readonly id: string
  readonly repository: string
  readonly path: string
  readonly sha256: string
  readonly decision?: string
}

const manifest = JSON.parse(readFileSync(new URL('../manifest/fixture-sources.json', import.meta.url), 'utf8')) as {
  files: RecordedFile[]
}
const recorded = new Map(manifest.files.filter((file) => file.repository === 'vscode-textmate').map((file) => [file.path, file]))

function vendoredPaths(dir = VENDOR_ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? vendoredPaths(path) : [relative(VENDOR_ROOT, path)]
  })
}

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(join(VENDOR_ROOT, path))).digest('hex')

describe('vendor/vscode-textmate', () => {
  const vendored = vendoredPaths().filter((path) => path !== 'NOTICE')

  it('holds only files fixture-sources.json records, byte for byte', () => {
    const problems = vendored.flatMap((path) => {
      const file = recorded.get(path)
      if (file === undefined) return [`${path}: not recorded`]
      if (file.decision === 'skip') return [`${path}: recorded as skipped`]
      return file.sha256 === sha256(path) ? [] : [`${path}: sha256 ${sha256(path)}, recorded ${file.sha256}`]
    })
    expect(problems).toEqual([])
  })

  it('holds every suite and every grammar a selected case loads', () => {
    const needed = new Set(SUITE_IDS.map((suite) => SUITES[suite].path))
    for (const ref of selectedCases()) {
      const suiteDir = SUITES[ref.suite].path.split('/').slice(0, -1).join('/')
      for (const grammar of loadCase(ref).grammars) needed.add(`${suiteDir}/${grammar}`)
    }
    expect([...needed].filter((path) => !vendored.includes(path))).toEqual([])
  })

  it('leaves out the SQL grammar the manifest skips', () => {
    expect(vendored).not.toContain('test-cases/first-mate/fixtures/sql.json')
  })
})
