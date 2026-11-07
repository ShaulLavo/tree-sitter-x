import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'
import { ResultBuilder } from '../src/build.ts'
import { serializeResult } from '../src/serialize.ts'
import { hash, loadReference, referenceIndex, safeFile, WAVE_LIMIT, validateDocumentIdentity } from '../src/wave-collection.ts'
import { PINS, pinLabel } from '../src/oracles/pins.ts'
import type { ScopeRequest, WaveInput } from '../src/fixtures/js-jsx-wave.ts'
import type { DocumentResult } from '../src/schema.ts'

const owned: string[] = []
afterEach(() => { for (const path of owned.splice(0)) rmSync(path, { recursive: true, force: true }) })
function directory(): string { const root = mkdtempSync(resolve(tmpdir(), 'wave010-reference-')); owned.push(root); mkdirSync(resolve(root, 'documents')); return root }
const source = 'x'
const row: ScopeRequest = { key: JSON.stringify(['javascript', 'tiny', 'raw', 'fresh-full']), fixture: 'tiny', language: 'javascript', profile: 'raw', split: 'development', state: 'fresh-full', utf16Units: 1 }
const input: WaveInput = { id: 'tiny', languageId: 'javascript', split: 'development', path: 'tiny', sha256: hash(source), utf16Units: 1, storage: 'wave-packet', derivationFamilies: [] }
const engine = { grammars: pinLabel(PINS.langs), themes: pinLabel(PINS.themes), textmate: pinLabel(PINS.vscodeTextmate), textmateCommit: PINS.vscodeTextmate.commit,
  oniguruma: pinLabel(PINS.vscodeOniguruma), onigurumaCommit: PINS.vscodeOniguruma.commit, onigurumaWasmSha256: PINS.vscodeOniguruma.wasmSha256 }
const entry = { fixtureId: input.id, languageId: row.language, profileId: row.profile, sourceSha256: input.sha256, sourceLength: 1, documentRevision: 0, document: 'documents/tiny.json.gz' }
function document(): DocumentResult { return new ResultBuilder({ profileId: 'raw', languageId: 'javascript', engine }, source).scope(0, 1, ['source.js']).style('constructor', 0, 1, {}).complete() }
function load(value: unknown, changedEntry: Record<string, unknown> = entry) {
  const root = directory()
  writeFileSync(resolve(root, entry.document), gzipSync(JSON.stringify(value)))
  return loadReference(root, changedEntry, row, input, source, ['constructor'])
}
describe('strict retained reference loader', () => {
  it('validates actual schema documents, not index success flags', () => {
    expect(load(document()).kind).toBe('valid')
    const result = new ResultBuilder({ profileId: 'raw', languageId: 'javascript' }, source).incomplete('timeout', 'retained timeout')
    const loaded = load(result)
    expect(loaded.kind === 'valid' && loaded.result.status).toBe('timeout')
  })
  it.each([
    { sourceSha256: '0'.repeat(64) }, { sourceLength: 2 }, { documentRevision: 1 }, { languageId: 'jsx' }, { profileId: 'product' },
    { spans: [0, 2, 0] }, { paths: [[99]] }, { styles: {} }, { metadata: { languageIds: ['javascript'], spans: [0, 1, 0] } }, { engine: {} },
  ])('rejects changed identity/schema/track %j', mutation => { expect(load({ ...document(), ...mutation }).kind).toBe('invalid') })
  it('rejects digest drift, traversal, absolute paths, and symlinks', () => {
    expect(load(document(), { ...entry, documentSha256: '0'.repeat(64) }).kind).toBe('invalid')
    expect(load(document(), { ...entry, document: '../tiny.gz' }).kind).toBe('invalid')
    expect(load(document(), { ...entry, document: '/tmp/tiny.gz' }).kind).toBe('invalid')
    expect(loadReference(directory(), { ...entry, documentSha256: '0'.repeat(64) }, row, input, source, ['constructor']).kind).toBe('missing')
    const root = directory(), other = directory()
    writeFileSync(resolve(other, 'source.gz'), gzipSync(serializeResult(document())))
    symlinkSync(resolve(other, 'source.gz'), resolve(root, 'documents/link.gz'))
    expect(loadReference(root, { ...entry, document: 'documents/link.gz' }, row, input, source, ['constructor']).kind).toBe('invalid')
    expect(() => safeFile(root, 'documents/./file')).toThrow()
  })
  it('bounds gzip expansion at 64 MiB and preserves missing truth', () => {
    const root = directory()
    expect(loadReference(root, entry, row, input, source, ['constructor']).kind).toBe('missing')
    writeFileSync(resolve(root, entry.document), gzipSync(Buffer.alloc(WAVE_LIMIT + 1, 32)))
    expect(loadReference(root, entry, row, input, source, ['constructor']).kind).toBe('invalid')
  })
  it.each(['duplicate-key', 'duplicate-document', 'extra-row', 'wrong-hash', 'wrong-length', 'wrong-revision'])('rejects %s index control', kind => {
    const root = directory()
    let entries: unknown[] = [entry]
    if (kind === 'duplicate-key') entries = entries.concat([entry])
    if (kind === 'duplicate-document') entries = entries.concat([{ ...entry, profileId: 'product' }])
    if (kind === 'extra-row') entries = entries.concat([{ ...entry, fixtureId: 'unknown' }])
    if (kind === 'wrong-hash') entries = [{ ...entry, sourceSha256: 'bad' }]
    if (kind === 'wrong-length') entries = [{ ...entry, sourceLength: 2 }]
    if (kind === 'wrong-revision') entries = [{ ...entry, documentRevision: 1 }]
    writeFileSync(resolve(root, 'scope-rows.json'), JSON.stringify(entries))
    expect(() => referenceIndex(root, [row, { ...row, profile: 'product', key: JSON.stringify(['javascript', 'tiny', 'product', 'fresh-full']) }], [input])).toThrow()
  })
  it('never admits wrong candidate identities simply because two documents agree', () => {
    expect(() => validateDocumentIdentity(document(), row, input, true)).toThrow()
  })
})
