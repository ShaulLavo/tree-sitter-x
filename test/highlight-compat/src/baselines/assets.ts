import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const VENDOR_ROOT = new URL('../../vendor/baselines/', import.meta.url)
export const PILOT_LANGUAGES = ['javascript', 'typescript', 'tsx', 'json', 'markdown'] as const
export const VSCODE_QUERY_SHA256 = 'fc3d24706daa63b470559f64796933a10d266742053aeeb4c069a598543a1510'
export const VSCODE_COMMIT = 'f39c7109bf651845855cbef5af2e91b2c9bd0a74'

export interface VendorAsset {
  readonly languageId: string
  readonly kind: 'wasm' | 'highlights' | 'resolver'
  readonly path: string
  readonly sha256: string
  readonly manifestPath: string
}

interface PinnedAsset {
  readonly path: string
  readonly platformPath: string
  readonly sha256: string
}

interface StructuralManifest {
  readonly languages: readonly {
    readonly id: string
    readonly wasm: PinnedAsset
    readonly queries: { readonly highlights: { readonly files: readonly PinnedAsset[] } }
  }[]
  readonly markdown: { readonly resolver: PinnedAsset }
}

export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

export function vendorAssets(root = VENDOR_ROOT): readonly VendorAsset[] {
  return JSON.parse(readFileSync(new URL('assets.json', root), 'utf8')) as VendorAsset[]
}

export function checkAssets(root = VENDOR_ROOT): string[] {
  const manifest = JSON.parse(readFileSync(new URL('../../manifest/tree-sitter-languages.json', import.meta.url), 'utf8')) as StructuralManifest
  const expected = manifest.languages.filter(language => (PILOT_LANGUAGES as readonly string[]).includes(language.id)).flatMap(language => [
    { languageId: language.id, kind: 'wasm', pin: language.wasm },
    ...language.queries.highlights.files.map(pin => ({ languageId: language.id, kind: 'highlights', pin })),
  ])
  expected.push({ languageId: 'markdown', kind: 'resolver', pin: manifest.markdown.resolver })
  const assets = vendorAssets(root)
  const problems: string[] = []
  for (const asset of assets) {
    const entry = expected.find(entry => entry.languageId === asset.languageId && entry.kind === asset.kind && entry.pin.platformPath === asset.manifestPath)
    if (entry === undefined || entry.pin.sha256 !== asset.sha256 || entry.pin.path.replace(/^\.\//, '') !== asset.path) problems.push(`${asset.path}: vendor identity differs from structural manifest`)
    if (sha256(readFileSync(new URL(asset.path, root))) !== asset.sha256) problems.push(`${asset.path}: vendored bytes differ from pinned hash`)
  }
  for (const entry of expected) {
    if (!assets.some(asset => asset.languageId === entry.languageId && asset.kind === entry.kind && asset.manifestPath === entry.pin.platformPath && asset.sha256 === entry.pin.sha256)) problems.push(`${entry.pin.platformPath}: missing vendored asset`)
  }
  if (assets.length !== expected.length) problems.push('vendored asset record count differs from structural manifest')
  if (sha256(readFileSync(new URL('vscode-typescript.scm', root))) !== VSCODE_QUERY_SHA256) problems.push('vscode-typescript.scm: vendored bytes differ from pinned hash')
  return problems
}

export function querySource(languageId: string): string {
  return vendorAssets().filter(asset => asset.languageId === languageId && asset.kind === 'highlights').map(asset => readFileSync(new URL(asset.path, VENDOR_ROOT), 'utf8')).join('\n')
}

export function parserUrl(languageId: string): URL {
  const asset = vendorAssets().find(asset => asset.languageId === languageId && asset.kind === 'wasm')
  if (asset === undefined) throw new Error(`missing parser for ${languageId}`)
  return new URL(asset.path, VENDOR_ROOT)
}
