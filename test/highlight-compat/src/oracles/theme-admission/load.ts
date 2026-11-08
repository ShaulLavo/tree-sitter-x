import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ADMISSION_ROOT, ADMISSION_SCHEMA, CONTRACT_AUTHORITY, PROJECTION, type AdmissionInput, type AdmissionSuite, type Json, type ObjectValue } from './schema.ts'
import { encodeSuite, identity, sha256 } from './inputs.ts'

export function object(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'object required')
  return Object.fromEntries(Object.entries(value))
}

function array(value: unknown): unknown[] { assert(Array.isArray(value), 'array required'); return value }
function string(value: unknown): string { assert(typeof value === 'string', 'string required'); return value }
function digest(value: unknown): void { assert(/^[a-f\d]{64}$/.test(string(value)), 'SHA-256 required') }
function integer(value: unknown): void { assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, 'unsigned integer required') }

function json(value: unknown): asserts value is Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number') { assert(Number.isFinite(value)); return }
  assert(value !== null && typeof value === 'object', 'JSON required')
  for (const item of Object.values(value)) json(item)
}

function jsonObject(value: unknown): ObjectValue { object(value); json(value); assert(!Array.isArray(value) && typeof value === 'object' && value !== null); return value }

function validateLocation(value: unknown, resource: unknown): void {
  const location = object(value)
  assert.equal(location.kind, 'resource')
  assert.equal(location.resource, resource)
  assert.equal(location.byteOffset, null)
  const path = string(location.jsonPointer)
  assert(path.startsWith('/') && !/~(?![01])/u.test(path), 'escaped JSON pointer')
}

function validateWarning(value: unknown): void {
  const warning = object(value)
  assert.equal(warning.kind, 'outside-score'); string(warning.resource); string(warning.property)
  if ('location' in warning) validateLocation(warning.location, warning.resource)
}

function validateContract(value: unknown): void {
  const contract = object(value)
  assert.equal(contract.authority, CONTRACT_AUTHORITY)
  const admission = object(contract.admission)
  assert(['ok', 'invalid', 'unsupported'].includes(string(admission.kind)))
  if (admission.kind === 'ok') { array(admission.warnings).forEach(validateWarning); return }
  string(admission.code); object(admission.location)
}

function validateInput(value: unknown): asserts value is AdmissionInput {
  const input = object(value)
  string(input.id); string(input.group); string(input.root)
  const resources = array(input.resources).map(object)
  assert(resources.length > 0 && new Set(resources.map(resource => string(resource.id))).size === resources.length)
  const resourcesById = new Map(resources.map(resource => [string(resource.id), resource]))
  assert(resourcesById.has(string(input.root)))
  for (const resource of resources) {
    const bytes = string(resource.bytes)
    assert.equal(sha256(bytes), resource.sha256, 'exact resource bytes')
    jsonObject(JSON.parse(bytes))
  }
  const edges = array(input.edges).map(object)
  for (const edge of edges) { assert(resourcesById.has(string(edge.from)) && resourcesById.has(string(edge.to)), 'authorized include closure'); integer(edge.ordinal) }
  const baseFirst = array(input.baseFirst).map(string)
  assert.deepEqual(baseFirst, resources.map(resource => resource.id), 'authored base-first resource order')
  const expanded = jsonObject(input.expanded)
  if (edges.length === 0) assert.deepEqual(JSON.parse(string(resources[0]?.bytes)), expanded, 'exact authored single-resource expansion')
  else validateExpansion(resources, edges, expanded, string(input.root))
  const stacks = array(input.stacks).map(object)
  assert.equal(new Set(stacks.map(stack => string(stack.id))).size, stacks.length)
  for (const stack of stacks) array(stack.scopes).forEach(string)
  validateContract(input.contract)
  validateWarningSources(input.contract, resources)
  assert(input.projection === 'none' || input.projection === 'untouched-ui')
  assert(typeof input.shikiApi === 'boolean')
}

function validateWarningSources(value: unknown, resources: Record<string, unknown>[]): void {
  const admission = object(object(value).admission)
  if (admission.kind !== 'ok') return
  for (const value of array(admission.warnings)) verifyWarningSource(value, resources)
}

function verifyWarningSource(value: unknown, resources: Record<string, unknown>[]): void {
  const warning = object(value)
  const resource = resources.find(resource => resource.id === warning.resource)
  assert(resource, 'warning belongs to original resource')
  if (!('location' in warning)) return
  const location = object(warning.location)
  const segments = string(location.jsonPointer).slice(1).split('/').map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
  let field: unknown = JSON.parse(string(resource.bytes))
  for (const segment of segments) {
    assert(field !== null && typeof field === 'object' && Object.hasOwn(field, segment), 'warning points to an original occurrence')
    field = Reflect.get(field, segment)
  }
  json(field)
}

function validateExpansion(resources: Record<string, unknown>[], edges: Record<string, unknown>[], expanded: ObjectValue, root: string): void {
  const selected = resources.flatMap(resource => {
    const document = object(JSON.parse(string(resource.bytes)))
    return array(document.settings ?? document.tokenColors ?? [])
  })
  assert.deepEqual(expanded.settings, selected, 'explicit authored base-first selected-rule expansion')
  assert.equal(edges.length, 1, 'bounded one-include fixture')
  assert.equal(edges[0]?.from, root); assert.equal(edges[0]?.to, resources[0]?.id); assert.equal(edges[0]?.ordinal, 0)
  assert.equal(resources.at(-1)?.id, root)
  const local = object(JSON.parse(string(resources.at(-1)?.bytes)))
  assert.equal(local.include, './base.json', 'authorized authored include spelling')
  assert.deepEqual(expanded.colors, local.colors)
  assert.equal(expanded.name, local.name); assert.equal(expanded.type, local.type)
}

function field(value: unknown, kind: 'color' | 'font'): void {
  const data = object(value)
  assert(data.kind === 'set' || data.kind === 'inherit')
  if (data.kind === 'inherit') { assert.deepEqual(data, { kind: 'inherit' }); return }
  if (kind === 'font') { integer(data.value); assert(Number(data.value) <= 15); return }
  assert(/^#[a-f\d]{8}$/.test(string(data.value)))
}

function effective(value: unknown, background: boolean): void {
  const data = object(value)
  assert(/^#[a-f\d]{8}$/.test(string(data.foreground))); integer(data.fontMask); assert(Number(data.fontMask) <= 15)
  if (background) assert(/^#[a-f\d]{8}$/.test(string(data.background)))
  else assert(!('background' in data), 'product projection excludes background')
  if (data.fontStyle === 'reset') { assert.equal(data.fontMask, 0); return }
  const flags = object(data.fontStyle)
  assert(Object.entries(flags).every(([key, value]) => ['italic', 'bold', 'underline', 'strikethrough'].includes(key) && value === true))
}

function validateObservation(value: unknown, profile: unknown): void {
  const row = object(value)
  string(row.id); const scopes = array(row.scopes).map(string)
  effective(row.effective, true); effective(row.applied, profile === 'raw')
  const trace = array(row.trace).map(object)
  assert.equal(trace.length, scopes.length)
  for (const [index, entry] of trace.entries()) {
    assert.equal(entry.scope, scopes[index])
    const partial = object(entry.partial)
    field(partial.foreground, 'color'); field(partial.background, 'color'); field(partial.fontMask, 'font')
  }
  json(row.upstreamPartial)
  if (scopes.length === 0) { assert.equal(row.direct, null); return }
  const direct = object(row.direct)
  const grammar = object(direct.grammar)
  assert.equal(grammar.scopeName, 'source.native-theme'); array(grammar.patterns); integer(direct.at)
  array(direct.rawScopes)
  string(direct.text); array(direct.raw); array(direct.rawFork); array(direct.product); json(direct.shikiApi)
}

function validateAttempt(value: unknown): void {
  const attempt = object(value)
  assert(attempt.profile === 'raw' || attempt.profile === 'product'); assert(attempt.view === 'full' || attempt.view === 'typed-projection')
  jsonObject(attempt.registration)
  const result = object(attempt.result)
  if (result.kind === 'error') { string(result.stage); string(result.name); string(result.message); return }
  assert.equal(result.kind, 'observed'); json(result.normalized); digest(result.normalizedIdentity)
  assert.equal(result.normalizedIdentity, identity('admission/normalized/v1', result.normalized))
  array(result.cases).forEach(row => validateObservation(row, attempt.profile))
}

export function validateAdmissionSuite(value: unknown): asserts value is AdmissionSuite {
  const suite = object(value)
  assert.equal(suite.schema, ADMISSION_SCHEMA); digest(suite.identity)
  assert.deepEqual(suite.projection, PROJECTION)
  const source = object(suite.source)
  assert.equal(source.commit, 'e961cc4dfe14e716e90694cda10378215be9e83b')
  Object.values(object(source.inputs)).forEach(digest)
  json(suite.targets); json(suite.transport)
  const fixtures = array(suite.fixtures).map(object)
  const ids: string[] = []
  for (const fixture of fixtures) {
    validateInput(fixture.input); ids.push(fixture.input.id)
    assert.equal(fixture.acquisitionIdentity, identity('admission/acquisition/v1', { root: fixture.input.root, resources: fixture.input.resources, edges: fixture.input.edges }))
    array(fixture.attempts).forEach(validateAttempt)
  }
  assert.equal(new Set(ids).size, ids.length, 'unique fixture identities')
  const { identity: _identity, ...body } = suite
  assert.equal(suite.identity, identity('admission/suite/v1', body), 'complete suite identity')
}

export function loadAdmissionSuite(bytes = readFileSync(new URL('suite.json', ADMISSION_ROOT), 'utf8')): AdmissionSuite {
  const value: unknown = JSON.parse(bytes)
  validateAdmissionSuite(value)
  assert.equal(bytes, encodeSuite(value), 'deterministic serialized format')
  return value
}
