import { createHash } from 'node:crypto'

const isLowSurrogate = (unit: number): boolean => unit >= 0xdc00 && unit <= 0xdfff

/** Equals `sha256sum` of the UTF-8 file for well-formed text and stays injective over lone surrogates. */
export function sourceSha256(source: string): string {
  const hash = createHash('sha256')
  let start = 0
  for (let i = 0; i < source.length; i++) {
    const unit = source.charCodeAt(i)
    if (unit < 0xd800 || unit > 0xdfff) continue
    if (unit <= 0xdbff && isLowSurrogate(source.charCodeAt(i + 1))) {
      i++
      continue
    }
    hash.update(source.slice(start, i), 'utf8')
    hash.update(Uint8Array.of(0xe0 | (unit >> 12), 0x80 | ((unit >> 6) & 0x3f), 0x80 | (unit & 0x3f)))
    start = i + 1
  }
  hash.update(source.slice(start), 'utf8')
  return hash.digest('hex')
}

/** The code units matched by the JavaScript `\s` class. */
export function isWhitespaceUnit(unit: number): boolean {
  if (unit <= 0x20) return unit === 0x20 || (unit >= 0x09 && unit <= 0x0d)
  if (unit < 0xa0) return false
  if (unit >= 0x2000 && unit <= 0x200a) return true
  return (
    unit === 0xa0 ||
    unit === 0x1680 ||
    unit === 0x2028 ||
    unit === 0x2029 ||
    unit === 0x202f ||
    unit === 0x205f ||
    unit === 0x3000 ||
    unit === 0xfeff
  )
}
