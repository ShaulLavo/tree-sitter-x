import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { warmLanguages } from '../src/oracles/assets.ts'
import { ORACLE_THEMES, PINS, readProductProfile } from '../src/oracles/pins.ts'

interface AssetFile {
  readonly package: string
  readonly version: string
  readonly path: string
  readonly sha256: string
}

const NODE_MODULES = fileURLToPath(new URL('../node_modules/', import.meta.url))
const assets = JSON.parse(readFileSync(new URL('../manifest/assets.json', import.meta.url), 'utf8')) as {
  grammars: (AssetFile & { name: string })[]
  themes: (AssetFile & { id: string })[]
  engine: AssetFile[]
  runtime: AssetFile[]
}

const packageRoot = (name: string): string => join(NODE_MODULES, name)
const installedVersion = (name: string): string => (JSON.parse(readFileSync(join(packageRoot(name), 'package.json'), 'utf8')) as { version: string }).version
const fileSha256 = (name: string, path: string): string => createHash('sha256').update(readFileSync(join(packageRoot(name), path))).digest('hex')

const ORACLE_LANGUAGES = ['typescript', 'tsx', 'json', 'markdown']

describe('oracle pins', () => {
  it.each(Object.values(PINS).filter((pin) => typeof pin === 'object'))('installs $name at $version', (pin) => {
    expect(installedVersion(pin.name)).toBe(pin.version)
  })

  it('loads the pinned vscode-oniguruma wasm', () => {
    expect(fileSha256(PINS.vscodeOniguruma.name, PINS.vscodeOniguruma.wasm)).toBe(PINS.vscodeOniguruma.wasmSha256)
  })

  it('names the Platform commit product-profile.json locks', () => {
    expect(readProductProfile().platform.commit).toBe(PINS.platformCommit)
  })

  it('runs the product engine files assets.json records', () => {
    for (const file of [...assets.engine, ...assets.runtime]) {
      expect(`${file.package}/${file.path} ${fileSha256(file.package, file.path)}`).toBe(`${file.package}/${file.path} ${file.sha256}`)
    }
    expect(fileSha256(PINS.shiki.name, 'dist/onig.wasm')).toBe(readProductProfile().engine.wasm.sha256)
  })

  it('loads grammar modules assets.json records, for every oracle language and what it lazily embeds', () => {
    const names = new Set(ORACLE_LANGUAGES.flatMap(warmLanguages))
    const problems = [...names].flatMap((name) => {
      const asset = assets.grammars.find((grammar) => grammar.name === name)
      if (asset === undefined) return [`${name}: not in assets.json`]
      const actual = fileSha256(asset.package, asset.path)
      return actual === asset.sha256 ? [] : [`${name}: ${actual}, recorded ${asset.sha256}`]
    })
    expect(problems).toEqual([])
  })

  it('loads theme modules assets.json records', () => {
    for (const themeId of ORACLE_THEMES) {
      const asset = assets.themes.find((theme) => theme.id === themeId)
      expect(asset, themeId).toBeDefined()
      if (asset !== undefined) expect(fileSha256(asset.package, asset.path), themeId).toBe(asset.sha256)
    }
  })
})
