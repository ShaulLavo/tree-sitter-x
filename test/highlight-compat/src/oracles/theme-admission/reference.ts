import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { Theme, Registry } from '@shikijs/vscode-textmate'
import upstream from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
import { createHighlighterCore, normalizeTheme } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import { createScopedLineTokenizer, tokenScopes } from '../product/scopedTokens.ts'
import { workerThemeRegistration } from '../product/theme.ts'
import { ScopePath } from '../product/scopePath.ts'
import { vscodeRawTheme } from '../raw.ts'
import { nativeThemeEffective, nativeThemeRgba, nativeThemeTargets, observeNativeTheme } from '../native-theme-reference.ts'
import { decodeNativeThemeMetadata, nativeThemeSpansEqual, nativeThemeStackGrammar } from '../native-theme-direct.ts'
import { object } from './load.ts'
import { admissionInputs, encodeSuite, identity, sha256, transportControls } from './inputs.ts'
import { ADMISSION_SCHEMA, PROJECTION, type AdmissionInput, type AdmissionSuite, type Attempt, type Json, type ObjectValue, type Observation, type TargetObservation } from './schema.ts'

export function json(value: unknown): Json {
  const serialized = JSON.stringify(value)
  assert(serialized !== undefined, 'target result must be JSON serializable')
  const result: unknown = JSON.parse(serialized)
  assertJson(result)
  return result
}

function assertJson(value: unknown): asserts value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') { assert(Number.isFinite(value)); return }
  assert(typeof value === 'object', 'JSON object')
  for (const child of Object.values(value)) assertJson(child)
}

function get(value: unknown, property: string): unknown {
  assert(value !== null && (typeof value === 'object' || typeof value === 'function'), `target object for ${property}`)
  return Reflect.get(value, property)
}

function invoke(value: unknown, method: string, args: unknown[]): unknown {
  const fn = get(value, method)
  assert(typeof fn === 'function', `target method ${method}`)
  return Reflect.apply(fn, value, args)
}

function normalized(document: ObjectValue, profile: Attempt['profile']): ObjectValue {
  const copied = structuredClone(document), registrationArgs = [copied]
  const registration = profile === 'raw' ? copied : targetCall('profile-normalization', () => Reflect.apply(workerThemeRegistration, undefined, registrationArgs))
  const operation = profile === 'raw' ? vscodeRawTheme : normalizeTheme, args = [registration]
  const result: unknown = targetCall('profile-normalization', () => Reflect.apply(operation, undefined, args))
  assert(result !== null && typeof result === 'object' && 'settings' in result && Array.isArray(result.settings), 'target normalized settings')
  const checked = json(result)
  assert(checked !== null && typeof checked === 'object' && !Array.isArray(checked))
  return checked
}

function themeFrom(registration: ObjectValue): Theme {
  const theme: unknown = targetMethod('fork-theme-compilation', Theme, 'createFromRawTheme', [registration])
  assert(theme instanceof Theme)
  return theme
}

class TargetFailure extends Error {
  readonly stage: string
  readonly cause: unknown
  constructor(stage: string, cause: unknown) { super('pinned target failed'); this.stage = stage; this.cause = cause }
}

function targetCall<T>(stage: string, operation: () => T): T {
  try { return operation() } catch (error) { throw new TargetFailure(stage, error) }
}
function targetMethod(stage: string, owner: unknown, method: string, args: unknown[]): unknown {
  const fn = get(owner, method)
  assert(typeof fn === 'function', `target method ${method}`)
  return targetCall(stage, () => Reflect.apply(fn, owner, args))
}

let loaded: Promise<void> | undefined
async function library() {
  loaded ??= oniguruma.loadWASM(readFileSync(createRequire(import.meta.url).resolve('vscode-oniguruma/release/onig.wasm')))
  await loaded
  return { createOnigScanner: (patterns: string[]) => new oniguruma.OnigScanner(patterns), createOnigString: (text: string) => new oniguruma.OnigString(text) }
}

function upstreamMatches(registry: unknown, scopes: readonly string[]): Json {
  const theme = get(get(registry, '_syncRegistry'), '_theme')
  const colors = invoke(theme, 'getColorMap', [])
  assert(Array.isArray(colors))
  let path: ScopePath | null = null
  const partials: Json[] = []
  for (const scope of scopes) {
    path = new ScopePath(path, scope)
    const match = invoke(theme, 'match', [path])
    partials.push(json({ scope, match, projected: upstreamFields(match, colors) }))
  }
  const defaults = object(invoke(theme, 'getDefaults', []))
  assert(typeof defaults.fontStyle === 'number')
  return json({ defaults, effectiveDefaults: nativeThemeEffective(upstreamColor(colors, defaults.foregroundId), upstreamColor(colors, defaults.backgroundId), defaults.fontStyle), partials })
}

function upstreamColor(colors: unknown[], id: unknown): string {
  assert(typeof id === 'number' && Number.isInteger(id) && id > 0)
  const color = colors[id]
  assert(typeof color === 'string')
  return nativeThemeRgba(color)
}

function upstreamFields(match: unknown, colors: unknown[]) {
  const fields = match === null ? { fontStyle: -1, foregroundId: 0, backgroundId: 0 } : object(match)
  assert(typeof fields.fontStyle === 'number')
  return { foreground: fields.foregroundId === 0 ? { kind: 'inherit' } : { kind: 'set', value: upstreamColor(colors, fields.foregroundId) },
    background: fields.backgroundId === 0 ? { kind: 'inherit' } : { kind: 'set', value: upstreamColor(colors, fields.backgroundId) },
    fontMask: fields.fontStyle === -1 ? { kind: 'inherit' } : { kind: 'set', value: fields.fontStyle } }
}

async function rawDirect(registration: ObjectValue, scopes: readonly string[]) {
  const { grammar, text, at } = nativeThemeStackGrammar(scopes)
  const onigLib = await library()
  const raw = new upstream.Registry({ onigLib: Promise.resolve(onigLib), loadGrammar: async () => upstream.parseRawGrammar(JSON.stringify(grammar), 'admission.json') })
  const fork = new Registry({ onigLib, loadGrammar: () => ({ ...grammar, patterns: Array.from(grammar.patterns), repository: {} }) })
  try {
    const a = await raw.loadGrammar(grammar.scopeName), b = fork.loadGrammar(grammar.scopeName)
    assert(a && b)
    targetMethod('raw-theme-compilation', raw, 'setTheme', [registration])
    targetMethod('raw-fork-theme-compilation', fork, 'setTheme', [registration])
    const tokens = a.tokenizeLine(text, null), packed = a.tokenizeLine2(text, null), forkPacked = b.tokenizeLine2(text, null)
    assert(!tokens.stoppedEarly && !packed.stoppedEarly && !forkPacked.stoppedEarly)
    const direct = packedSpans(packed.tokens, raw.getColorMap(), text.length)
    const rawFork = packedSpans(forkPacked.tokens, fork.getColorMap(), text.length)
    assert(nativeThemeSpansEqual(direct, rawFork, text.length), 'direct raw/raw-fork')
    const token = tokens.tokens.find(item => item.startIndex <= at && item.endIndex > at)
    assert.deepEqual(token?.scopes, scopes, 'actual synthetic scope path')
    const theme = themeFrom(registration)
    const repaint = tokens.tokens.map(token => ({ from: token.startIndex, to: Math.min(token.endIndex, text.length), style: observeNativeTheme(theme, token.scopes, 'raw').applied }))
    assert(nativeThemeSpansEqual(direct, repaint, text.length), 'complete direct raw partition versus fork extraction')
    const expected = observeNativeTheme(theme, scopes, 'raw').applied
    assert.deepEqual(direct.find(item => item.from <= at && item.to > at)?.style, expected, 'raw direct versus extracted named fields')
    return { grammar, text, at, direct, rawFork, rawScopes: tokens.tokens }
  } finally { raw.dispose(); fork.dispose() }
}

function packedSpans(tokens: Uint32Array, colors: string[], length: number) {
  return Array.from({ length: tokens.length / 2 }, (_, index) => ({ from: tokens[index * 2], to: Math.min(tokens[index * 2 + 2] ?? length, length),
    style: decodeNativeThemeMetadata(tokens[index * 2 + 1], colors) }))
}

async function productDirect(registration: ObjectValue, scopes: readonly string[]) {
  const { grammar, text, at } = nativeThemeStackGrammar(scopes)
  const registry = new Registry({ onigLib: await library(), loadGrammar: () => ({ ...grammar, patterns: Array.from(grammar.patterns), repository: {} }) })
  try {
    const loadedGrammar = registry.loadGrammar(grammar.scopeName)
    assert(loadedGrammar)
    const tokenizer: unknown = Reflect.apply(createScopedLineTokenizer, undefined, [{ getLanguage: () => Object.assign(loadedGrammar, { name: 'admission' }), getTheme: () => registration }, 'admission', 'admission', 100_000])
    const result = object(invoke(tokenizer, 'tokenize', [text, undefined]))
    assert(Array.isArray(result.tokens))
    const tokens = result.tokens.map((token: unknown): Record<string, unknown> => ({ ...object(token), scopes: json(Reflect.apply(tokenScopes, undefined, [token])) }))
    const theme = themeFrom(registration)
    for (const token of tokens) checkProductToken(token, theme)
    const selected = tokens.find(token => typeof token.offset === 'number' && typeof token.content === 'string' && token.offset <= at && token.offset + token.content.length > at)
    assert(selected && typeof selected.color === 'string' && typeof selected.fontStyle === 'number')
    assert.deepEqual(selected.scopes, scopes, 'actual product scope path')
    const { background: _background, ...style } = nativeThemeEffective(selected.color, '#fff', selected.fontStyle)
    assert.deepEqual(style, observeNativeTheme(themeFrom(registration), scopes, 'product').applied, 'actual product versus extraction')
    return json(tokens)
  } finally { registry.dispose() }
}

function checkProductToken(token: Record<string, unknown>, theme: Theme): void {
  assert(Array.isArray(token.scopes) && token.scopes.every((scope: unknown) => typeof scope === 'string'))
  assert(typeof token.color === 'string' && typeof token.fontStyle === 'number')
  const { background: _background, ...style } = nativeThemeEffective(token.color, '#fff', token.fontStyle)
  assert.deepEqual(style, observeNativeTheme(theme, token.scopes, 'product').applied, 'full product direct projection')
}

async function shikiDirect(registration: ObjectValue, scopes: readonly string[]): Promise<Json> {
  const { grammar, text, at } = nativeThemeStackGrammar(scopes)
  const highlighter: unknown = await Reflect.apply(createHighlighterCore, undefined, [{ themes: [registration], langs: [{ ...grammar, name: 'admission', repository: {}, patterns: Array.from(grammar.patterns) }],
    engine: createOnigurumaEngine(import('shiki/wasm')) }])
  try {
    const tokens = invoke(highlighter, 'codeToTokensBase', [text, { lang: 'admission', theme: registration.name ?? 'admission' }])
    assert(Array.isArray(tokens) && Array.isArray(tokens[0]))
    const token = tokens[0].map(object).find(item => typeof item.offset === 'number' && typeof item.content === 'string' && item.offset <= at && item.offset + item.content.length > at)
    assert(token && typeof token.color === 'string')
    assert(token.fontStyle === undefined || typeof token.fontStyle === 'number')
    const { background: _background, ...style } = nativeThemeEffective(token.color, '#fff', token.fontStyle ?? 0)
    assert.deepEqual(style, observeNativeTheme(themeFrom(registration), scopes, 'product').applied, 'actual Shiki API versus extraction')
    return json(tokens)
  } finally { invoke(highlighter, 'dispose', []) }
}

async function observe(registration: ObjectValue, input: AdmissionInput, profile: Attempt['profile']): Promise<Observation[]> {
  const theme = themeFrom(registration)
  const defaultsRegistry = new upstream.Registry({ onigLib: Promise.resolve(await library()), loadGrammar: async () => null })
  try {
    targetMethod('upstream-theme-compilation', defaultsRegistry, 'setTheme', [registration])
    const observations: Observation[] = []
    for (const stack of input.stacks) observations.push(await observeStack(registration, input, profile, theme, defaultsRegistry, stack))
    return observations
  } finally { defaultsRegistry.dispose() }
}

async function observeStack(registration: ObjectValue, input: AdmissionInput, profile: Attempt['profile'], theme: Theme, registry: unknown, stack: AdmissionInput['stacks'][number]): Promise<Observation> {
  const upstreamPartial = object(upstreamMatches(registry, stack.scopes))
  const extracted = observeNativeTheme(theme, stack.scopes, profile)
  assert(Array.isArray(upstreamPartial.partials))
  assert.deepEqual(upstreamPartial.partials.map(object).map(item => ({ scope: item.scope, partial: item.projected })), extracted.trace, 'independent upstream/fork presence extraction')
  assert.deepEqual(upstreamPartial.effectiveDefaults, observeNativeTheme(theme, [], profile).effective, 'upstream/fork defaults')
  const observed = { ...stack, ...extracted, upstreamPartial: json(upstreamPartial) }
  if (stack.scopes.length === 0) return { ...observed, direct: null }
  const raw = await rawDirect(registration, stack.scopes)
  return { ...observed, direct: { grammar: json(raw.grammar), at: raw.at, rawScopes: json(raw.rawScopes), text: raw.text, raw: json(raw.direct), rawFork: json(raw.rawFork), product: await productDirect(registration, stack.scopes),
    shikiApi: input.shikiApi ? await shikiDirect(registration, stack.scopes) : null } }
}

export function projected(document: ObjectValue): ObjectValue {
  const result = structuredClone(document)
  const colors = result.colors
  assert(colors !== null && typeof colors === 'object' && !Array.isArray(colors))
  assert(Object.values(colors).every(value => typeof value === 'string' || value === null || (Array.isArray(value) && value.every(item => typeof item === 'string'))), 'typed projection requires admitted UI shapes')
  result.colors = Object.fromEntries(Object.entries(colors).filter(([key, value]) => typeof value === 'string' || key === 'editor.foreground' || key === 'editor.background' || key.startsWith('terminal.ansi')))
  return result
}

async function attempt(input: AdmissionInput, profile: Attempt['profile'], view: Attempt['view']): Promise<Attempt> {
  const registration = view === 'full' ? structuredClone(input.expanded) : projected(input.expanded)
  let result: TargetObservation
  try {
    const normalizedRegistration = normalized(registration, profile)
    result = { kind: 'observed', normalized: json(normalizedRegistration), normalizedIdentity: identity('admission/normalized/v1', json(normalizedRegistration)),
      cases: await observe(normalizedRegistration, input, profile) }
  } catch (error) {
    // Target failures are retained. Assertions/extraction bugs must fail generation instead of becoming oracle truth.
    if (!(error instanceof TargetFailure)) throw error
    const cause = error.cause
    result = { kind: 'error', stage: error.stage, name: cause instanceof Error ? cause.name : typeof cause, message: cause instanceof Error ? cause.message : String(cause) }
  }
  return { profile, view, registration, result }
}

export async function admissionFixture(input: AdmissionInput) {
  const attempts: Attempt[] = []
  for (const profile of ['raw', 'product'] as const) {
    attempts.push(await attempt(input, profile, 'full'))
    if (input.projection === 'untouched-ui') attempts.push(await attempt(input, profile, 'typed-projection'))
  }
  return { input, acquisitionIdentity: identity('admission/acquisition/v1', { root: input.root, resources: input.resources, edges: input.edges }), attempts }
}

export function admissionTargets(): Json {
  const require = createRequire(import.meta.url)
  const paths = ['@shikijs/primitive', '@shikijs/engine-oniguruma', 'shiki/wasm', '@shikijs/engine-oniguruma/wasm-inlined']
  const extra = Object.fromEntries(paths.map(name => [name, sha256(readFileSync(require.resolve(name)))]))
  assert.equal(extra['@shikijs/primitive'], '65cd5db33752ccfa81e681be14e4a9e8d63faec2c7e4aace8776f383efe3fb66')
  return json({ ...nativeThemeTargets(), normalizers: extra, productProfile: sha256(readFileSync(new URL('../../../manifest/product-profile.json', import.meta.url))),
    lockfile: sha256(readFileSync(new URL('../../../package-lock.json', import.meta.url))), rawAdapter: sha256(readFileSync(new URL('../raw.ts', import.meta.url))) })
}

export async function generateAdmissionSuite(sourceInputs: Readonly<Record<string, string>>): Promise<AdmissionSuite> {
  const fixtures = []
  for (const input of admissionInputs()) fixtures.push(await admissionFixture(input))
  const body = { schema: ADMISSION_SCHEMA, source: { commit: 'e961cc4dfe14e716e90694cda10378215be9e83b', inputs: sourceInputs }, projection: PROJECTION,
    targets: admissionTargets(), fixtures, transport: transportControls() } satisfies Omit<AdmissionSuite, 'identity'>
  return { ...body, identity: identity('admission/suite/v1', body) }
}

export const suiteBytes = encodeSuite
