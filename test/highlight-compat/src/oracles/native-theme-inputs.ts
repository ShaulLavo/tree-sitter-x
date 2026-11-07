import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { IRawTheme } from '@shikijs/vscode-textmate'
import type { ThemeModule } from './assets.ts'
import { NATIVE_THEME_MANIFEST, type NativeThemeInput, type NativeThemeSource, type NativeThemeStack } from './native-theme-schema.ts'

export function nativeThemeDigest(domain: string, fields: readonly string[]): string {
  const hash = createHash('sha256')
  for (const field of [domain].concat(fields)) {
    const bytes = Buffer.from(field)
    const length = Buffer.alloc(4)
    length.writeUInt32BE(bytes.length)
    hash.update(length).update(bytes)
  }
  return hash.digest('hex')
}

export const nativeThemeSha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

function record(value: unknown): Record<string, unknown> {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), 'fixture object')
  return Object.fromEntries(Object.entries(value))
}

function syntaxRule(value: unknown): IRawTheme['settings'][number] {
  const item = record(value)
  const settings = record(item.settings)
  assert(Object.values(settings).every(field => typeof field === 'string'), 'fixture syntax fields are strings')
  const scope = item.scope
  assert(scope === undefined || typeof scope === 'string' || (Array.isArray(scope) && scope.every((part: unknown) => typeof part === 'string')), 'fixture selector')
  return scope === undefined ? { settings: Object.fromEntries(Object.entries(settings)) }
    : { scope, settings: Object.fromEntries(Object.entries(settings)) }
}

function syntaxRules(value: unknown): IRawTheme['settings'] | undefined {
  if (value === undefined) return undefined
  assert(Array.isArray(value), 'fixture rules')
  return Array.from(value, syntaxRule)
}

export function nativeThemeRegistration(bytes: string): ThemeModule {
  const value = record(JSON.parse(bytes))
  assert(typeof value.name === 'string', 'fixture name')
  assert(value.type === 'dark' || value.type === 'light', 'fixture type')
  const colors = value.colors === undefined ? {} : record(value.colors)
  const checkedColors = Object.fromEntries(Object.entries(colors).map(([key, color]) => {
    assert(typeof color === 'string', 'fixture color')
    return [key, color]
  }))
  const theme: ThemeModule = { name: value.name, type: value.type, colors: checkedColors }
  const settings = syntaxRules(value.settings), tokenColors = syntaxRules(value.tokenColors)
  if (settings !== undefined) theme.settings = settings
  if (tokenColors !== undefined) theme.tokenColors = tokenColors
  return theme
}

function source(file: string, id = `fixture:/${file}`): NativeThemeSource {
  const bytes = readFileSync(new URL(`themes/${file}.json`, NATIVE_THEME_MANIFEST), 'utf8')
  return { id, file: `themes/${file}.json`, bytes, sha256: nativeThemeSha256(bytes) }
}

function stacks(rows: readonly (readonly [string, ...string[]])[]): NativeThemeStack[] {
  return [{ id: 'empty', scopes: [] }, { id: 'root-default', scopes: ['source.native-theme'] }].concat(rows.map(([id, ...scopes]) => ({ id, scopes: ['source.native-theme'].concat(scopes) })))
}

const INHERITANCE = stacks([
  ['default-inherits', 'variable.unset'], ['parent-inherits', 'meta.parent', 'variable.unset'],
  ['default-clear', 'variable.clear'], ['parent-clear', 'meta.parent', 'variable.clear'],
  ['parent-replacement', 'meta.parent', 'variable.replace'], ['color-inherits-font', 'meta.parent', 'variable.color'],
  ['transparent-zero', 'meta.parent', 'variable.zero'], ['alpha', 'variable.alpha'],
  ['shorthand', 'variable.short'], ['duplicate-font-words', 'variable.duplicate'],
])

const CONTEXTS = stacks([
  ['ordered', 'meta.outer', 'meta.inner', 'variable'], ['reordered', 'meta.inner', 'meta.outer', 'variable'],
  ['missing', 'meta.inner', 'variable'], ['extra', 'meta.outer', 'gap', 'meta.inner', 'gap', 'variable'],
  ['tail-depth', 'meta.outer', 'meta.inner', 'variable.child.more'], ['dot-boundary', 'meta.outer', 'variableOther'],
  ['tail-prefix', 'variable.more'], ['immediate', 'a', 'variable.immediate'],
  ['ancestor-dot-prefix', 'a.more', 'variable.immediate'], ['ancestor-dot-boundary', 'aOther', 'variable.immediate'],
  ['immediate-gap', 'a', 'gap', 'variable.immediate'], ['repeat-present', 'a', 'a', 'variable.repeat'],
  ['repeat-missing', 'a', 'variable.repeat'], ['mixed', 'a', 'gap', 'b', 'c', 'gap', 'variable.mixed'],
  ['mixed-gap', 'a', 'b', 'gap', 'c', 'variable.mixed'], ['comma-first', 'comment.line'],
  ['greedy-nearest-fails', 'a', 'b', 'gap', 'b', 'variable.greedy'],
  ['greedy-adjacent', 'a', 'b', 'variable.greedy'],
  ['comma-second', 'string.quoted.double'], ['array-first', 'constant.numeric'], ['array-second', 'keyword.control'],
  ['context-hasOwnProperty', 'hasOwnProperty', 'variable.special'], ['context-proto', '__proto__', 'variable.special'],
  ['constructor', 'constructor'], ['constructor-component', 'scope.constructor.leaf'],
  ['nearest-name', 'far.long', 'far', 'near', 'near.long', 'variable.rank'],
  ['more-context', 'a', 'b', 'variable.length'], ['stable-tie', 'bbb', 'aaa', 'variable.tie'],
  ['stable-tie-reversed-path', 'aaa', 'bbb', 'variable.tie'],
  ['no-cross-context-merge', 'low', 'higher', 'variable.fields'],
])

function single(file: string, paths = INHERITANCE): NativeThemeInput {
  const input = source(file)
  return { id: file, root: input.id, resources: [input], edges: [], expanded: nativeThemeRegistration(input.bytes), stacks: paths, warnings: [] }
}

function included(changed: boolean): NativeThemeInput {
  const root = source('include-root'), base = source(changed ? 'include-base-changed' : 'include-base', 'fixture:/base')
  const expanded = source(changed ? 'include-expanded-changed' : 'include-expanded')
  return { id: changed ? 'included-changed' : 'included', root: root.id, resources: [base, root],
    edges: [{ from: root.id, to: base.id, ordinal: 0 }], expanded: nativeThemeRegistration(expanded.bytes),
    stacks: stacks([['base', 'variable'], ['child-clear', 'variable.clear']]), warnings: [] }
}

export function nativeThemeInputs(): NativeThemeInput[] {
  const outside = single('outside-score')
  const warnings: NativeThemeInput['warnings'] = ['semanticTokenColors', 'semanticHighlighting', 'iconTheme', 'colors/activityBar.background']
    .map(property => ({ kind: 'outside-score', resource: outside.root, property }))
  const palette = ['foreground', 'background'].map(role => single(`palette-${role}-253`, stacks([['last-color', 'probe.c252']])))
  return [single('inheritance'), single('inheritance-changed'), single('contexts', CONTEXTS),
    single('precedence'), single('empty-dark'), single('empty-light'), { ...outside, warnings }, included(false), included(true)].concat(palette)
}
