import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ResultBuilder } from '../src/build.ts'
import { main } from '../src/cli/compare.ts'
import { compareResults } from '../src/compare.ts'
import { formatComparison, serializeReport } from '../src/report.ts'
import type { ProfileId } from '../src/schema.ts'
import { serializeResult } from '../src/serialize.ts'

const SOURCE = 'let a = 1\n'

function result(profileId: ProfileId, leaf: string): ResultBuilder {
  return new ResultBuilder({ profileId, languageId: 'typescript' }, SOURCE)
    .scope(0, 3, ['source.ts', 'storage.type'])
    .scope(3, 10, ['source.ts', leaf])
    .style('dark', 0, 10, { foreground: '#ffffff' })
}

function sink(): { readonly text: () => string; write(chunk: string): boolean } {
  const chunks: string[] = []
  return {
    text: () => chunks.join(''),
    write(chunk: string) {
      chunks.push(chunk)
      return true
    },
  }
}

describe('serializeReport', () => {
  it('sorts keys at every depth, indents by two and ends with a newline', () => {
    const comparison = compareResults(result('vscode', 'meta.var').complete(), result('native', 'meta.let').complete())
    const text = serializeReport(comparison)
    expect(text.endsWith('}\n')).toBe(true)
    expect(text).toContain('\n  "candidate": {\n    "documentRevision": 0,')
    const keyLists: string[][] = []
    JSON.parse(text, function (this: Record<string, unknown>, _key: string, value: unknown) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) keyLists.push(Object.keys(value))
      return value
    })
    expect(keyLists.length).toBeGreaterThan(10)
    for (const keys of keyLists) expect(keys).toEqual([...keys].sort())
    expect(serializeReport(comparison)).toBe(text)
  })
})

describe('formatComparison', () => {
  it('prints n/a for empty input', () => {
    const empty = (profileId: ProfileId) => new ResultBuilder({ profileId, languageId: 'typescript' }, '').complete()
    const text = formatComparison(compareResults(empty('vscode'), empty('native')))
    expect(text).toContain('agreement       n/a (0/0)')
    expect(text).toContain('non-whitespace  n/a (no source)')
    expect(text).not.toContain('100')
  })

  it('prints the reason a pair is not comparable', () => {
    const timedOut = new ResultBuilder({ profileId: 'native', languageId: 'typescript' }, SOURCE).incomplete('timeout', 'deadline')
    const text = formatComparison(compareResults(result('vscode', 'meta.var').complete(), timedOut))
    expect(text).toContain('not comparable: candidate status is timeout')
    expect(text).not.toContain('agreement')
  })

  it('prints agreement, categories and the first runs', () => {
    const text = formatComparison(
      compareResults(result('vscode', 'meta.var').complete(), result('native', 'meta.let').complete(), { source: SOURCE }),
    )
    expect(text).toContain('agreement       30.00% (3/10)')
    expect(text).toContain('non-whitespace  50.00% (3/6)')
    expect(text).toContain('    leaf           1 runs, 7 units')
    expect(text).toContain('[3, 10) leaf  reference: source.ts meta.var  candidate: source.ts meta.let')
    expect(text).toContain('style dark\n  agreement       100.00% (10/10)')
    expect(text).toContain('metadata\n  not compared: metadata track missing on reference and candidate')
  })
})

describe('compare CLI', () => {
  let dir = ''

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hc-report-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function files(): { readonly reference: string; readonly candidate: string; readonly source: string } {
    const paths = { reference: join(dir, 'reference.json'), candidate: join(dir, 'candidate.json'), source: join(dir, 'a.ts') }
    writeFileSync(paths.reference, serializeResult(result('vscode', 'meta.var').complete()))
    writeFileSync(paths.candidate, serializeResult(result('native', 'meta.let').complete()))
    writeFileSync(paths.source, SOURCE)
    return paths
  }

  it('prints agreement and returns 0', () => {
    const { reference, candidate, source } = files()
    const out = sink()
    const err = sink()
    expect(main([reference, candidate, '--source', source], out, err)).toBe(0)
    expect(out.text()).toContain('agreement       30.00% (3/10)')
    expect(out.text()).toContain('non-whitespace  50.00% (3/6)')
    expect(err.text()).toBe('')
  })

  it('writes the JSON report with --json', () => {
    const { reference, candidate } = files()
    const report = join(dir, 'report.json')
    expect(main([reference, candidate, '--json', report, '--runs', '0'], sink(), sink())).toBe(0)
    const written = readFileSync(report, 'utf8')
    expect(written.endsWith('\n')).toBe(true)
    expect(JSON.parse(written)).toMatchObject({
      comparable: true,
      scopes: { agreement: { all: { matching: 3, comparable: 10 } }, mismatches: { count: 1, runs: [] } },
    })
  })

  it('returns 1 with a message for invalid input', () => {
    const { reference } = files()
    const broken = join(dir, 'broken.json')
    writeFileSync(broken, '{"schema": 1}\n')
    const out = sink()
    const err = sink()
    expect(main([reference, broken], out, err)).toBe(1)
    expect(err.text()).toContain('broken.json')
    expect(out.text()).toBe('')
  })

  it('returns 2 on a usage error', () => {
    const err = sink()
    expect(main(['only-one.json'], sink(), err)).toBe(2)
    expect(err.text()).toContain('usage:')
  })
})
