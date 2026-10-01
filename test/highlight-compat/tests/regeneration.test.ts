import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { artifactHash } from '../src/artifacts.ts'
import { publishArtifacts, regenerationRuns } from '../src/regeneration.ts'
import { compareResults } from '../src/compare.ts'
import { runDocument } from '../src/oracles/run.ts'
import { serializeResult } from '../src/serialize.ts'
import { parseResult } from '../src/validate.ts'

it.each(['missing', 'stale'] as const)('runs mandatory checks against fresh reference/theme bytes when committed goldens are %s', async state => {
  const scratch = mkdtempSync(join(tmpdir(), 'highlight-compat-regeneration-'))
  const committed = join(scratch, 'committed')
  try {
    mkdirSync(committed)
    if (state === 'stale') writeFileSync(join(committed, 'old.json'), 'old reference/theme')
    const original = artifactHash(committed)
    let checks = 0
    const runs = await regenerationRuns(join(scratch, 'runs'), {
      async generate(root) {
        mkdirSync(join(root, 'goldens'), { recursive: true })
        writeFileSync(join(root, 'goldens', 'fresh.json'), 'current reference/theme')
      },
      selfTests(root) {
        checks++
        expect(readFileSync(join(root, 'fresh.json'), 'utf8')).toBe('current reference/theme')
        expect(existsSync(join(root, 'old.json'))).toBe(false)
        return [{ path: 'reference/theme', passed: 1, total: 1 }]
      },
    })
    expect(checks).toBe(1)
    expect(runs.firstHash).toBe(runs.secondHash)
    expect(artifactHash(committed)).toBe(original)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

it('regenerates current reference styles after a theme change', async () => {
  const scratch = mkdtempSync(join(tmpdir(), 'highlight-compat-theme-update-'))
  const source = '1'
  try {
    const request = { kind: 'document', profileId: 'raw', languageId: 'json', source, themeIds: ['github-dark'] } as const
    const reference = await runDocument(request)
    if (reference.status !== 'complete') throw new Error('incomplete reference')
    const theme = reference.styles?.['github-dark']
    if (theme === undefined) throw new Error('missing reference theme')
    const stale = { ...reference, styles: { 'github-dark': { ...theme, styles: theme.styles.map(style => ({ ...style, foreground: '#000000' })) } } }
    const old = join(scratch, 'committed')
    mkdirSync(old)
    writeFileSync(join(old, 'reference.json'), JSON.stringify(stale))
    const original = artifactHash(old)
    const before = compareResults(reference, parseResult(stale, source), { source })
    expect(before.comparable && before.styles['github-dark']?.compared && before.styles['github-dark'].report.mismatches.units).toBe(1)
    const runs = await regenerationRuns(join(scratch, 'runs'), {
      async generate(root) {
        mkdirSync(join(root, 'goldens'), { recursive: true })
        writeFileSync(join(root, 'goldens', 'reference.json'), serializeResult(await runDocument(request)))
      },
      selfTests(root) {
        const fresh = parseResult(JSON.parse(readFileSync(join(root, 'reference.json'), 'utf8')), source)
        const after = compareResults(reference, fresh, { source })
        expect(after.comparable && after.styles['github-dark']?.compared && after.styles['github-dark'].report.mismatches.units).toBe(0)
        return [{ path: 'current-reference-theme', passed: 1, total: 1 }]
      },
    })
    expect(runs.firstHash).toBe(runs.secondHash)
    expect(artifactHash(old)).toBe(original)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

it.each(['copy-first', 'copy-second', 'retire-first', 'retire-second', 'install-first', 'install-second'] as const)('preserves both old directories byte-exactly when publication fails at %s', failure => {
  const scratch = mkdtempSync(join(tmpdir(), 'highlight-compat-publication-'))
  const generated = join(scratch, 'generated'), committed = join(scratch, 'committed')
  try {
    for (const directory of ['goldens', 'reports']) {
      mkdirSync(join(generated, directory), { recursive: true })
      mkdirSync(join(committed, directory), { recursive: true })
      writeFileSync(join(generated, directory, 'new.txt'), `new ${directory}`)
      writeFileSync(join(committed, directory, 'old.txt'), `old ${directory}`)
    }
    const original = artifactHash(committed)
    let copies = 0, renames = 0, injected = false
    expect(() => publishArtifacts(generated, committed, {
      copy(source, destination, options) {
        copies++
        cpSync(source, destination, options)
        if (failure === `copy-${copies === 1 ? 'first' : 'second'}`) {
          injected = true
          throw new Error('injected copy failure')
        }
      },
      rename(source, destination) {
        renames++
        const position = ['retire-first', 'retire-second', 'install-first', 'install-second'][renames - 1]
        if (failure === position) {
          injected = true
          throw new Error('injected rename failure')
        }
        renameSync(source, destination)
      },
    })).toThrow(/injected (copy|rename) failure/)
    expect(injected).toBe(true)
    expect(artifactHash(committed)).toBe(original)
    expect(readdirSync(committed).sort()).toEqual(['goldens', 'reports'])
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

it('publishes a complete generation when old directories are absent or present', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'highlight-compat-publication-success-'))
  const generated = join(scratch, 'generated'), committed = join(scratch, 'committed')
  try {
    mkdirSync(committed)
    writeFileSync(join(committed, 'unrelated.txt'), 'preserve me')
    for (const directory of ['goldens', 'reports']) {
      mkdirSync(join(generated, directory), { recursive: true })
      writeFileSync(join(generated, directory, 'new.txt'), `new ${directory}`)
    }
    publishArtifacts(generated, committed)
    for (const directory of ['goldens', 'reports']) {
      expect(artifactHash(join(committed, directory))).toBe(artifactHash(join(generated, directory)))
      writeFileSync(join(committed, directory, 'stale.txt'), 'remove me')
    }
    publishArtifacts(generated, committed)
    for (const directory of ['goldens', 'reports']) expect(artifactHash(join(committed, directory))).toBe(artifactHash(join(generated, directory)))
    expect(readdirSync(committed).sort()).toEqual(['goldens', 'reports', 'unrelated.txt'])
    expect(readFileSync(join(committed, 'unrelated.txt'), 'utf8')).toBe('preserve me')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})
