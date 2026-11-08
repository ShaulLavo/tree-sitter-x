import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { ScopeRequest } from '../fixtures/js-jsx-wave.ts'
import type { CompleteResult, DocumentResult, IncompleteResult } from '../schema.ts'
import { ResultBuilder } from '../build.ts'
import { parseResult } from '../validate.ts'
import { serializeResult } from '../serialize.ts'
import { PINS, pinLabel } from '../oracles/pins.ts'
import { sourceIdentity } from './component-inputs.ts'
import { vendorAssets } from '../baselines/assets.ts'
import { Component } from './component.ts'
import type { NativePack } from './component.ts'
import { loadLanguagePack } from './packs.ts'
import { PilotDocument } from './owner.ts'
import { ScopeSession } from './incremental.ts'
import type { ScopeOutcome } from './incremental.ts'
import { ThemePresentation } from './theme-presentation.ts'
import type { PresentationOutcome } from './theme-presentation.ts'
import { normalizeTheme, snapshotInput } from './theme-input.ts'
import type { NormalizedTheme } from './theme-input.ts'
import type { Outcome, OutsideScore, Profile, Location } from './theme-contract.ts'
import { decodedSnapshot } from './scope-output.ts'
import { buildProduct, collectSourceFacts, planProduct } from './scope-framing.ts'
import type { FramingPolicy, ScopeLease, ScopeSnapshot } from './scope-output.ts'
import { sameOwner, sameWork } from './owner-state.ts'
import { hash, need, object, string, list, same, unique, diagnostic, nativeResolvedStyle, STYLE_PROJECTION, WAVE_LIMIT } from '../wave-collection.ts'

export interface NativeWaveRequest {
  readonly row: ScopeRequest
  readonly source: string
  readonly themes: readonly string[]
  readonly selectionSha256: string
}
type NativeSelectOutcome = Awaited<ReturnType<ThemePresentation['select']>>
export type ThemeAttempt = { readonly kind: 'complete'; readonly theme: string; readonly contentRevision: string; readonly acquisitionRevision: string;
  readonly targetIdentity: string; readonly normalizedPacketDigest: string; readonly resourceDigest: string; readonly assetDigest: string; readonly warnings: readonly OutsideScore[] }
  | { readonly kind: 'failed'; readonly theme: string; readonly outcome: Exclude<NativeSelectOutcome, { readonly kind: 'complete' }>; readonly warnings: readonly OutsideScore[] }
export interface NativeWaveEvidence {
  readonly requestedProfile: ScopeRequest['profile']
  readonly framing: FramingPolicy
  readonly scopeIdentity: Pick<ScopeSnapshot, 'owner' | 'generation' | 'work'> | null
  readonly rawFullDigest: string
  readonly nativePresentationDigests: Readonly<Record<string, string>>
  readonly selectionsAttempted: number
  readonly normalizationAttempts: number
  readonly retainedBytesAfterDispose: number | null
  readonly allocations: { readonly kind: 'observed'; readonly beforePack: number; readonly afterDispose: number } | { readonly kind: 'unavailable'; readonly reason: string }
  readonly cleanupErrors: readonly string[]
  readonly scopeFailure: ScopeOutcome | null
  readonly observations: 'parse/classify/compile/resolve/peak-memory/scan-bytes unavailable; selections and normalization callbacks counted'
}
export type NativeWaveAnswer = { readonly kind: 'scopes-complete'; readonly rawFull: CompleteResult; readonly presented: CompleteResult; readonly themes: readonly ThemeAttempt[]; readonly evidence: NativeWaveEvidence }
  | { readonly kind: 'scope-failed'; readonly rawFull: IncompleteResult; readonly presented: IncompleteResult; readonly evidence: NativeWaveEvidence }
export function wavePolicy(profile: ScopeRequest['profile']): { readonly normalization: Profile; readonly framing: FramingPolicy } {
  if (profile === 'raw' || profile === 'raw:shiki-fork') return { normalization: 'raw', framing: 'identity-v1' }
  if (profile === 'shiki-api') return { normalization: 'product', framing: 'identity-v1' }
  need(profile === 'product' || profile === 'product:warm', 'Unknown requested profile')
  return { normalization: 'product', framing: 'future010-product-lines-v1' }
}
interface ThemeAsset { readonly id: string; readonly version: string; readonly path: string; readonly sha256: string }
export function themeAssets(): readonly ThemeAsset[] {
  const manifest = object(JSON.parse(readFileSync(new URL('../../manifest/assets.json', import.meta.url), 'utf8')))
  return list(manifest.themes).map(value => {
    const row = object(value), id = string(row.id)
    need(/^[a-z0-9-]+$/.test(id) && row.package === '@shikijs/themes' && row.path === `dist/${id}.mjs` && row.version === PINS.themes.version, 'Untrusted theme asset')
    return { id, version: string(row.version), path: string(row.path), sha256: string(row.sha256) }
  })
}
export function verifyThemeAssets(): readonly ThemeAsset[] {
  const assets = themeAssets(), require = createRequire(import.meta.url)
  const packagePath = resolve(dirname(require.resolve('@shikijs/themes/andromeeda')), '../package.json'), pkg = object(JSON.parse(readFileSync(packagePath, 'utf8')))
  need(pkg.version === PINS.themes.version, 'Installed theme package version mismatch')
  for (const asset of assets) need(hash(readFileSync(resolve(dirname(packagePath), asset.path))) === asset.sha256, `Changed installed theme: ${asset.id}`)
  return assets
}
function jsonCompatible(value: unknown, ancestors = new Set<unknown>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') { need(Number.isFinite(value), 'Non-JSON theme number'); return }
  need(typeof value === 'object' && !ancestors.has(value), 'Non-JSON theme value')
  need(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, 'Non-JSON theme object')
  need(Object.getOwnPropertySymbols(value).length === 0, 'Symbol theme fields are not JSON-compatible')
  if (Array.isArray(value)) need(Object.keys(value).length === value.length, 'Sparse/extended theme array')
  else need(Object.values(Object.getOwnPropertyDescriptors(value)).every(field => field.enumerable && 'value' in field), 'Non-data theme property')
  ancestors.add(value)
  for (const entry of Object.values(value)) jsonCompatible(entry, ancestors)
  ancestors.delete(value)
}
function themeTarget(): string {
  const sources = ['theme-input.ts', '../oracles/product/theme.ts', '../oracles/raw.ts', '../oracles/resolved-style.ts']
  return hash(JSON.stringify({ packages: [pinLabel(PINS.shiki), pinLabel(PINS.themes), pinLabel(PINS.shikiTextmate)], sources: sources.map(path => [path, hash(readFileSync(new URL(path, import.meta.url)))]) }))
}
export async function acquireWaveTheme(id: string, profile: Profile): Promise<{ readonly outcome: Outcome<NormalizedTheme>; readonly resourceDigest: string; readonly assetDigest: string }> {
  return normalizeWaveTheme(id, profile)
}
function normalizeWaveTheme(id: string, profile: Profile): Awaited<ReturnType<typeof acquireWaveTheme>> {
  const asset = themeAssets().find(asset => asset.id === id)
  need(asset, 'Unknown locked theme')
  const require = createRequire(import.meta.url), packagePath = resolve(dirname(require.resolve(`@shikijs/themes/${id}`)), '../package.json')
  need(object(JSON.parse(readFileSync(packagePath, 'utf8'))).version === asset.version, 'Theme package version mismatch')
  need(hash(readFileSync(resolve(dirname(packagePath), asset.path))) === asset.sha256, 'Theme module digest mismatch')
  const registration = object(object(require(`@shikijs/themes/${id}`)).default)
  jsonCompatible(registration)
  const rules = list(registration.settings ?? registration.tokenColors ?? []).map(object)
  need(!rules.some(rule => rule.scope === undefined && object(rule.settings).fontStyle !== undefined), `theme ${id}: a default font style breaks the resolved-style convention`)
  const bytes = new TextEncoder().encode(JSON.stringify(registration)), resourceDigest = hash(bytes)
  const resourceId = `package-registration-json:${id}:${asset.sha256}`
  const acquired = snapshotInput({ root: resourceId, resources: [{ id: resourceId, format: 'json', bytes }], edges: [] })
  const outcome = acquired.kind === 'ok' ? normalizeTheme(acquired.value, profile, themeTarget()) : acquired
  return { outcome, resourceDigest, assetDigest: asset.sha256 }
}
function buildScopes(request: NativeWaveRequest, snapshot: ScopeSnapshot, engine: Readonly<Record<string, string>>): ResultBuilder {
  need(snapshot.coverage.from === 0 && snapshot.coverage.to === request.source.length, 'Clipped native output')
  const builder = new ResultBuilder({ profileId: 'native', languageId: request.row.language, engine }, request.source)
  for (const interval of decodedSnapshot(snapshot)) builder.scope(interval.from, interval.to, interval.scopes)
  for (const entry of snapshot.diagnostics) builder.diagnostic(entry)
  return builder
}
interface Resources {
  pack?: NativePack
  owner?: PilotDocument
  session?: ScopeSession
  view?: ReturnType<ScopeSession['attachView']>
  presentation?: ThemePresentation
  raw?: ScopeLease
}
function cleanup(resources: Resources, errors: string[]): number | null {
  const actions = [() => resources.raw?.release(), () => resources.presentation?.dispose(),
    () => { if (resources.view !== undefined) resources.session?.detachView(resources.view) },
    () => resources.session?.dispose(), () => resources.owner?.dispose(), () => resources.pack?.dispose()]
  for (const action of actions) { try { action() } catch (error) { errors.push(diagnostic(error)) } }
  return resources.session?.retainedBytes() ?? null
}
function failureDocument(request: NativeWaveRequest, reason: string, status: IncompleteResult['status'] = 'error', engine: Readonly<Record<string, string>> = {}): IncompleteResult {
  return new ResultBuilder({ profileId: 'native', languageId: request.row.language, engine: { ...engine, requestedProfile: request.row.profile, styleProjection: STYLE_PROJECTION } }, request.source).incomplete(status, reason)
}
function failureStatus(outcome: ScopeOutcome | null): IncompleteResult['status'] {
  if (outcome?.kind === 'canceled') return 'canceled'
  if (outcome?.kind === 'incomplete' && outcome.reason === 'unsupported') return 'unsupported'
  return 'error'
}
interface Progress {
  scopeIdentity: NativeWaveEvidence['scopeIdentity']
  scopeFailure: ScopeOutcome | null
  rawFullDigest: string
  selectionsAttempted: number
  normalizationAttempts: number
  nativePresentationDigests: Record<string, string>
}
export async function collectNativeWaveDocument(request: NativeWaveRequest, signal: AbortSignal): Promise<NativeWaveAnswer> {
  wavePolicy(request.row.profile)
  need(request.source.length === request.row.utf16Units && request.row.key === JSON.stringify([request.row.language, request.row.fixture, request.row.profile, 'fresh-full']), 'Invalid native request identity')
  unique(request.themes, 'requested theme')
  const resources: Resources = {}, cleanupErrors: string[] = []
  const progress: Progress = { scopeIdentity: null, scopeFailure: null, rawFullDigest: '', selectionsAttempted: 0, normalizationAttempts: 0, nativePresentationDigests: {} }
  let retainedBytesAfterDispose: number | null = null
  let component: Component | undefined, beforePack: number | undefined, rawFull: DocumentResult | undefined, presented: DocumentResult | undefined, themes: readonly ThemeAttempt[] = []
  try {
    need(!signal.aborted, 'canceled before owner creation')
    component = await Component.load(); await component.runtime.language(request.row.language); beforePack = component.liveAllocations()
    const collected = await collectWithResources(request, signal, resources, progress)
    rawFull = collected.rawFull; presented = collected.presented; themes = collected.themes
  } catch (error) {
    const failed = failureDocument(request, diagnostic(error), signal.aborted ? 'canceled' : failureStatus(progress.scopeFailure), resources.pack?.engine)
    rawFull = failed; presented = failed
  } finally { retainedBytesAfterDispose = cleanup(resources, cleanupErrors) }
  const allocations = component && beforePack !== undefined ? { kind: 'observed' as const, beforePack, afterDispose: component.liveAllocations() } : { kind: 'unavailable' as const, reason: 'initialization failed before baseline' }
  if (retainedBytesAfterDispose !== null && retainedBytesAfterDispose !== 0) cleanupErrors.push('Session retained bytes after disposal')
  if (allocations.kind === 'observed' && allocations.beforePack !== allocations.afterDispose) cleanupErrors.push('Component live allocation baseline mismatch')
  const evidence: NativeWaveEvidence = { ...progress, requestedProfile: request.row.profile, framing: wavePolicy(request.row.profile).framing, retainedBytesAfterDispose, allocations, cleanupErrors,
    observations: 'parse/classify/compile/resolve/peak-memory/scan-bytes unavailable; selections and normalization callbacks counted' }
  if (cleanupErrors.length || !rawFull || !presented) {
    const failed = failureDocument(request, cleanupErrors.join('; ') || 'No native output', 'error', resources.pack?.engine)
    return { kind: 'scope-failed', rawFull: failed, presented: failed, evidence }
  }
  if (rawFull.status !== 'complete' || presented.status !== 'complete') {
    const failed = rawFull.status !== 'complete' ? rawFull : failureDocument(request, 'Incomplete presentation')
    return { kind: 'scope-failed', rawFull: failed, presented: failed, evidence }
  }
  return { kind: 'scopes-complete', rawFull, presented, themes, evidence }
}
async function collectWithResources(request: NativeWaveRequest, signal: AbortSignal, resources: Resources, progress: Progress) {
  resources.pack = await loadLanguagePack(request.row.language)
  resources.owner = await PilotDocument.open(request.row.language, request.source)
  resources.session = ScopeSession.attach(resources.owner, new Map([[request.row.language, resources.pack]]))
  resources.view = resources.session.attachView({ from: 0, to: request.source.length })
  resources.session.flushOne()
  const outcome = resources.session.outcome(resources.view)
  if (outcome?.kind !== 'complete') { progress.scopeFailure = outcome ?? null; throw new Error(`Scope failure: ${JSON.stringify(outcome)}`) }
  const raw = resources.session.acquireFull(resources.view)
  need(raw, 'Missing raw-full lease')
  resources.raw = raw
  const snapshot = raw.snapshot
  progress.scopeIdentity = { owner: snapshot.owner, generation: snapshot.generation, work: snapshot.work }
  const engine = { ...resources.pack.engine, requestedProfile: request.row.profile, framing: wavePolicy(request.row.profile).framing, styleProjection: STYLE_PROJECTION, selectionSha256: request.selectionSha256 }
  const rawFull = buildScopes(request, snapshot, { ...engine, framing: 'identity-v1' }).complete()
  progress.rawFullDigest = hash(serializeResult(rawFull))
  const projected = resources.raw.projectFraming(wavePolicy(request.row.profile).framing).snapshot
  const builder = buildScopes(request, projected, engine)
  resources.presentation = new ThemePresentation(resources.session)
  const themes: ThemeAttempt[] = []
  for (const theme of request.themes) themes.push(await collectTheme(request, signal, resources.session, resources.presentation, resources.view, projected, builder, theme, progress))
  return { rawFull, presented: builder.complete(), themes }
}
async function collectTheme(request: NativeWaveRequest, signal: AbortSignal, session: ScopeSession, presentation: ThemePresentation, view: ReturnType<ScopeSession['attachView']>, scopes: ScopeSnapshot, builder: ResultBuilder, theme: string, progress: Progress): Promise<ThemeAttempt> {
  let acquired: Awaited<ReturnType<typeof acquireWaveTheme>> | undefined
  const policy = wavePolicy(request.row.profile)
  progress.selectionsAttempted++
  const outcome = await presentation.select(view, async () => {
    progress.normalizationAttempts++
    acquired = await acquireWaveTheme(theme, policy.normalization)
    return acquired.outcome
  }, { framing: policy.framing, signal })
  const warnings = acquired?.outcome.kind === 'ok' ? acquired.outcome.warnings : []
  if (outcome.kind !== 'complete') return { kind: 'failed', theme, outcome, warnings }
  const normalized = acquired?.outcome
  need(normalized?.kind === 'ok' && acquired, 'Missing normalized theme evidence')
  const lease = presentation.acquire(view)
  if (!lease) return { kind: 'failed', theme, outcome: { kind: 'unavailable', reason: 'scope-not-current' }, warnings }
  const current = session.acquireFull(view)
  try {
    need(current && session.presentationCurrent(current), 'Presentation no longer current')
    const snapshot = lease.snapshot, key = snapshot.key
    same(key, outcome.key, 'Published presentation key mismatch')
    same(key.view, current.publication, 'Published view/interest/theme mismatch')
    need(sameOwner(key.owner, scopes.owner) && sameWork(key.work, scopes.work) && key.generation === scopes.generation && key.view.view === view && key.view.theme === outcome.key.view.theme && key.themeRevision === normalized.value.contentRevision && key.profile === policy.normalization && key.framing === policy.framing, 'Stale presentation identity')
    same(decodedSnapshot(snapshot.scopes), decodedSnapshot(scopes), 'Presented scope content differs from projection')
    need(snapshot.scopes.coverage.from === 0 && snapshot.scopes.coverage.to === request.source.length && snapshot.metadata === null, 'Incomplete native presentation')
    progress.nativePresentationDigests[theme] = hash(JSON.stringify(snapshot.runs))
    for (const run of snapshot.runs) builder.style(theme, run.from, run.to, nativeResolvedStyle(run.style))
  } finally { try { lease.release() } finally { current?.release() } }
  return { kind: 'complete', theme, contentRevision: normalized.value.contentRevision, acquisitionRevision: normalized.value.acquisitionRevision,
    targetIdentity: normalized.value.targetIdentity, normalizedPacketDigest: normalized.value.normalizedPacketDigest, resourceDigest: acquired.resourceDigest, assetDigest: acquired.assetDigest, warnings }
}

/** Worker boundary: validate the original schema documents and every terminal attempt before use. */
export function parseNativeWaveAnswer(value: unknown, request: NativeWaveRequest): NativeWaveAnswer {
  const row = object(value), evidence = object(row.evidence)
  const rawFull = parseResult(row.rawFull, request.source), presented = parseResult(row.presented, request.source)
  for (const result of [rawFull, presented]) {
    need(result.profileId === 'native' && result.languageId === request.row.language && result.documentRevision === 0, 'Wrong candidate document identity')
    need(result.status !== 'complete' || result.metadata === undefined, 'Unexpected candidate metadata')
    need(result.engine.requestedProfile === request.row.profile && result.engine.styleProjection === STYLE_PROJECTION, 'Wrong candidate policy identity')
  }
  same(evidence.requestedProfile, request.row.profile, 'Wrong evidence profile')
  same(evidence.framing, wavePolicy(request.row.profile).framing, 'Wrong evidence framing')
  const parsedEvidence = validateEvidence(evidence)
  if (row.kind === 'scope-failed') {
    need(rawFull.status !== 'complete' && presented.status !== 'complete' && row.themes === undefined, 'Trustworthy partial output on failed request')
    return { kind: 'scope-failed', rawFull, presented, evidence: parsedEvidence }
  }
  need(row.kind === 'scopes-complete' && rawFull.status === 'complete' && presented.status === 'complete', 'Invalid worker answer kind')
  need(parsedEvidence.cleanupErrors.length === 0 && parsedEvidence.retainedBytesAfterDispose === 0 && parsedEvidence.allocations.kind === 'observed' && parsedEvidence.allocations.beforePack === parsedEvidence.allocations.afterDispose, 'Unclean native completion')
  need(parsedEvidence.rawFullDigest === hash(serializeResult(rawFull)) && rawFull.styles === undefined, 'Raw-full digest/track mismatch')
  const themes = list(row.themes).map(parseThemeAttempt)
  same(themes.map(theme => theme.theme), request.themes, 'Missing/duplicate/extra terminal theme attempts')
  same(Object.keys(presented.styles ?? {}).sort(), request.source.length ? themes.filter(theme => theme.kind === 'complete').map(theme => theme.theme).sort() : [], 'Theme tracks disagree with attempts')
  need(parsedEvidence.scopeIdentity !== null && parsedEvidence.scopeFailure === null && parsedEvidence.selectionsAttempted === request.themes.length && parsedEvidence.normalizationAttempts <= parsedEvidence.selectionsAttempted, 'Missing/inconsistent native work evidence')
  same(Object.keys(parsedEvidence.nativePresentationDigests).sort(), themes.filter(theme => theme.kind === 'complete').map(theme => theme.theme).sort(), 'Presentation digest membership mismatch')
  for (const theme of themes.filter(theme => theme.kind === 'complete')) {
    need(Object.hasOwn(parsedEvidence.nativePresentationDigests, theme.theme), 'Missing original presentation digest')
    const expected = normalizeWaveTheme(theme.theme, wavePolicy(request.row.profile).normalization)
    need(expected.outcome.kind === 'ok', 'Successful theme has no admitted normalization')
    const normalized = expected.outcome.value
    same([theme.assetDigest, theme.resourceDigest, theme.acquisitionRevision, theme.contentRevision, theme.targetIdentity, theme.normalizedPacketDigest],
      [expected.assetDigest, expected.resourceDigest, normalized.acquisitionRevision, normalized.contentRevision, normalized.targetIdentity, normalized.normalizedPacketDigest], 'Wrong normalized theme identity')
  }
  need(rawFull.engine.selectionSha256 === request.selectionSha256 && presented.engine.selectionSha256 === request.selectionSha256, 'Wrong candidate selection')
  validateNativeEngine(presented.engine, request.row.language)
  validateNativeEngine(rawFull.engine, request.row.language)
  need(rawFull.engine.framing === 'identity-v1' && presented.engine.framing === wavePolicy(request.row.profile).framing, 'Mislabeled raw/projected native scopes')
  validateProjectedScopes(request, rawFull, presented, parsedEvidence.scopeIdentity)
  return { kind: 'scopes-complete', rawFull, presented, themes, evidence: parsedEvidence }
}
function validateProjectedScopes(request: NativeWaveRequest, raw: CompleteResult, presented: CompleteResult, identity: NonNullable<NativeWaveEvidence['scopeIdentity']>): void {
  if (wavePolicy(request.row.profile).framing === 'identity-v1') {
    same([raw.scopeNames, raw.paths, raw.spans], [presented.scopeNames, presented.paths, presented.spans], 'Identity framing changed scopes')
    return
  }
  const bounds = { ranges: Math.floor(WAVE_LIMIT / 32), bytes: WAVE_LIMIT }
  const facts = collectSourceFacts(request.source, { owner: identity.owner, generation: identity.generation }, bounds)
  const snapshot: ScopeSnapshot = { ...identity, coverage: { from: 0, to: request.source.length }, sourceLength: request.source.length,
    dictionary: { names: raw.scopeNames, paths: raw.paths }, segments: raw.spans, metadata: null, separators: facts.separators,
    injections: [], diagnostics: [], sourceFacts: facts }
  const projected = buildProduct(snapshot, planProduct(snapshot, bounds)).snapshot
  const expected = buildScopes(request, projected, presented.engine).complete()
  same([presented.scopeNames, presented.paths, presented.spans], [expected.scopeNames, expected.paths, expected.spans], 'Product framing changed scopes')
}

function nonnegative(value: unknown): number { need(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'Invalid counter'); return value }
function digestString(value: unknown): string { const result = string(value); need(/^[a-f0-9]{64}$/.test(result), 'Invalid digest'); return result }
function validateEvidence(value: Record<string, unknown>): NativeWaveEvidence {
  nonnegative(value.selectionsAttempted); nonnegative(value.normalizationAttempts)
  if (value.retainedBytesAfterDispose !== null) nonnegative(value.retainedBytesAfterDispose)
  list(value.cleanupErrors).forEach(string)
  const allocations = object(value.allocations)
  if (allocations.kind === 'observed') { nonnegative(allocations.beforePack); nonnegative(allocations.afterDispose) }
  else { need(allocations.kind === 'unavailable', 'Invalid allocation evidence'); string(allocations.reason) }
  Object.values(object(value.nativePresentationDigests)).forEach(digestString)
  if (string(value.rawFullDigest)) digestString(value.rawFullDigest)
  need(value.scopeFailure === null || typeof value.scopeFailure === 'object', 'Invalid scope failure evidence')
  if (value.scopeIdentity !== null) {
    const identity = object(value.scopeIdentity), owner = object(identity.owner), work = object(identity.work)
    for (const key of ['epoch', 'revision', 'syntax']) { nonnegative(owner[key]); same(work[key], owner[key], 'Work/owner identity mismatch') }
    need(nonnegative(owner.epoch) > 0 && owner.revision === 0 && owner.syntax === 0 && nonnegative(work.request) > 0 && nonnegative(identity.generation) > 0, 'Invalid fresh native generation')
  }
  if (value.scopeFailure !== null) validateScopeFailure(value.scopeFailure)
  need(value.observations === 'parse/classify/compile/resolve/peak-memory/scan-bytes unavailable; selections and normalization callbacks counted', 'Invalid observation policy')
  // Fields above are checked at this untyped transport boundary. Native branded identities never drive a native API after transport.
  return value as unknown as NativeWaveEvidence
}
function parseThemeAttempt(value: unknown): ThemeAttempt {
  const row = object(value), theme = string(row.theme)
  const warnings = list(row.warnings).map(parseWarning)
  if (row.kind === 'failed') return { kind: 'failed', theme, warnings, outcome: parseFailure(row.outcome) }
  need(row.kind === 'complete', 'Invalid theme attempt')
  return { kind: 'complete', theme, warnings, contentRevision: digestString(row.contentRevision), acquisitionRevision: digestString(row.acquisitionRevision), targetIdentity: digestString(row.targetIdentity), normalizedPacketDigest: digestString(row.normalizedPacketDigest), resourceDigest: digestString(row.resourceDigest), assetDigest: digestString(row.assetDigest) }
}
function parseWarning(value: unknown): OutsideScore {
  const warning = object(value); need(warning.kind === 'outside-score', 'Invalid warning')
  const result = { kind: 'outside-score' as const, resource: string(warning.resource), property: string(warning.property) }
  if (!('location' in warning)) return result
  const location = parseLocation(warning.location)
  if ('resource' in location) need(location.resource === result.resource, 'Warning location resource mismatch')
  return { ...result, location }
}
function parseFailure(value: unknown): Exclude<PresentationOutcome, { kind: 'complete' }> {
  const row = object(value)
  if (row.kind === 'canceled' || row.kind === 'discarded') return { kind: row.kind }
  if (row.kind === 'incomplete') { need(row.reason === 'budget', 'Invalid incomplete reason'); return { kind: 'incomplete', reason: 'budget' } }
  if (row.kind === 'unavailable') { need(row.reason === 'closed' || row.reason === 'scope-not-current', 'Invalid unavailable reason'); return { kind: 'unavailable', reason: row.reason } }
  const codes: Readonly<Record<string, readonly string[]>> = {
    invalid: ['json', 'schema', 'include-graph', 'include-authority', 'selector', 'color', 'font-style', 'packet'],
    unsupported: ['input-format', 'profile', 'selector', 'trie-tail-atom', 'color-format', 'syntax-property', 'font-style', 'raw-palette'],
    budget: ['input-bytes', 'resources', 'include-depth', 'rules', 'atoms', 'context-edges', 'packet-bytes', 'resource-id-bytes', 'atom-bytes', 'context-atoms', 'paths', 'compile-steps', 'trie-nodes', 'context-rules', 'owned-bytes', 'resolve-steps', 'output-bytes'],
    'no-memory': ['allocation'], error: ['acquisition-failed', 'runtime-failed'],
  }
  const kind = string(row.kind), code = string(row.code)
  need(Object.hasOwn(codes, kind) && codes[kind].includes(code), 'Invalid native failure')
  if (kind === 'budget') nonnegative(row.limit)
  parseLocation(row.location)
  if (kind === 'error') need(object(row.location).kind === 'request', 'Invalid operational failure location')
  return row as unknown as Exclude<PresentationOutcome, { kind: 'complete' }>
}
function parseLocation(value: unknown): Location {
  const row = object(value)
  if (row.kind === 'request') return { kind: 'request' }
  if (row.kind === 'packet') return { kind: 'packet', byteOffset: nonnegative(row.byteOffset) }
  const resource = string(row.resource)
  if (row.kind === 'resource') {
    const jsonPointer = string(row.jsonPointer)
    need((jsonPointer === '' || jsonPointer.startsWith('/')) && !/~(?![01])/u.test(jsonPointer), 'Invalid location JSON pointer')
    return { kind: 'resource', resource, jsonPointer, byteOffset: row.byteOffset === null ? null : nonnegative(row.byteOffset) }
  }
  need(row.kind === 'setting', 'Invalid failure location')
  return { kind: 'setting', resource, rule: nonnegative(row.rule), alternative: row.alternative === null ? null : nonnegative(row.alternative), property: string(row.property) }
}
function validateNativeEngine(engine: Readonly<Record<string, string>>, language: string): void {
  for (const key of ['componentSha256', 'sourceDigest', 'runtimeSha256', 'querySha256', 'parserSha256']) digestString(engine[key])
  const component = readFileSync(new URL('../../../../lib/scope-compat/build/scope-compat.wasm', import.meta.url))
  const manifest: unknown = JSON.parse(readFileSync(new URL('../../../../lib/scope-compat/build/scope-compat.manifest.json', import.meta.url), 'utf8'))
  const binding = readFileSync(new URL('../../../../lib/binding_web/web-tree-sitter.js', import.meta.url)), runtime = readFileSync(new URL('../../../../lib/binding_web/web-tree-sitter.wasm', import.meta.url))
  const queries = ['shared/javascript-common.scm', `${language}/${language}.scm`].map(path => readFileSync(new URL(`../../../../lib/scope-compat/packs/${path}`, import.meta.url), 'utf8')).join('\n')
  need(engine.componentSha256 === hash(component) && engine.sourceDigest === sourceIdentity(manifest) && engine.runtimeSha256 === hash(Buffer.concat([runtime, binding])) && engine.querySha256 === hash(queries), 'Changed native runtime/component/query identity')
  need(engine.parserSha256 === vendorAssets().find(asset => asset.languageId === 'javascript' && asset.kind === 'wasm')?.sha256, 'Wrong native parser identity')
  need(engine.languageId === language && engine.packId === language && engine.packVersion === 'experimental-1' && engine.parserLanguageId === 'javascript' && engine.abi === '1', 'Invalid native engine identity')
}
export function boundedAnswer(answer: NativeWaveAnswer): void { need(Buffer.byteLength(JSON.stringify(answer)) <= WAVE_LIMIT, 'Transport budget: native final reply exceeds 64 MiB') }

function validateScopeFailure(value: unknown): void {
  const failure = object(value), work = object(failure.work)
  for (const key of ['epoch', 'revision', 'syntax', 'request']) nonnegative(work[key])
  if (failure.kind === 'canceled' || failure.kind === 'discarded') { string(failure.reason); return }
  need(failure.kind === 'incomplete' && ['unsupported', 'budget', 'invalid', 'no-memory', 'owner-unavailable'].includes(string(failure.reason)), 'Invalid scope failure')
  string(failure.diagnostic)
}
