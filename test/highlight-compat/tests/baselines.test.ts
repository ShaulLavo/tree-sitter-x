import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { captureIntervals, composeCaptures } from '../src/baselines/compose.ts'
import { queryPatterns, requireSupportedOperators } from '../src/baselines/query.ts'
import { captureScopes, CAPTURE_MAP, CAPTURE_MAP_VERSION } from '../src/baselines/capture-map.ts'
import { checkAssets, sha256, VENDOR_ROOT } from '../src/baselines/assets.ts'
import { baselineDocument } from '../src/baselines/run.ts'

const capture = (from: number, to: number, name: string, pattern: number, ordinal = 0) => ({ from, to, name, pattern, ordinal })

describe('candidate baseline contracts', () => {
  it('maps named captures explicitly and rejects an unknown one', () => {
    expect(CAPTURE_MAP_VERSION).toBe('capture-map-1')
    expect(sha256(JSON.stringify(CAPTURE_MAP))).toBe('89aa304a4e82974961a24a70ddc902d1faad6657616ad6dd1d790bd489b7831a')
    expect(captureScopes('keyword')).toEqual(['keyword.control'])
    expect(captureScopes('string')).toEqual(['string.quoted'])
    expect(captureScopes('embedded')).toEqual([])
    expect(() => captureScopes('new-capture')).toThrow('unmapped capture')
  })

  it('composes nesting, crossing and coincident captures with stable query-order ties', () => {
    const captures = [capture(1, 5, 'inner', 3), capture(0, 4, 'outer', 0), capture(1, 5, 'same', 2)]
    const expected = [
      { from: 0, to: 1, scopes: ['root', 'outer'] },
      { from: 1, to: 4, scopes: ['root', 'outer', 'same', 'inner'] },
      { from: 4, to: 5, scopes: ['root', 'same', 'inner'] },
      { from: 5, to: 6, scopes: ['root'] },
    ]
    expect(composeCaptures('abcdef', 'root', captures, name => [name])).toEqual(expected)
    expect(composeCaptures('abcdef', 'root', captures.toReversed(), name => [name])).toEqual(expected)
    expect(composeCaptures('abcd', 'root', [capture(0, 2, 'leaf', 0), capture(0, 4, 'wrapper', 1)], name => [name])).toEqual([
      { from: 0, to: 2, scopes: ['root', 'wrapper', 'leaf'] }, { from: 2, to: 4, scopes: ['root', 'wrapper'] },
    ])
    const duplicate = capture(0, 1, 'same', 0)
    expect(composeCaptures('x', 'root', [duplicate, duplicate], name => [name])).toEqual([
      { from: 0, to: 1, scopes: ['root', 'same', 'same'] },
    ])
  })

  it('derives capture ties from query declaration order, independent of match enumeration', () => {
    const captures = [
      { node: { startIndex: 0, endIndex: 1 }, name: 'first', patternIndex: 0 },
      { node: { startIndex: 0, endIndex: 1 }, name: 'second', patternIndex: 0 },
    ]
    const names = ['second', 'first']
    const compose = (values: typeof captures) => composeCaptures('x', 'root', captureIntervals(values, names), name => [name])
    expect(compose(captures)).toEqual([{ from: 0, to: 1, scopes: ['root', 'second', 'first'] }])
    expect(compose(captures.toReversed())).toEqual(compose(captures))
    expect(() => captureIntervals(captures, ['first'])).toThrow('undeclared query capture second')
  })

  it('uses code-point name ordering when all capture-position ties coincide', () => {
    const captures = [capture(0, 1, 'a', 0), capture(0, 1, 'Z', 0)]
    expect(composeCaptures('x', 'root', captures, name => [name])).toEqual([
      { from: 0, to: 1, scopes: ['root', 'Z', 'a'] },
    ])
  })

  it('keeps CRLF and LF terminators empty while lone CR remains text', () => {
    expect(composeCaptures('a\r\nb\nc\r', 'root', [capture(0, 8, 'all', 0)], name => [name])).toEqual([
      { from: 0, to: 1, scopes: ['root', 'all'] }, { from: 1, to: 3, scopes: [] },
      { from: 3, to: 4, scopes: ['root', 'all'] }, { from: 4, to: 5, scopes: [] },
      { from: 5, to: 7, scopes: ['root', 'all'] },
    ])
    expect(composeCaptures('', 'root', [], name => [name])).toEqual([])
  })

  it('splits patterns without reading comments or quoted delimiters as syntax', () => {
    const patterns = queryPatterns('; (ignored)\n(identifier) @a\n((string) @b (#match? @b "[()#fake?]"))\n["[" "]"] @c')
    expect(patterns).toHaveLength(3)
    expect(patterns[1]?.operators).toEqual(['match?'])
    expect(patterns[2]?.operators).toEqual([])
    expect(() => queryPatterns('(identifier')).toThrow('unbalanced')
    expect(() => requireSupportedOperators(['mystery!'])).toThrow('unsupported query operation')
  })

  it('validates every vendored parser and query against its pinned manifest identity', () => {
    expect(checkAssets()).toEqual([])
  })

  it('rejects mutated parser, query and manifest association bytes', () => {
    const root = mkdtempSync(join(tmpdir(), 'highlight-compat-vendor-test-'))
    try {
      cpSync(VENDOR_ROOT, root, { recursive: true })
      const url = pathToFileURL(root + '/')
      expect(checkAssets(url)).toEqual([])
      const wasm = join(root, 'tree-sitter-typescript/tree-sitter-typescript.wasm')
      const bytes = readFileSync(wasm)
      bytes[0] ^= 1
      writeFileSync(wasm, bytes)
      expect(checkAssets(url)).toContain('tree-sitter-typescript/tree-sitter-typescript.wasm: vendored bytes differ from pinned hash')
      writeFileSync(join(root, 'vscode-typescript.scm'), '; mutated query\n')
      expect(checkAssets(url)).toContain('vscode-typescript.scm: vendored bytes differ from pinned hash')
      const assetsPath = join(root, 'assets.json')
      writeFileSync(assetsPath, readFileSync(assetsPath, 'utf8').replace('"languageId": "typescript"', '"languageId": "json"'))
      expect(checkAssets(url).some(message => message.includes('vendor identity differs'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  for (const profileId of ['baseline:captures', 'baseline:vscode-ts'] as const) {
    for (const languageId of ['typescript', 'tsx']) {
      it(`${profileId} executes ${languageId} with predicates and checkout-built binding`, async () => {
        const result = await baselineDocument(profileId, languageId, 'const value = "hi";\n', 'raw')
        expect(result.status).toBe('complete')
        expect(result.engine.binding).toBe('checkout lib/binding_web')
        expect(result.scopeNames).toContain('string.quoted' + (profileId === 'baseline:vscode-ts' ? '.double.ts' : ''))
      })
    }
  }
})
