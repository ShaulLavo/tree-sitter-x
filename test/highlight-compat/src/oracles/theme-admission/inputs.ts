import { createHash } from 'node:crypto'
import { CONTRACT_AUTHORITY, type Admission, type AdmissionInput, type AdmissionSuite, type Json, type ObjectValue, type ResourceLocation, type Warning } from './schema.ts'

export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
export const canonical = (value: unknown): string => JSON.stringify(value)
export const identity = (domain: string, value: unknown): string => sha256(`${domain}\0${canonical(value)}`)
export const pointer = (key: string): string => key.replaceAll('~', '~0').replaceAll('/', '~1')
export const resourceLocation = (resource: string, jsonPointer: string): ResourceLocation => ({ kind: 'resource', resource, jsonPointer, byteOffset: null })
const root = 'admission:/root'
const base = 'admission:/base'
const stacks = [
  { id: 'defaults', scopes: [] },
  { id: 'default-child', scopes: ['source.native-theme', 'variable.child'] },
  { id: 'parent-child', scopes: ['source.native-theme', 'meta.parent', 'variable.child'] },
]
const ok = (warnings: readonly Warning[] = []): Admission => ({ kind: 'ok', warnings })
const settingLocation = (property: string): Json => ({ kind: 'setting', resource: root, rule: 2, alternative: 0, property })
const rejectedFont = (kind: 'invalid' | 'unsupported', code = 'font-style'): Admission => ({ kind, code, location: settingLocation('fontStyle') })
const warning = (property: string, path: string, resource = root): Warning => ({ kind: 'outside-score', resource, property, location: resourceLocation(resource, path) })
const defaults = { settings: { foreground: '#778899', background: '#334455', fontStyle: 'underline' } }
const parent = { scope: 'meta.parent', settings: { foreground: '#223344', background: '#112233', fontStyle: 'bold' } }

function theme(child: ObjectValue, explicit = true): ObjectValue {
  const rules: Json[] = explicit ? [defaults, parent] : [parent]
  return { name: 'admission', type: 'dark', tokenColors: rules.concat([{ scope: 'variable.child', settings: child }]) }
}

function single(id: string, group: string, document: ObjectValue, admission = ok(), projection: AdmissionInput['projection'] = 'none', shikiApi = false): AdmissionInput {
  const bytes = `${JSON.stringify(document)}\n`
  return { id, group, root, resources: [{ id: root, bytes, sha256: sha256(bytes) }], edges: [], baseFirst: [root], expanded: structuredClone(document),
    stacks: matrix(group), contract: { authority: CONTRACT_AUTHORITY, admission }, projection, shikiApi }
}

function matrix(group: string): AdmissionInput['stacks'] {
  if (group === 'auxiliary-alternatives') return stacks.concat([{ id: 'second-alternative', scopes: ['source.native-theme', 'variable.other'] }])
  if (group.startsWith('font-') || group.startsWith('auxiliary')) return stacks
  return [stacks[0], stacks[2]].filter((stack): stack is typeof stacks[number] => stack !== undefined)
}

export function encodeSuite(suite: AdmissionSuite): string {
  const fields = Object.entries(suite).map(([key, value]) => {
    if (key !== 'fixtures') return `  ${JSON.stringify(key)}:${canonical(value)}`
    return `  "fixtures":[\n${suite.fixtures.map(fixture => `    ${canonical(fixture)}`).join(',\n')}\n  ]`
  })
  return `{\n${fields.join(',\n')}\n}\n`
}

function fonts(): AdmissionInput[] {
  const forms = ['', 'normal', 'regular', 'none', 'italic', 'bold', 'underline', 'strikethrough',
    'normal italic', 'regular italic', 'none italic', 'bold normal italic', 'bold regular italic', 'bold none italic',
    'italic bold underline strikethrough', 'strikethrough underline bold italic', 'bold bold italic', 'bold  italic', ' italic ',
    '  normal  regular none  ', 'bold normal', 'bold none', 'bold regular']
  const valid = forms.map((fontStyle, index) => single(`font-${index}`, 'font-admitted', theme({ fontStyle }), ok(), 'none', ['', 'normal', 'regular', 'none', 'bold normal italic', 'bold  italic'].includes(fontStyle)))
  const bad: readonly [Json, 'invalid' | 'unsupported', string][] = [
    [' ', 'invalid', 'font-style'], ['\t', 'invalid', 'font-style'], ['bold\titalic', 'invalid', 'font-style'],
    ['bold\ritalic', 'invalid', 'font-style'], ['bold\nitalic', 'invalid', 'font-style'], ['bold\fitalic', 'invalid', 'font-style'],
    ['bold\vitalic', 'invalid', 'font-style'], ['\u00a0italic', 'invalid', 'font-style'], ['Bold', 'unsupported', 'font-style'],
    ['other', 'unsupported', 'font-style'], ['italic other', 'unsupported', 'font-style'], ['oblique', 'unsupported', 'font-style'],
    [null, 'invalid', 'schema'], [1, 'invalid', 'schema'], [true, 'invalid', 'schema'], [[], 'invalid', 'schema'], [{}, 'invalid', 'schema'],
  ]
  return [single('font-missing', 'font-admitted', theme({}), ok(), 'none', true)].concat(valid,
    bad.map(([fontStyle, kind, code], index) => single(`font-reject-${index}`, 'font-contract-reject', theme({ fontStyle }), rejectedFont(kind, code))))
}

function auxiliary(): AdmissionInput[] {
  return ['content', 'text-decoration', '-webkit-font-smoothing'].flatMap(key => {
    const path = `/tokenColors/2/settings/${key}`
    const observedValue = key === 'text-decoration' ? 'underline' : 'synthetic'
    const fields = [{ [key]: observedValue }, { [key]: observedValue, foreground: '#0000', fontStyle: 'none' }, { [key]: observedValue, background: '#0000' }]
    const valid = fields.map((setting, index) => single(`aux-${key}-${index}`, 'auxiliary', theme(setting), ok([warning(key, path)]), 'none', true))
    const invalid = [null, 1, false, [], {}].map((value, index) => single(`aux-${key}-reject-${index}`, 'auxiliary-contract-reject', theme({ [key]: value }),
      { kind: 'invalid', code: 'schema', location: { ...resourceLocation(root, path) } }))
    const repeat = theme({ [key]: observedValue })
    repeat.tokenColors = [defaults, parent, { scope: ['variable.child', 'variable.other'], settings: { [key]: observedValue } },
      { scope: 'variable.child', settings: { foreground: '#abcdef', fontStyle: 'italic' } }]
    const global = theme({}); global.tokenColors = [{ settings: { ...defaults.settings, [key]: observedValue } }, parent, { scope: 'variable.child', settings: {} }]
    return valid.concat(invalid, [single(`aux-${key}-repeat`, 'auxiliary-alternatives', repeat, ok([warning(key, path)])),
      single(`aux-${key}-global`, 'auxiliary-default', global, ok([warning(key, `/tokenColors/0/settings/${key}`)]))])
  })
}

function uiCase(key: string, value: Json, explicit: boolean, id: string): AdmissionInput {
  const document = theme({ foreground: '#0000' }, explicit)
  document.colors = { [key]: value }
  const property = `colors/${key}`
  const legacy = { kind: 'outside-score', resource: root, property } as const
  const warnings = typeof value === 'string' ? [legacy] : [warning(property, `/colors/${pointer(key)}`)]
  return single(id, 'untouched-ui', document, ok(warnings), 'untouched-ui')
}

function ui(): AdmissionInput[] {
  const forms: readonly Json[] = [null, [], ['red', 'var(--synthetic)', ''], 'var(--synthetic)', '']
  const positive = [false, true].flatMap(explicit => forms.map((value, index) => uiCase('activityBar.background', value, explicit, `ui-${explicit}-${index}`)))
  const escaped = ['a~/b', '__proto__', 'constructor', 'symbolIcon.constantForeground'].map((key, index) => uiCase(key, [null, [], ['#fff'], null][index] ?? null, true, `ui-key-${index}`))
  const invalid = [1, false, {}, [1], [['x']], ['x', null]].map((value, index) => {
    const document = theme({}); document.colors = { 'activityBar.background': value }
    return single(`ui-reject-${index}`, 'ui-contract-reject', document, { kind: 'invalid', code: 'schema', location: { kind: 'resource', resource: root, jsonPointer: '/colors/activityBar.background', byteOffset: null } })
  })
  const consumed = ['editor.foreground', 'editor.background', 'terminal.ansiRed', 'terminal.ansiBogus'].flatMap(key => consumedCases(key))
  const malformed = [null, [], 4].map((value, index) => {
    const document = theme({}); document.colors = value
    return single(`colors-container-${index}`, 'malformed-container', document, { kind: 'invalid', code: 'schema', location: { kind: 'resource', resource: root, jsonPointer: '/colors', byteOffset: null } })
  })
  return positive.concat(escaped, invalid, consumed, malformed)
}

function consumedCases(key: string): AdmissionInput[] {
  return [false, true].flatMap(explicit => [null, ['#123456'], 1].map((value, index) => consumedCase(key, value, explicit, index)))
}

function consumedCase(key: string, value: Json, explicit: boolean, index: number): AdmissionInput {
  const document = theme({}, explicit); document.colors = { [key]: value }
  return single(`consumed-${key}-${explicit}-${index}`, 'consumed-ui-negative', document, { kind: 'invalid', code: 'schema', location: { kind: 'resource', resource: root, jsonPointer: `/colors/${pointer(key)}`, byteOffset: null } })
}

function included(key: string): AdmissionInput[] {
  const baseDocument: ObjectValue = { name: 'base', type: 'light', settings: [defaults, parent, { scope: 'variable.child', settings: { [key]: 'base', foreground: '#abcdef' } }],
    tokenColors: [{ scope: 'unselected *', settings: { [key]: 'base-unselected' } }] }
  const localDocument: ObjectValue = { name: 'admission', type: 'dark', include: './base.json', settings: [{ scope: 'variable.child', settings: { [key]: 'root', fontStyle: 'normal' } }],
    tokenColors: [{ scope: 'unselected *', settings: { [key]: 'root-unselected' } }], colors: { 'a~/b': null } }
  const baseBytes = `${JSON.stringify(baseDocument)}\n`, localBytes = `${JSON.stringify(localDocument)}\n`
  const expanded: ObjectValue = { name: 'admission', type: 'dark', settings: [defaults, parent, { scope: 'variable.child', settings: { [key]: 'base', foreground: '#abcdef' } },
    { scope: 'variable.child', settings: { [key]: 'root', fontStyle: 'normal' } }], colors: { 'a~/b': null } }
  const warnings = [warning(key, `/settings/2/settings/${key}`, base), warning(key, `/tokenColors/0/settings/${key}`, base),
    warning(key, `/settings/0/settings/${key}`), warning(key, `/tokenColors/0/settings/${key}`), warning('colors/a~/b', '/colors/a~0~1b')]
  const common = single(`included-both-arrays-${key}`, 'source-provenance', expanded, ok(warnings), 'untouched-ui')
  const include: AdmissionInput = { ...common, resources: [{ id: base, bytes: baseBytes, sha256: sha256(baseBytes) }, { id: root, bytes: localBytes, sha256: sha256(localBytes) }],
    edges: [{ from: root, to: base, ordinal: 0 }], baseFirst: [base, root], expanded }
  const unselected: ObjectValue = { name: 'admission', type: 'dark', settings: [], tokenColors: [{ scope: '*', settings: { content: 'unselected' } }] }
  if (key !== 'content') return [include]
  const changedBase = ` ${baseBytes}`
  const byteAlias: AdmissionInput = { ...include, id: 'included-byte-alias', resources: [{ id: base, bytes: changedBase, sha256: sha256(changedBase) }, { id: root, bytes: localBytes, sha256: sha256(localBytes) }] }
  return [include, byteAlias, single('unselected-only', 'source-provenance', unselected, ok([warning('content', '/tokenColors/0/settings/content')])),
    single('equal-array-ordinals', 'source-provenance', { name: 'admission', type: 'dark', settings: [{ scope: 'variable.child', settings: { content: 'selected' } }],
      tokenColors: [{ scope: '*', settings: { content: 'unselected' } }] }, ok([warning('content', '/settings/0/settings/content'), warning('content', '/tokenColors/0/settings/content')]))]
}

function unsupported(): AdmissionInput[] {
  const unknowns = [{ fontFamily: 'Fira Code' }, { fontSize: 14 }, { lineHeight: 1.5 }, { arbitrary: 'inert-not-admitted' }]
  const keys = unknowns.map((setting, index) => single(`unknown-${index}`, 'unadmitted-property', theme(setting), { kind: 'unsupported', code: 'syntax-property', location: settingLocation(Object.keys(setting)[0]) }))
  const selectors = ['variable.child *', 'variable.child | other', 'variable.child - other']
  return keys.concat(selectors.map((scope, index) => single(`unsupported-selector-${index}`, 'unsupported-selector',
    { name: 'admission', type: 'dark', tokenColors: [{ scope, settings: { content: 'not-a-selector-exemption' } }] },
    { kind: 'unsupported', code: 'selector', location: { kind: 'setting', resource: root, rule: 0, alternative: 0, property: 'scope' } })))
}

export function admissionInputs(): AdmissionInput[] { return fonts().concat(auxiliary(), ui(),
  ['content', 'text-decoration', '-webkit-font-smoothing'].flatMap(included), unsupported(), [single('unselected-invalid-auxiliary', 'source-provenance',
    { name: 'admission', type: 'dark', settings: [], tokenColors: [{ scope: '*', settings: { content: 1 } }] },
    { kind: 'invalid', code: 'schema', location: { ...resourceLocation(root, '/tokenColors/0/settings/content') } })]) }

export function transportControls(): Json {
  const located = warning('content', '/settings/0/settings/content')
  const escaped = warning('colors/a~/b', '/colors/a~0~1b')
  const legacy = { kind: 'outside-score', resource: root, property: 'semanticHighlighting' }
  const fields: Json[] = [located, escaped, legacy].map(value => JSON.parse(JSON.stringify(value)))
  return { authority: CONTRACT_AUTHORITY, purpose: 'authored future reply/retain/readback requirements; no collector execution or target warning claim',
    successes: ['complete', 'failed'].map(status => ({ status, warnings: fields, expectedWarnings: fields, paths: ['live-reply', 'retained-request-readback'] })),
    rejectedLocations: [null, {}, { ...located.location, resource: base }, { ...located.location, jsonPointer: '/colors/a~2b' },
      { ...located.location, byteOffset: -1 }, { kind: 'unknown' }, { kind: 'setting', resource: root, rule: -1, alternative: null, property: 'content' },
      { kind: 'packet', byteOffset: '0' }, { kind: 'packet', byteOffset: -1 }, { kind: 'packet', byteOffset: 0.5 },
      { kind: 'resource', resource: root, jsonPointer: '/colors/x' },
      { kind: 'setting', resource: root, rule: 0, alternative: '0', property: 'content' },
      { kind: 'setting', resource: root, rule: 0.5, alternative: null, property: 'content' },
      { kind: 'setting', resource: root, rule: 0, alternative: null, property: 1 }],
    validLocationUnion: [{ kind: 'resource', resource: root, jsonPointer: '', byteOffset: null }, { kind: 'resource', resource: root, jsonPointer: '/colors/a~0~1b', byteOffset: null },
      { kind: 'resource', resource: root, jsonPointer: '/colors/a~0~1b', byteOffset: 0 },
      { kind: 'setting', resource: root, rule: 0, alternative: null, property: 'content' },
      { kind: 'setting', resource: root, rule: 0, alternative: 1, property: 'scope' }, { kind: 'packet', byteOffset: 0 }, { kind: 'request' }],
    selectedStream: 'settings ?? tokenColors per resource', unselected: 'schema/property/warning validation only, no selector or native-rule-budget charge' }
}
