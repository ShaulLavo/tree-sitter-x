import { describe, expect, it } from 'vitest'
import { documentOracle } from '../src/oracles/oracles.ts'
import { ORACLE_PROFILES, type OracleProfileId } from '../src/oracles/request.ts'
import { runDocument } from '../src/oracles/run.ts'
import { parseResult } from '../src/validate.ts'

const request = (profileId: OracleProfileId, source: string, languageId = 'json') => ({
  kind: 'document' as const, profileId, source, languageId, themeIds: ['github-dark'],
  metadata: 'required-language-v1' as const,
})

describe.each(ORACLE_PROFILES)('%s required reference metadata', (profileId) => {
  it('measures the actual root allocation over a whole-source JSON control', async () => {
    const input = request(profileId, '{"astral":"🌿"}')
    const result = parseResult(await documentOracle(input), input.source)
    expect(result.status).toBe('complete')
    if (result.status !== 'complete') throw new Error(result.diagnostics.join('\n'))
    expect(result.metadata).toEqual({ languageIds: ['json'], spans: [0, input.source.length, 0] })
    expect(result.engine['referenceMetadata']).toBe('required-language-v1')
  })

  it('preserves every default field and the scope/style snapshot around an opted-in call', async () => {
    const { metadata: _mode, ...input } = request(profileId, '{"astral":"🌿"}')
    const baseline = await documentOracle(input)
    const measured = await documentOracle({ ...input, metadata: 'required-language-v1', themeIds: ['github-dark', 'vesper'] })
    expect(await documentOracle(input)).toEqual(baseline)
    expect('metadata' in baseline).toBe(false)
    if (baseline.status !== 'complete' || measured.status !== 'complete') throw new Error('missing complete JSON control')
    expect(measured.scopeNames).toEqual(baseline.scopeNames)
    expect(measured.paths).toEqual(baseline.paths)
    expect(measured.spans).toEqual(baseline.spans)
    expect(measured.styles?.['github-dark']).toEqual(baseline.styles?.['github-dark'])
    expect(measured.metadata).toEqual({ languageIds: ['json'], spans: [0, input.source.length, 0] })
  })

  it('admits empty lifecycle input without inventing a language span', async () => {
    const result = await runDocument(request(profileId, ''))
    expect(result.status).toBe('complete')
    expect('metadata' in result).toBe(false)
  })

  it.each(['\n', '\r\n'])('does not assign a language to a real %j separator', async (separator) => {
    const input = request(profileId, `{}${separator}{}`)
    const result = await documentOracle(input)
    expect(result.status).toBe('unsupported')
    expect(result.spans).toEqual([])
    expect(result.diagnostics.join('\n')).toContain(`[2, ${2 + separator.length})`)
    expect(result.diagnostics.join('\n')).toContain('separator')
  })

  it.each(['javascript', 'jsx'])('does not turn native root allocation into independent %s child identity', async (language) => {
    const result = await documentOracle(request(profileId, 'const x = /a/;', language))
    expect(result.status).toBe('unsupported')
    expect(result.diagnostics.join('\n')).toContain('independent')
    expect(result.diagnostics.join('\n')).toContain('[0, 14)')
  })
})

describe('mandatory worker admission', () => {
  const workerUrl = new URL('./fixtures/metadata-worker.ts', import.meta.url)

  it('rejects a schema-valid complete scope-only answer when metadata is required', async () => {
    const result = await runDocument(request('raw', 'missing'), { workerUrl })
    expect(result.status).toBe('unsupported')
    expect(result.diagnostics.join('\n')).toContain('metadata')
  })

  it.each(['source', 'profile', 'language', 'partial'])('rejects wrong %s before admitting required metadata', async (fault) => {
    const result = await runDocument(request('raw', fault), { workerUrl })
    expect(result.status).toBe('error')
    expect(result.spans).toEqual([])
  })

  it.each(['wrong-codebook', 'wrong-ids'])('rejects claimed metadata with %s', async (fault) => {
    const result = await runDocument(request('raw', fault), { workerUrl })
    expect(result.status).toBe('unsupported')
    expect(result.spans).toEqual([])
  })

  it.each(['timeout', 'error', 'canceled', 'unsupported'])('keeps the actual %s outcome non-passing', async (fault) => {
    const result = await runDocument(request('raw', fault), { workerUrl })
    expect(result.status).toBe(fault)
    expect(result.diagnostics).toEqual(['original outcome'])
  })

  it('keeps the real process deadline non-passing under the opt-in', async () => {
    const result = await runDocument(request('raw', '{}'), { deadlineMs: 1 })
    expect(result.status).toBe('timeout')
    expect(result.spans).toEqual([])
  })

  it.each([undefined, null, false, {}, 'optional', 1])('rejects malformed metadata option %j at the boundary', async (metadata) => {
    const input = { ...request('raw', '{}'), metadata }
    // Exercise the untyped request boundary deliberately.
    // @ts-expect-error malformed external option
    await expect(documentOracle(input)).rejects.toThrow('metadata')
  })

  it('rejects an unknown option before dispatch and preserves default requests', async () => {
    const input = { ...request('raw', '{}'), metaData: 'required-language-v1' }
    await expect(documentOracle(input)).rejects.toThrow('unknown request option')
    const result = await runDocument(input)
    expect(result.status).toBe('error')
  })
})
