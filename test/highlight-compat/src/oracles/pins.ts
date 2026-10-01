import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Exact identities every oracle result records; tests/oracle-pins.test.ts checks them against node_modules. */
export const PINS = {
  vscodeTextmate: { name: 'vscode-textmate', version: '9.3.2', commit: '25b68dad91920b1ed79d357534b8c4582f62d80d' },
  vscodeOniguruma: {
    name: 'vscode-oniguruma',
    version: '2.0.1',
    commit: '184a6e2d4603c5a31efc0a33f544be1545d9ec6b',
    wasm: 'release/onig.wasm',
    wasmSha256: '76ebc1f0d87b2e7449a45ff3cd1a1546a9f05f54bdac44ee03e8a2b8348897be',
  },
  shikiTextmate: { name: '@shikijs/vscode-textmate', version: '10.0.2' },
  shiki: { name: 'shiki', version: '4.4.3' },
  shikiOniguruma: { name: '@shikijs/engine-oniguruma', version: '4.4.3' },
  langs: { name: '@shikijs/langs', version: '4.4.3' },
  themes: { name: '@shikijs/themes', version: '4.4.3' },
  platformCommit: '7f0dfc9e29fa9e3ee90c981147f77f6fcb656481',
} as const

/** The fast theme set: product default, VS Code light default, word-valued font styles, shorthand colours. */
export const ORACLE_THEMES: readonly string[] = ['github-dark', 'light-plus', 'dracula', 'vesper']

export const pinLabel = (pin: { readonly name: string; readonly version: string }): string => `${pin.name}@${pin.version}`

const MANIFEST = fileURLToPath(new URL('../../manifest/', import.meta.url))

interface ProductProfile {
  readonly platform: { readonly commit: string; readonly inputs: readonly { readonly path: string; readonly sha256: string }[] }
  readonly engine: { readonly wasm: { readonly sha256: string } }
  readonly tokenization: { readonly lineLimit: { readonly settingDefault: number } }
  readonly languages: { readonly registrations: readonly ProductRegistration[] }
}

export interface ProductRegistration {
  readonly name: string
  readonly scopeName: string
  readonly embeddedLangsLazy: readonly string[] | null
  readonly moduleImports: readonly string[]
}

export function readProductProfile(): ProductProfile {
  return JSON.parse(readFileSync(`${MANIFEST}product-profile.json`, 'utf8')) as ProductProfile
}
