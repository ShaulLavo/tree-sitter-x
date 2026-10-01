import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ORIGINAL_ROOT = fileURLToPath(new URL('../fixtures/original/', import.meta.url))

/** A committed adversarial input; `languageId` is its directory, a Shiki grammar name. */
export interface OriginalFixture {
  readonly languageId: string
  readonly fixtureId: string
  readonly path: string
  readonly source: string
}

const sorted = (names: string[]): string[] => names.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

/** Every fixture under fixtures/original/<language>/, in a stable order, read byte-exact as UTF-8. */
export function originalFixtures(root = ORIGINAL_ROOT): OriginalFixture[] {
  return sorted(readdirSync(root)).flatMap((languageId) =>
    sorted(readdirSync(join(root, languageId))).map((name) => {
      const path = join(root, languageId, name)
      return { languageId, fixtureId: name.slice(0, -extname(name).length), path, source: readFileSync(path, 'utf8') }
    }),
  )
}
