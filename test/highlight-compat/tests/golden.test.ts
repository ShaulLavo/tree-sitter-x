import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResultBuilder } from '../src/build.ts'
import { main } from '../src/cli/golden-update.ts'
import type { GoldenCase, GoldenProducer } from '../src/golden.ts'
import { auditGoldens, checkGolden, describeDifference, goldenPath, unregisteredGoldenDirs, updateGoldens } from '../src/golden.ts'
import type { DocumentResult, ProfileId } from '../src/schema.ts'
import { serializeResult } from '../src/serialize.ts'

const source = 'let x'

function builder(profileId: ProfileId = 'product', text = source) {
  return new ResultBuilder({ profileId, languageId: 'typescript' }, text)
}

const keyword = () => builder().scope(0, 3, ['source.ts', 'storage.type.ts']).scope(3, 5, ['source.ts']).complete()
const plain = () => builder().scope(0, 5, ['source.ts']).complete()
const split = () => builder().scope(0, 2, ['source.ts']).scope(2, 5, ['source.ts']).complete()

function goldenCase(result: DocumentResult, fixtureId = 'basic/let', text = source): GoldenCase {
  return { languageId: 'typescript', fixtureId, source: text, result }
}

function recording(cases: readonly GoldenCase[]) {
  const calls: number[] = []
  const producer: GoldenProducer = () => {
    calls.push(1)
    return cases
  }
  return { producer, calls }
}

let root = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'hc-golden-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function writeGolden(golden: GoldenCase, text: string): string {
  const path = goldenPath(root, golden.result.profileId, golden.languageId, golden.fixtureId)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  return path
}

const messageOf = (check: ReturnType<typeof checkGolden>): string => (check.ok ? '' : check.message)

describe('goldenPath', () => {
  it('nests profile, language and fixture segments', () => {
    expect(goldenPath('/g', 'product', 'typescript', 'basic/let')).toBe('/g/product/typescript/basic/let.json')
  })

  it('rejects fixture ids that could leave the profile directory', () => {
    expect(() => goldenPath('/g', 'product', 'typescript', '../escape')).toThrow(/segment "\.\."/)
    expect(() => goldenPath('/g', 'product', 'typescript', 'a//b')).toThrow(/segment ""/)
  })
})

describe('checkGolden', () => {
  it('reports a missing golden with the update command', () => {
    const message = messageOf(checkGolden(root, 'product', goldenCase(keyword())))
    expect(message).toContain(join(root, 'product/typescript/basic/let.json'))
    expect(message).toContain('npm run golden:update -- --profile product')
  })

  it('accepts a golden that matches byte for byte', () => {
    writeGolden(goldenCase(keyword()), serializeResult(keyword()))
    expect(checkGolden(root, 'product', goldenCase(keyword()))).toEqual({ ok: true })
  })

  it('names the first differing interval with both decoded paths', () => {
    writeGolden(goldenCase(keyword()), serializeResult(keyword()))
    const message = messageOf(checkGolden(root, 'product', goldenCase(plain())))
    expect(message).toContain('scopes [0, 3): expected "source.ts storage.type.ts", actual "source.ts"')
  })

  it('reports a token split that keeps every path as a boundary difference', () => {
    writeGolden(goldenCase(plain()), serializeResult(plain()))
    const message = messageOf(checkGolden(root, 'product', goldenCase(split())))
    expect(message).toContain('scopes: raw token boundary at 2 in actual only')
  })

  it('rejects a golden that parses but is not canonical', () => {
    writeGolden(goldenCase(keyword()), `${JSON.stringify(keyword(), null, 2)}\n`)
    expect(messageOf(checkGolden(root, 'product', goldenCase(keyword())))).toContain('golden is not canonical')
  })

  it('reports validation errors of an invalid golden', () => {
    writeGolden(goldenCase(keyword()), serializeResult(keyword()).replace('"schema": 1', '"schema": 2'))
    expect(messageOf(checkGolden(root, 'product', goldenCase(keyword())))).toContain('schema: expected 1, got 2')
  })

  it('rejects a produced result that does not match the case source', () => {
    writeGolden(goldenCase(keyword()), serializeResult(keyword()))
    const message = messageOf(checkGolden(root, 'product', goldenCase(keyword(), 'basic/let', 'let y')))
    expect(message).toContain('produced invalid result')
    expect(message).toContain('sourceSha256')
  })

  it('never writes a missing or differing golden', () => {
    checkGolden(root, 'product', goldenCase(keyword()))
    expect(existsSync(join(root, 'product'))).toBe(false)
    const text = serializeResult(keyword())
    const path = writeGolden(goldenCase(keyword()), text)
    checkGolden(root, 'product', goldenCase(plain()))
    expect(readFileSync(path, 'utf8')).toBe(text)
  })
})

describe('auditGoldens', () => {
  const committed = () => [goldenCase(keyword()), goldenCase(plain(), 'plain')]
  const seed = async () => void (await updateGoldens(root, 'product', recording(committed()).producer))

  it('accepts a producer that yields exactly the committed cases', async () => {
    await seed()
    expect(await auditGoldens(root, 'product', recording(committed()).producer)).toEqual([])
  })

  it('reports a committed golden the producer no longer yields', async () => {
    await seed()
    const problems = await auditGoldens(root, 'product', recording([goldenCase(keyword())]).producer)
    expect(problems).toEqual([
      `${goldenPath(root, 'product', 'typescript', 'plain')}: committed golden is not produced by the product producer`,
    ])
  })

  it('reports every committed golden when the producer yields nothing', async () => {
    await seed()
    expect(await auditGoldens(root, 'product', recording([]).producer)).toHaveLength(2)
  })

  it('reports a case the producer yields twice', async () => {
    await seed()
    const problems = await auditGoldens(root, 'product', recording([...committed(), goldenCase(keyword())]).producer)
    expect(problems).toEqual([`typescript/basic/let: duplicate case from the product producer`])
  })

  it.each(['product', 'native'] as const)('refuses %s output from the raw producer, even when product goldens match', async (profileId) => {
    await seed()
    const wrong = goldenCase(builder(profileId).scope(0, 3, ['source.ts', 'storage.type.ts']).scope(3, 5, ['source.ts']).complete())
    const problems = await auditGoldens(root, 'raw', recording([wrong]).producer)
    expect(problems).toEqual([`typescript/basic/let: the raw producer returned a ${profileId} result`])
    expect(checkGolden(root, 'raw', wrong)).toEqual({ ok: false, message: `the raw producer returned a ${profileId} result` })
  })
})

describe('describeDifference', () => {
  it('names each differing header field', () => {
    const timeout = builder().incomplete('timeout', 'deadline exceeded')
    const lines = describeDifference(keyword(), timeout)
    expect(lines).toContain('status: expected complete, actual timeout')
    expect(lines).toContain('diagnostics: expected [], actual ["deadline exceeded"]')
  })

  it('names a metadata presence difference and the first differing language', () => {
    const typescript = builder().scope(0, 5, ['source.ts']).language(0, 5, 'typescript').complete()
    const mixed = builder().scope(0, 5, ['source.ts']).language(0, 2, 'typescript').language(2, 5, 'css').complete()
    expect(describeDifference(plain(), typescript)).toEqual(['metadata: expected absent, actual present'])
    expect(describeDifference(typescript, mixed)).toEqual(['metadata [2, 5): expected "typescript", actual "css"'])
  })

  it('names a theme on one side and the first differing style with both styles', () => {
    const light = builder().scope(0, 5, ['source.ts']).style('light', 0, 5, {}).complete()
    const dark = builder().scope(0, 5, ['source.ts']).style('dark', 0, 5, {}).complete()
    expect(describeDifference(light, dark)).toEqual(['styles: theme "dark" in actual only', 'styles: theme "light" in expected only'])
    const reset = builder().scope(0, 5, ['source.ts']).style('dark', 0, 3, {}).style('dark', 3, 5, { fontStyle: 'reset' }).complete()
    expect(describeDifference(dark, reset)).toEqual(['styles.dark [3, 5): expected {}, actual {"fontStyle":"reset"}'])
  })

  it('coalesces adjacent intervals with the same mismatch', () => {
    const expected = builder('product', 'abcdef').scope(0, 6, ['source.ts']).complete()
    const actual = builder('product', 'abcdef').scope(0, 2, ['source.ts', 'a.ts']).scope(2, 4, ['source.ts', 'a.ts']).scope(4, 6, ['source.ts']).complete()
    expect(describeDifference(expected, actual)).toEqual(['scopes [0, 4): expected "source.ts", actual "source.ts a.ts"'])
  })
})

describe('updateGoldens', () => {
  it.each(['native', 'baseline:x', 'Product'])('refuses %s without calling the producer', async (profileId) => {
    const { producer, calls } = recording([goldenCase(keyword())])
    await expect(updateGoldens(root, profileId, producer)).rejects.toThrow(
      `golden update accepts reference profiles only (product, raw, vscode); refusing "${profileId}"`,
    )
    expect(calls).toEqual([])
  })

  it('writes canonical files ending in a newline, then changes nothing on a second run', async () => {
    const cases = [goldenCase(keyword()), goldenCase(plain(), 'plain')]
    const first = await updateGoldens(root, 'product', recording(cases).producer)
    expect(first.written).toHaveLength(2)
    for (const path of first.written) expect(readFileSync(path, 'utf8').endsWith('}\n')).toBe(true)
    const second = await updateGoldens(root, 'product', recording(cases).producer)
    expect(second).toEqual({ written: [], unchanged: first.written, removed: [] })
  })

  it('accepts an unsupported reference result', async () => {
    const unsupported = builder().incomplete('unsupported', 'no grammar for typescript')
    const update = await updateGoldens(root, 'product', recording([goldenCase(unsupported)]).producer)
    expect(update.written).toHaveLength(1)
  })

  it('aborts on a timeout case and writes nothing', async () => {
    const cases = [goldenCase(keyword()), goldenCase(builder().incomplete('timeout', 'deadline exceeded'), 'slow')]
    await expect(updateGoldens(root, 'product', recording(cases).producer)).rejects.toThrow(/typescript\/slow: status timeout is failed reference work/)
    expect(existsSync(join(root, 'product'))).toBe(false)
  })

  it('refuses a result whose profile differs from the requested one', async () => {
    const native = builder('native').scope(0, 5, ['source.ts']).complete()
    await expect(updateGoldens(root, 'product', recording([goldenCase(native)]).producer)).rejects.toThrow(/profileId "native" under --profile product/)
    expect(existsSync(join(root, 'product'))).toBe(false)
  })

  it('refuses a result that does not match its source', async () => {
    await expect(updateGoldens(root, 'product', recording([goldenCase(keyword(), 'basic/let', 'let y')]).producer)).rejects.toThrow(/sourceSha256/)
  })

  it('refuses duplicate cases', async () => {
    const cases = [goldenCase(keyword()), goldenCase(keyword())]
    await expect(updateGoldens(root, 'product', recording(cases).producer)).rejects.toThrow(/duplicate case/)
  })

  it('removes stale goldens and prunes the directories they leave empty', async () => {
    await updateGoldens(root, 'product', recording([goldenCase(keyword()), goldenCase(plain(), 'old/plain')]).producer)
    const update = await updateGoldens(root, 'product', recording([goldenCase(keyword())]).producer)
    const stale = join(root, 'product/typescript/old/plain.json')
    expect(update.removed).toEqual([stale])
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(join(root, 'product/typescript/old'))).toBe(false)
    expect(existsSync(join(root, 'product/typescript/basic/let.json'))).toBe(true)
  })

  it('accepts async producers', async () => {
    const producer: GoldenProducer = async function* () {
      yield goldenCase(keyword())
    }
    expect((await updateGoldens(root, 'product', producer)).written).toHaveLength(1)
  })
})

describe('unregisteredGoldenDirs', () => {
  it('lists directories that are not reference profiles with a producer', () => {
    for (const name of ['native', 'product', 'raw', 'vscode']) mkdirSync(join(root, name))
    const producer: GoldenProducer = () => []
    expect(unregisteredGoldenDirs(root, { product: producer, raw: producer })).toEqual(['native', 'vscode'])
    expect(unregisteredGoldenDirs(join(root, 'absent'), {})).toEqual([])
  })
})

describe('golden:update CLI', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it.each([[[]], [['--profile']], [['product']], [['--profile', 'product', '--force']], [['--profile', 'product', 'extra']]])('returns 2 with usage for %j', async (argv) => {
    const { producer, calls } = recording([goldenCase(keyword())])
    expect(await main([...argv, '--root', root], { product: producer })).toBe(2)
    expect(calls).toEqual([])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('usage:'))
  })

  it('returns 2 for a candidate profile without calling a producer', async () => {
    const { producer, calls } = recording([goldenCase(keyword())])
    expect(await main(['--profile=native', '--root', root], { product: producer })).toBe(2)
    expect(calls).toEqual([])
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('refusing "native"'))
  })

  it('returns 2 when no producer is registered', async () => {
    expect(await main(['--profile', 'raw', '--root', root], {})).toBe(2)
    expect(console.error).toHaveBeenCalledWith('no golden producer registered for profile "raw"')
  })

  it('returns 0 and writes under --root on success', async () => {
    expect(await main(['--profile', 'product', `--root=${root}`], { product: recording([goldenCase(keyword())]).producer })).toBe(0)
    expect(existsSync(join(root, 'product/typescript/basic/let.json'))).toBe(true)
  })

  it('returns 1 when the update fails', async () => {
    const timeout = goldenCase(builder().incomplete('timeout', 'deadline exceeded'))
    expect(await main(['--profile', 'product', '--root', root], { product: recording([timeout]).producer })).toBe(1)
  })
})
