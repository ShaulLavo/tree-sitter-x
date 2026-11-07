import { nativeThemeDigest } from './native-theme-inputs.ts'

export type NativeThemeDiagnosticLocation =
  | { readonly kind: 'resource'; readonly resource: string; readonly jsonPointer: string; readonly byteOffset: number | null }
  | { readonly kind: 'setting'; readonly resource: string; readonly rule: number; readonly alternative: number | null; readonly property: string }
  | { readonly kind: 'request' }

export interface NativeThemeDiagnosticCase {
  readonly id: string
  readonly operation: 'snapshotInput' | 'normalizeTheme' | 'compileTheme' | 'resolvePaths'
  readonly request: Readonly<Record<string, unknown>>
  readonly expected: { readonly kind: 'invalid' | 'unsupported'; readonly code: string; readonly location: NativeThemeDiagnosticLocation }
    | { readonly kind: 'budget'; readonly code: string; readonly limit: number; readonly location: NativeThemeDiagnosticLocation }
    | { readonly kind: 'ok'; readonly styleCount?: number }
}

const ROOT = 'fixture:/rejected'
const RESOURCE = { kind: 'resource', resource: ROOT, jsonPointer: '', byteOffset: null } as const
const REQUEST = { kind: 'request' } as const
const SETTING = { kind: 'setting', resource: ROOT, rule: 0, alternative: 0 } as const
const EMPTY = '{"name":"rejected","type":"dark"}'

function input(bytes: string, format = 'json'): Record<string, unknown> {
  return { root: ROOT, resources: [{ id: ROOT, format, bytes }], edges: [] }
}

function syntax(id: string, scope: unknown, settings: unknown, kind: 'invalid' | 'unsupported', code: string, property: string): NativeThemeDiagnosticCase {
  const bytes = JSON.stringify({ name: 'rejected', type: 'dark', tokenColors: [{ scope, settings }] })
  return { id, operation: 'normalizeTheme', request: { input: input(bytes), profile: 'raw' },
    expected: { kind, code, location: { ...SETTING, property } } }
}

function budget(id: string, operation: NativeThemeDiagnosticCase['operation'], request: Record<string, unknown>, code: string, limit: number): NativeThemeDiagnosticCase {
  return { id, operation, request, expected: { kind: 'budget', code, limit, location: REQUEST } }
}

export function nativeThemeDiagnosticFixtures() {
  const cases: NativeThemeDiagnosticCase[] = [
    { id: 'malformed-json', operation: 'snapshotInput', request: { input: input('{') }, expected: { kind: 'invalid', code: 'json', location: RESOURCE } },
    { id: 'null-document', operation: 'snapshotInput', request: { input: input('null') }, expected: { kind: 'invalid', code: 'schema', location: RESOURCE } },
    { id: 'jsonc', operation: 'snapshotInput', request: { input: input(EMPTY, 'jsonc') }, expected: { kind: 'unsupported', code: 'input-format', location: RESOURCE } },
    { id: 'plist', operation: 'snapshotInput', request: { input: input('<plist/>', 'plist') }, expected: { kind: 'unsupported', code: 'input-format', location: RESOURCE } },
    { id: 'profile', operation: 'normalizeTheme', request: { input: input(EMPTY), profile: 'unknown' }, expected: { kind: 'unsupported', code: 'profile', location: REQUEST } },
    syntax('null-color', 'variable', { foreground: null }, 'invalid', 'schema', 'foreground'),
    syntax('numeric-color', 'variable', { background: 3 }, 'invalid', 'schema', 'background'),
    syntax('empty-color', 'variable', { foreground: '' }, 'invalid', 'color', 'foreground'),
    syntax('bad-hex', 'variable', { foreground: '#12gg' }, 'invalid', 'color', 'foreground'),
    syntax('bad-hex-length', 'variable', { foreground: '#12345' }, 'invalid', 'color', 'foreground'),
    syntax('named-color', 'variable', { foreground: 'red' }, 'unsupported', 'color-format', 'foreground'),
    syntax('variable-color', 'variable', { background: 'var(--syntax)' }, 'unsupported', 'color-format', 'background'),
    syntax('null-font', 'variable', { fontStyle: null }, 'invalid', 'schema', 'fontStyle'),
    syntax('numeric-font', 'variable', { fontStyle: 1 }, 'invalid', 'schema', 'fontStyle'),
    syntax('blank-font', 'variable', { fontStyle: ' ' }, 'invalid', 'font-style', 'fontStyle'),
    syntax('unknown-font', 'variable', { fontStyle: 'oblique' }, 'unsupported', 'font-style', 'fontStyle'),
    syntax('font-family', 'variable', { fontFamily: 'serif' }, 'unsupported', 'syntax-property', 'fontFamily'),
    syntax('font-size', 'variable', { fontSize: '12px' }, 'unsupported', 'syntax-property', 'fontSize'),
    syntax('line-height', 'variable', { lineHeight: '20px' }, 'unsupported', 'syntax-property', 'lineHeight'),
    syntax('unknown-property', 'variable', { unknown: 'x' }, 'unsupported', 'syntax-property', 'unknown'),
  ]
  const unsupported = ['*', 'a - b', 'a | b', 'a & b', '(a)', 'L:a', 'R:a', '/a/']
  const invalid = ['a,', ',a', 'a,,b', 'a  b', 'a\tb', 'a\nb', '> a', 'a >', 'a > > b', 'a>b', '-', 'a..b']
  cases.push(...unsupported.map((scope, index) => syntax(`operator-${index}`, scope, { foreground: '#123456' }, 'unsupported', 'selector', 'scope')))
  cases.push(...invalid.map((scope, index) => syntax(`selector-structure-${index}`, scope, { foreground: '#123456' }, 'invalid', 'selector', 'scope')))
  cases.push(syntax('empty-array', [], {}, 'invalid', 'selector', 'scope'), syntax('empty-array-member', [''], {}, 'invalid', 'selector', 'scope'),
    syntax('array-comma', ['a,b'], {}, 'invalid', 'selector', 'scope'), syntax('null-scope', null, {}, 'invalid', 'schema', 'scope'))
  cases.push(...['hasOwnProperty', '__proto__', 'scope.hasOwnProperty.leaf', 'scope.__proto__.leaf'].map((scope, index) =>
    syntax(`reserved-tail-${index}`, scope, { foreground: '#123456' }, 'unsupported', 'trie-tail-atom', 'scope')))
  const includeBytes = '{"name":"rejected","type":"dark","include":"base.json"}'
  const includeLocation = { ...RESOURCE, jsonPointer: '/include' }
  cases.push(
    { id: 'include-missing', operation: 'snapshotInput', request: { input: input(includeBytes) }, expected: { kind: 'invalid', code: 'include-graph', location: includeLocation } },
    { id: 'include-self-cycle', operation: 'snapshotInput', request: { input: { ...input(includeBytes), edges: [{ from: ROOT, to: ROOT, ordinal: 0 }] } }, expected: { kind: 'invalid', code: 'include-graph', location: includeLocation } },
    { id: 'include-unauthorized', operation: 'snapshotInput', request: { input: { ...input(EMPTY), edges: [{ from: ROOT, to: 'fixture:/unauthorized', ordinal: 0 }] } }, expected: { kind: 'invalid', code: 'include-authority', location: includeLocation } },
    { id: 'include-duplicate-edge', operation: 'snapshotInput', request: { input: { ...input(includeBytes), edges: [{ from: ROOT, to: ROOT, ordinal: 0 }, { from: ROOT, to: ROOT, ordinal: 1 }] } }, expected: { kind: 'invalid', code: 'include-graph', location: includeLocation } },
  )
  for (const role of ['foreground', 'background']) cases.push({ id: `raw-palette-${role}-first-rejection`, operation: 'normalizeTheme',
    request: { inputFile: `themes/palette-${role}-254.json`, profile: 'raw' }, expected: { kind: 'unsupported', code: 'raw-palette', location: RESOURCE } })
  cases.push(
    budget('resources-zero', 'snapshotInput', { input: input(EMPTY), limits: { resources: 0 } }, 'resources', 0),
    budget('input-bytes-zero', 'snapshotInput', { input: input(EMPTY), limits: { inputBytes: 0 } }, 'input-bytes', 0),
    budget('compile-steps-zero', 'compileTheme', { fixture: 'empty-dark/raw', limits: { steps: 0 } }, 'compile-steps', 0),
    budget('compile-trie-nodes-zero', 'compileTheme', { fixture: 'inheritance/raw', limits: { trieNodes: 0 } }, 'trie-nodes', 0),
    budget('compile-context-rules-zero', 'compileTheme', { fixture: 'contexts/raw', limits: { contextRules: 0 } }, 'context-rules', 0),
    budget('compile-owned-bytes-zero', 'compileTheme', { fixture: 'empty-dark/raw', limits: { ownedBytes: 0 } }, 'owned-bytes', 0),
    budget('resolve-steps-zero', 'resolvePaths', { fixture: 'inheritance/raw', paths: [[]], limits: { steps: 0 } }, 'resolve-steps', 0),
    budget('output-bytes-zero', 'resolvePaths', { fixture: 'inheritance/raw', paths: [[]], limits: { outputBytes: 0 } }, 'output-bytes', 0),
    budget('output-first-rejection', 'resolvePaths', { fixture: 'inheritance/raw', paths: [[]], limits: { outputBytes: 11 } }, 'output-bytes', 11),
    { id: 'empty-zero-resolve', operation: 'resolvePaths', request: { fixture: 'inheritance/raw', paths: [], limits: { steps: 0, outputBytes: 0 } }, expected: { kind: 'ok', styleCount: 0 } },
    { id: 'output-exact-limit', operation: 'resolvePaths', request: { fixture: 'inheritance/raw', paths: [[]], limits: { outputBytes: 12 } }, expected: { kind: 'ok', styleCount: 1 } },
  )
  const oneRule = JSON.stringify({ name: 'rejected', type: 'dark', tokenColors: [{ scope: 'a b', settings: { foreground: '#123456' } }] })
  const inputCaps = [
    ['rules', 'rules'], ['atoms', 'atoms'], ['contextEdges', 'context-edges'],
    ['atomBytes', 'atom-bytes'], ['contextAtomsPerSelector', 'context-atoms'], ['packetBytes', 'packet-bytes'],
  ] as const
  for (const [field, code] of inputCaps) cases.push(budget(`input-${code}-zero`, 'normalizeTheme', { input: input(oneRule), profile: 'raw', limits: { [field]: 0 } }, code, 0))
  cases.push(budget('resource-id-bytes-zero', 'snapshotInput', { input: input(EMPTY), limits: { resourceIdBytes: 0 } }, 'resource-id-bytes', 0),
    budget('paths-zero', 'resolvePaths', { fixture: 'inheritance/raw', paths: [[]], inputLimits: { paths: 0 } }, 'paths', 0),
    budget('input-bytes-first-over', 'snapshotInput', { input: input(EMPTY), limits: { inputBytes: Buffer.byteLength(EMPTY) - 1 } }, 'input-bytes', Buffer.byteLength(EMPTY) - 1),
    { id: 'input-bytes-exact-limit', operation: 'snapshotInput', request: { input: input(EMPTY), limits: { inputBytes: Buffer.byteLength(EMPTY) } }, expected: { kind: 'ok' } })
  const included = { root: ROOT, resources: [{ id: ROOT, format: 'json', bytes: includeBytes }, { id: 'fixture:/base', format: 'json', bytes: EMPTY }],
    edges: [{ from: ROOT, to: 'fixture:/base', ordinal: 0 }] }
  cases.push(budget('include-depth-zero', 'snapshotInput', { input: included, limits: { includeDepth: 0 } }, 'include-depth', 0),
    { id: 'include-cycle-two', operation: 'snapshotInput', request: { input: { ...included,
      resources: [{ id: ROOT, format: 'json', bytes: includeBytes }, { id: 'fixture:/base', format: 'json', bytes: '{"name":"base","type":"dark","include":"root.json"}' }],
      edges: included.edges.concat([{ from: 'fixture:/base', to: ROOT, ordinal: 0 }]) } }, expected: { kind: 'invalid', code: 'include-graph', location: includeLocation } })
  const invalidLimits: readonly unknown[] = [-1, 0.5, '1', null, 4_294_967_296]
  for (const [index, limit] of invalidLimits.entries()) cases.push({ id: `invalid-limit-${index}`, operation: 'resolvePaths', request: { fixture: 'inheritance/raw', paths: [], limits: { steps: limit } }, expected: { kind: 'invalid', code: 'schema', location: REQUEST } })
  cases.push({ id: 'unknown-limit', operation: 'resolvePaths', request: { fixture: 'inheritance/raw', paths: [], limits: { unknown: 1 } }, expected: { kind: 'invalid', code: 'schema', location: REQUEST } })
  return { schema: 'native-theme-diagnostics/v1', authority: 'Hand-authored amended contract expectations; never submitted to a reference matcher.',
    identity: nativeThemeDigest('native-theme-oracle/diagnostics/v1', [JSON.stringify(cases)]), cases }
}
