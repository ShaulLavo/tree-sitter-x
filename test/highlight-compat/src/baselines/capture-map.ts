export const CAPTURE_MAP_VERSION = 'capture-map-1'

export const CAPTURE_MAP: Readonly<Record<string, string | null>> = {
  attribute: 'entity.other.attribute-name',
  comment: 'comment',
  constant: 'constant',
  'constant.builtin': 'constant.language',
  constructor: 'entity.name.type',
  embedded: null,
  escape: 'constant.character.escape',
  function: 'entity.name.function',
  'function.builtin': 'support.function',
  'function.method': 'entity.name.function',
  keyword: 'keyword.control',
  'keyword.control': 'keyword.control',
  'keyword.declaration': 'storage.type',
  'keyword.import': 'keyword.control.import',
  'keyword.type': 'storage.type',
  namespace: 'entity.name.namespace',
  number: 'constant.numeric',
  operator: 'keyword.operator',
  property: 'variable.other.property',
  'punctuation.bracket': 'punctuation.section',
  'punctuation.delimiter': 'punctuation.separator',
  'punctuation.special': 'punctuation',
  string: 'string.quoted',
  'string.special': 'string.regexp',
  'string.special.key': 'support.type.property-name',
  tag: 'entity.name.tag',
  type: 'entity.name.type',
  'type.builtin': 'support.type',
  'type.definition': 'entity.name.type',
  'type.parameter': 'entity.name.type',
  variable: 'variable.other.readwrite',
  'variable.builtin': 'variable.language',
  'variable.parameter': 'variable.parameter',
}

export function captureScopes(name: string): readonly string[] {
  if (!Object.hasOwn(CAPTURE_MAP, name)) throw new Error(`unmapped capture ${name}`)
  const scope = CAPTURE_MAP[name]
  return scope === null ? [] : [scope as string]
}
