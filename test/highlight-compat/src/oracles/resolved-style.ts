import type { FontStyle, Style } from '../schema.ts'

const FLAGS: readonly (readonly [number, keyof FontStyle])[] = [
  [1, 'italic'],
  [2, 'bold'],
  [4, 'underline'],
  [8, 'strikethrough'],
]

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Lowercase `#rrggbb` or `#rrggbbaa`; TextMate colour maps keep a theme's own case and shorthand. */
export function normalizeColor(color: string): string {
  if (!HEX.test(color)) throw new RangeError(`colour ${JSON.stringify(color)} is not a hex colour`)
  const lower = color.toLowerCase()
  if (lower.length > 5) return lower
  return `#${[...lower.slice(1)].map((digit) => digit + digit).join('')}`
}

/**
 * One representation for every reference profile. An empty colour is an absent foreground; font
 * style 0 (none) and -1 (not set) are absent, because every oracle theme's default font style is none.
 * Background is left out: neither the product nor Shiki's token API applies it.
 */
export function resolvedStyle(color: string, fontStyle: number): Style {
  const flags: { -readonly [K in keyof FontStyle]: true } = {}
  for (const [bit, flag] of FLAGS) {
    if (fontStyle > 0 && (fontStyle & bit) !== 0) flags[flag] = true
  }
  return {
    ...(color === '' ? {} : { foreground: normalizeColor(color) }),
    ...(Object.keys(flags).length === 0 ? {} : { fontStyle: flags }),
  }
}
