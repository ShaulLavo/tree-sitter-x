import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, it, vi } from 'vitest'
import upstream from 'vscode-textmate'
import { Registry, Theme } from '@shikijs/vscode-textmate'
import { admissionInputs } from '../src/oracles/theme-admission/inputs.ts'
import { admissionFixture } from '../src/oracles/theme-admission/reference.ts'
import { referenceDependencies } from '../src/oracles/theme-admission/independence.ts'

it.each(['upstream-method', 'fork-method', 'fork-factory'] as const)('aborts generation for a missing %s rather than retaining driver failure as target truth', async mode => {
  const owner = mode === 'upstream-method' ? upstream.Registry.prototype : mode === 'fork-method' ? Registry.prototype : Theme
  const method = mode === 'fork-factory' ? 'createFromRawTheme' : 'setTheme'
  const descriptor = Object.getOwnPropertyDescriptor(owner, method)
  assert(descriptor && 'value' in descriptor)
  const input = admissionInputs()[0]
  assert(input)
  try {
    Object.defineProperty(owner, method, { ...descriptor, value: undefined })
    await expect(admissionFixture(input)).rejects.toThrow('target method')
  } finally { Object.defineProperty(owner, method, descriptor) }
  const restored = await admissionFixture(input)
  expect(restored.attempts.every(attempt => attempt.result.kind === 'observed')).toBe(true)
})

const schemaFile = fileURLToPath(new URL('../src/oracles/theme-admission/schema.ts', import.meta.url))
const nativeFile = fileURLToPath(new URL('../src/native/theme-input.ts', import.meta.url))
const snippets = [
  ['static-type', "import type { InputSnapshot } from '../../native/theme-input.ts'"],
  ['import-type', "type Leak = import('../../native/theme-input.ts').InputSnapshot"],
  ['literal-dynamic', "void import('../../native/theme-input.ts')"],
  ['computed-dynamic', "void import('../../native/' + 'theme-input.ts')"],
  ['url-dynamic', "void import(new URL('../../native/theme-input.ts', import.meta.url).href)"],
  ['absolute-static', `import type { InputSnapshot } from '${nativeFile}'`],
  ['file-url-static', `import type { InputSnapshot } from '${pathToFileURL(nativeFile).href}'`],
  ['computed-require', "require('../../native/' + 'theme-input.ts')"],
  ['literal-require', "require('../../native/theme-input.ts')"],
  ['package-template-in-wrong-file', 'void import(`@shikijs/themes/${themeId}`)'],
  ['unreviewed-alias', "import type { InputSnapshot } from '@candidate/theme-input'"],
  ['remote-import', "void import('https://example.invalid/module.ts')"],
  ['require-alias', "const load = require; load('../../native/theme-input.ts')"],
  ['factory-alias', "const load = createRequire(import.meta.url); load('../../native/theme-input.ts')"],
  ['imported-factory-alias', "import { createRequire as loadFactory } from 'node:module'; const load = loadFactory(import.meta.url); load('../../native/theme-input.ts')"],
  ['bound-require', "const load = require.bind(null); load('../../native/theme-input.ts')"],
] as const
it.each(snippets)('rejects unreviewed dependency form %s without executing it', (_name, snippet) => {
  const original = fs.readFileSync, source = original(schemaFile, 'utf8')
  const replacement = source.concat('\n', snippet, '\n')
  const mock = vi.spyOn(fs, 'readFileSync').mockImplementation((file, options) => {
    const supplied: unknown = options
    if (String(file) === schemaFile) return supplied === 'utf8' ? replacement : Buffer.from(replacement)
    return original(file, options)
  })
  syncBuiltinESMExports()
  try { expect(() => referenceDependencies()).toThrow() }
  finally { mock.mockRestore(); syncBuiltinESMExports() }
})
it('still follows the complete audited reference graph and its two external asset templates', () => {
  const graph = referenceDependencies()
  expect(Object.keys(graph)).toHaveLength(28)
  expect(graph).toHaveProperty('src/oracles/assets.ts')
  expect(graph).toHaveProperty('src/oracles/product/scopedTokens.ts')
  expect(Object.keys(graph).some(path => path.startsWith('src/native/'))).toBe(false)
})
