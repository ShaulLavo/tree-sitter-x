import type { FontStyle, Style } from './schema.ts'

const FONT_FLAGS = ['bold', 'italic', 'underline', 'strikethrough'] as const

function fontStyleKey(fontStyle: Style['fontStyle']): string {
  if (fontStyle === undefined) return ''
  if (fontStyle === 'reset') return 'reset'
  return FONT_FLAGS.filter((flag) => fontStyle[flag] === true).join('+')
}

/** Equal keys mean equal resolved styles; `fontStyle` absent and `'reset'` stay distinct. */
export function styleKey(style: Style): string {
  return `${style.foreground ?? ''}|${style.background ?? ''}|${fontStyleKey(style.fontStyle)}`
}

export function foregroundKey(style: Style): string {
  return style.foreground ?? ''
}

export function backgroundKey(style: Style): string {
  return style.background ?? ''
}

export function fontKey(style: Style): string {
  return fontStyleKey(style.fontStyle)
}

/** Rebuilds a style in canonical key order, dropping absent fields. */
export function canonicalStyle(style: Style): Style {
  const fontStyle = canonicalFontStyle(style.fontStyle)
  return {
    ...(style.foreground === undefined ? {} : { foreground: style.foreground }),
    ...(style.background === undefined ? {} : { background: style.background }),
    ...(fontStyle === undefined ? {} : { fontStyle }),
  }
}

function canonicalFontStyle(fontStyle: Style['fontStyle']): Style['fontStyle'] {
  if (fontStyle === undefined || fontStyle === 'reset') return fontStyle
  const flags: { -readonly [K in keyof FontStyle]: true } = {}
  for (const flag of FONT_FLAGS) {
    if (fontStyle[flag] === true) flags[flag] = true
  }
  return flags
}
