import type { DocumentResult, Style } from './schema.ts'
import { isProfileId, PROFILE_ID_GRAMMAR } from './schema.ts'
import { sourceSha256 } from './source.ts'
import { styleKey } from './style.ts'

export type Validation =
  | { readonly ok: true; readonly result: DocumentResult }
  | { readonly ok: false; readonly errors: readonly string[] }

type Json = Readonly<Record<string, unknown>>

const MAX_ERRORS = 100
const COMMON_KEYS = [
  'schema',
  'profileId',
  'languageId',
  'sourceSha256',
  'sourceLength',
  'documentRevision',
  'status',
  'diagnostics',
  'engine',
  'scopeNames',
  'paths',
  'spans',
] as const
const COMPLETE_KEYS = ['metadata', 'styles'] as const
const ALL_KEYS: readonly string[] = [...COMMON_KEYS, ...COMPLETE_KEYS]
const STATUSES = ['complete', 'unsupported', 'timeout', 'error', 'canceled']
const LANGUAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._+#-]*$/
const SHA256 = /^[0-9a-f]{64}$/
const NAME = /^\S+$/
const COLOR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/
const STYLE_KEYS = ['foreground', 'background', 'fontStyle']
const FONT_FLAGS = ['bold', 'italic', 'underline', 'strikethrough']
const FIRST_USE = 'values must be interned in first-use order (build results with ResultBuilder)'

class Errors {
  readonly #items: string[] = []
  #dropped = 0

  get count(): number {
    return this.#items.length + this.#dropped
  }

  add(message: string): void {
    if (this.#items.length < MAX_ERRORS) this.#items.push(message)
    else this.#dropped++
  }

  list(): readonly string[] {
    if (this.#dropped === 0) return this.#items
    return [...this.#items, `... ${this.#dropped} more`]
  }
}

interface Track {
  readonly at: string
  readonly values: string
  readonly noun: string
  readonly count: number
  readonly length: number
}

const show = (value: unknown): string => (value === undefined ? 'undefined' : JSON.stringify(value))

function isObject(value: unknown): value is Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

function checkExactKeys(value: Json, at: string, allowed: readonly string[], required: readonly string[], errors: Errors): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.add(`${at}: unknown key ${show(key)}`)
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.add(`${at}: missing key ${show(key)}`)
  }
}

/** forEach skips holes and find reports them as undefined, so every table is checked for holes first. */
function checkDense(value: unknown, at: string, expected: string, errors: Errors): value is readonly unknown[] {
  if (!Array.isArray(value)) {
    errors.add(`${at}: expected ${expected}, got ${show(value)}`)
    return false
  }
  for (let i = 0; i < value.length; i++) {
    if (Object.hasOwn(value, i)) continue
    errors.add(`${at}[${i}]: hole in array`)
    return false
  }
  return true
}

function checkStringArray(value: unknown, at: string, errors: Errors): value is readonly string[] {
  if (!checkDense(value, at, 'an array of strings', errors)) return false
  const before = errors.count
  value.forEach((item: unknown, index) => {
    if (typeof item !== 'string') errors.add(`${at}[${index}]: expected a string, got ${show(item)}`)
  })
  return errors.count === before
}

function checkNames(value: unknown, at: string, pattern: RegExp, errors: Errors): value is readonly string[] {
  if (!checkStringArray(value, at, errors)) return false
  const before = errors.count
  const seen = new Map<string, number>()
  value.forEach((name, index) => {
    if (!pattern.test(name)) errors.add(`${at}[${index}]: ${show(name)} does not match ${pattern}`)
    const first = seen.get(name)
    if (first !== undefined) errors.add(`${at}[${index}]: duplicate of ${at}[${first}] ${show(name)}`)
    else seen.set(name, index)
  })
  return errors.count === before
}

type FieldCheck = (value: unknown, at: string, errors: Errors) => void

function field(test: (value: unknown) => boolean, description: string): FieldCheck {
  return (value, at, errors) => {
    if (!test(value)) errors.add(`${at}: expected ${description}, got ${show(value)}`)
  }
}

function checkEngine(value: unknown, at: string, errors: Errors): void {
  if (!isObject(value)) {
    errors.add(`${at}: expected an object of strings, got ${show(value)}`)
    return
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') errors.add(`${at}.${key}: expected a string, got ${show(item)}`)
  }
}

const HEADER_CHECKS: readonly (readonly [string, FieldCheck])[] = [
  ['schema', field((value) => value === 1, '1')],
  ['profileId', field((value) => typeof value === 'string' && isProfileId(value), PROFILE_ID_GRAMMAR)],
  ['languageId', field((value) => typeof value === 'string' && LANGUAGE_ID.test(value), `a string matching ${LANGUAGE_ID}`)],
  ['sourceSha256', field((value) => typeof value === 'string' && SHA256.test(value), '64 lowercase hex digits')],
  ['sourceLength', field(isCount, 'a non-negative safe integer')],
  ['documentRevision', field(isCount, 'a non-negative safe integer')],
  ['status', field((value) => typeof value === 'string' && STATUSES.includes(value), `one of ${STATUSES.join(', ')}`)],
  ['diagnostics', (value, at, errors) => void checkStringArray(value, at, errors)],
  ['engine', checkEngine],
]

function checkHeader(value: Json, errors: Errors): void {
  for (const [key, check] of HEADER_CHECKS) {
    if (Object.hasOwn(value, key)) check(value[key], key, errors)
  }
}

function checkIncomplete(value: Json, status: string, errors: Errors): void {
  for (const key of ['scopeNames', 'paths', 'spans']) {
    const item = value[key]
    if (!Array.isArray(item)) errors.add(`${key}: expected [] when status is ${status}, got ${show(item)}`)
    else if (item.length > 0) errors.add(`${key}: status ${status} carries ${item.length} entries; partial output cannot be recorded as a result`)
  }
  for (const key of COMPLETE_KEYS) {
    if (Object.hasOwn(value, key)) errors.add(`${key}: not allowed when status is ${status}; partial output cannot be recorded as a result`)
  }
  const diagnostics = value['diagnostics']
  if (Array.isArray(diagnostics) && diagnostics.length === 0) {
    errors.add(`diagnostics: status ${status} needs at least one diagnostic saying why`)
  }
}

function checkSpanShape(spans: unknown, track: Track, errors: Errors): spans is readonly number[] {
  if (!checkDense(spans, track.at, 'an array of integers', errors)) return false
  const bad = spans.findIndex((item: unknown) => !Number.isSafeInteger(item))
  if (bad !== -1) {
    errors.add(`${track.at}[${Math.floor(bad / 3)}]: expected integer triples, element ${bad} is ${show(spans[bad])}`)
    return false
  }
  if (spans.length % 3 !== 0) {
    errors.add(`${track.at}: length ${spans.length} is not a multiple of 3`)
    return false
  }
  return true
}

function checkTriple(spans: readonly number[], i: number, previousTo: number, track: Track, errors: Errors): void {
  const from = spans[i]
  const to = spans[i + 1]
  const value = spans[i + 2]
  const at = `${track.at}[${i / 3}]`
  if (i === 0 && from > 0) errors.add(`${at}: gap at start: first span starts at ${from}`)
  if (i > 0 && from < previousTo) errors.add(`${at}: from ${from} overlaps previous span ending at ${previousTo} (overlap or unsorted)`)
  if (i > 0 && from > previousTo) errors.add(`${at}: gap from ${previousTo} to ${from}`)
  if (from >= to) errors.add(`${at}: empty or inverted span [${from}, ${to})`)
  if (from < 0 || to > track.length) errors.add(`${at}: [${from}, ${to}) out of range [0, ${track.length})`)
  if (value < 0 || value >= track.count) errors.add(`${at}: ${track.noun} index ${value} out of range (${track.count} ${track.values})`)
}

function checkFirstUse(spans: readonly number[], track: Track, errors: Errors): void {
  let next = 0
  for (let i = 0; i < spans.length; i += 3) {
    const value = spans[i + 2]
    if (value < next) continue
    if (value > next) {
      errors.add(`${track.at}[${i / 3}]: ${track.noun} ${value} is used before ${track.noun} ${next}; ${FIRST_USE}`)
      return
    }
    next++
  }
  if (next < track.count) errors.add(`${track.values}[${next}]: never used by ${track.at}; ${FIRST_USE}`)
}

/** Checks that `spans` tiles `[0, track.length)` and interns its values in first-use order. */
function checkTrack(spans: unknown, track: Track, errors: Errors): void {
  if (!checkSpanShape(spans, track, errors)) return
  const before = errors.count
  let previousTo = 0
  for (let i = 0; i < spans.length; i += 3) {
    checkTriple(spans, i, previousTo, track, errors)
    previousTo = spans[i + 1]
  }
  if (previousTo < track.length) errors.add(`${track.at}: clipped: ends at ${previousTo} of ${track.length}`)
  if (errors.count === before) checkFirstUse(spans, track, errors)
}

function checkPath(path: unknown, index: number, nameCount: number, errors: Errors): path is readonly number[] {
  if (!checkDense(path, `paths[${index}]`, 'an array of scope name indices', errors)) return false
  const bad = path.findIndex((item: unknown) => !Number.isSafeInteger(item) || Number(item) < 0 || Number(item) >= nameCount)
  if (bad === -1) return true
  errors.add(`paths[${index}]: scope name index ${show(path[bad])} out of range (${nameCount} scopeNames)`)
  return false
}

function checkPaths(value: unknown, nameCount: number, errors: Errors): value is readonly (readonly number[])[] {
  if (!checkDense(value, 'paths', 'an array of paths', errors)) return false
  const before = errors.count
  const seen = new Map<string, number>()
  value.forEach((path: unknown, index) => {
    if (!checkPath(path, index, nameCount, errors)) return
    const key = path.join(',')
    const first = seen.get(key)
    if (first !== undefined) errors.add(`paths[${index}]: duplicate of paths[${first}] [${key}]`)
    else seen.set(key, index)
  })
  return errors.count === before
}

function checkNameFirstUse(paths: readonly (readonly number[])[], nameCount: number, errors: Errors): void {
  let next = 0
  for (let p = 0; p < paths.length; p++) {
    for (const name of paths[p]) {
      if (name < next) continue
      if (name > next) {
        errors.add(`paths[${p}]: scope name ${name} is used before scope name ${next}; ${FIRST_USE}`)
        return
      }
      next++
    }
  }
  if (next < nameCount) errors.add(`scopeNames[${next}]: never used by paths; ${FIRST_USE}`)
}

function checkScopes(value: Json, length: number, errors: Errors): void {
  const names = value['scopeNames']
  if (!checkNames(names, 'scopeNames', NAME, errors)) return
  const paths = value['paths']
  if (!checkPaths(paths, names.length, errors)) return
  checkNameFirstUse(paths, names.length, errors)
  checkTrack(value['spans'], { at: 'spans', values: 'paths', noun: 'path', count: paths.length, length }, errors)
}

function checkMetadata(value: unknown, length: number, errors: Errors): void {
  if (!isObject(value)) {
    errors.add(`metadata: expected an object, got ${show(value)}`)
    return
  }
  checkExactKeys(value, 'metadata', ['languageIds', 'spans'], ['languageIds', 'spans'], errors)
  const languageIds = value['languageIds']
  if (!checkNames(languageIds, 'metadata.languageIds', LANGUAGE_ID, errors)) return
  const track = { at: 'metadata.spans', values: 'metadata.languageIds', noun: 'language', count: languageIds.length, length }
  checkTrack(value['spans'], track, errors)
}

function checkFontStyle(value: unknown, at: string, errors: Errors): void {
  if (value === 'reset') return
  if (!isObject(value) || Object.keys(value).length === 0) {
    errors.add(`${at}: expected "reset" or a non-empty object of flags, got ${show(value)}`)
    return
  }
  for (const [flag, item] of Object.entries(value)) {
    if (!FONT_FLAGS.includes(flag)) errors.add(`${at}: unknown flag ${show(flag)}`)
    else if (item !== true) errors.add(`${at}.${flag}: expected true, got ${show(item)}`)
  }
}

function checkStyle(value: unknown, at: string, errors: Errors): value is Style {
  if (!isObject(value)) {
    errors.add(`${at}: expected an object, got ${show(value)}`)
    return false
  }
  const before = errors.count
  checkExactKeys(value, at, STYLE_KEYS, [], errors)
  for (const key of ['foreground', 'background']) {
    const color = value[key]
    if (color !== undefined && (typeof color !== 'string' || !COLOR.test(color))) {
      errors.add(`${at}.${key}: expected lowercase #rrggbb or #rrggbbaa, got ${show(color)}`)
    }
  }
  if (Object.hasOwn(value, 'fontStyle')) checkFontStyle(value['fontStyle'], `${at}.fontStyle`, errors)
  return errors.count === before
}

function checkStyleList(value: unknown, at: string, errors: Errors): value is readonly Style[] {
  if (!checkDense(value, at, 'an array of styles', errors)) return false
  const before = errors.count
  const seen = new Map<string, number>()
  value.forEach((style: unknown, index) => {
    if (!checkStyle(style, `${at}[${index}]`, errors)) return
    const key = styleKey(style)
    const first = seen.get(key)
    if (first !== undefined) errors.add(`${at}[${index}]: duplicate of ${at}[${first}] ${show(style)}`)
    else seen.set(key, index)
  })
  return errors.count === before
}

function checkTheme(themeId: string, value: unknown, length: number, errors: Errors): void {
  const at = `styles.${themeId}`
  if (!NAME.test(themeId)) errors.add(`styles: theme id ${show(themeId)} does not match ${NAME}`)
  if (!isObject(value)) {
    errors.add(`${at}: expected an object, got ${show(value)}`)
    return
  }
  checkExactKeys(value, at, ['styles', 'spans'], ['styles', 'spans'], errors)
  const styles = value['styles']
  if (!checkStyleList(styles, `${at}.styles`, errors)) return
  checkTrack(value['spans'], { at: `${at}.spans`, values: `${at}.styles`, noun: 'style', count: styles.length, length }, errors)
}

function checkStyles(value: unknown, length: number, errors: Errors): void {
  if (!isObject(value)) {
    errors.add(`styles: expected an object keyed by theme id, got ${show(value)}`)
    return
  }
  for (const [themeId, theme] of Object.entries(value)) checkTheme(themeId, theme, length, errors)
}

function checkComplete(value: Json, errors: Errors): void {
  const length = value['sourceLength']
  if (!isCount(length)) return
  checkScopes(value, length, errors)
  if (Object.hasOwn(value, 'metadata')) checkMetadata(value['metadata'], length, errors)
  if (Object.hasOwn(value, 'styles')) checkStyles(value['styles'], length, errors)
}

function checkSource(value: Json, source: string, errors: Errors): void {
  if (value['sourceLength'] !== source.length) {
    errors.add(`sourceLength: ${show(value['sourceLength'])} does not match the source length ${source.length}`)
  }
  const hash = sourceSha256(source)
  if (value['sourceSha256'] !== hash) errors.add(`sourceSha256: ${show(value['sourceSha256'])} does not match the source hash ${hash}`)
}

export const isScopeName = (name: string): boolean => NAME.test(name)
export const isThemeId = (themeId: string): boolean => NAME.test(themeId)
export const isLanguageId = (languageId: string): boolean => LANGUAGE_ID.test(languageId)

export function styleErrors(style: unknown): readonly string[] {
  const errors = new Errors()
  checkStyle(style, 'style', errors)
  return errors.list()
}

export function validateResult(value: unknown, source?: string): Validation {
  const errors = new Errors()
  if (!isObject(value)) return { ok: false, errors: [`result: expected an object, got ${show(value)}`] }
  const status = value['status']
  checkExactKeys(value, 'result', ALL_KEYS, COMMON_KEYS, errors)
  checkHeader(value, errors)
  if (status === 'complete') checkComplete(value, errors)
  else if (typeof status === 'string' && STATUSES.includes(status)) checkIncomplete(value, status, errors)
  if (source !== undefined) checkSource(value, source, errors)
  if (errors.count > 0) return { ok: false, errors: errors.list() }
  return { ok: true, result: validated(value) }
}

/** The one narrowing of parsed JSON, reached only after every rule passed. */
const validated = (value: unknown): DocumentResult => value as DocumentResult

export function parseResult(value: unknown, source?: string): DocumentResult {
  const validation = validateResult(value, source)
  if (validation.ok) return validation.result
  throw new Error(`invalid result:\n${validation.errors.map((error) => `  ${error}`).join('\n')}`)
}
