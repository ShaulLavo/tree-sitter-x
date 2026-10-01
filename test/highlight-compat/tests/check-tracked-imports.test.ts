import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../scripts/check-tracked-imports.mjs', import.meta.url))
let root: string
let packageRoot: string

function write(path: string, content: string): void {
  const file = join(root, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function track(...paths: string[]): void {
  execFileSync('git', ['-C', root, 'add', '--', ...paths])
}

function check(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [script, packageRoot, ...args], { encoding: 'utf8', cwd: packageRoot })
}

function commitFixture(): void {
  execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--quiet', '-m', 'fixture'])
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tracked-imports-'))
  packageRoot = join(root, 'test/highlight-compat')
  execFileSync('git', ['init', '--quiet', root])
  write('.gitignore', 'profile*\nnode_modules\n')
  write('test/highlight-compat/tsconfig.json', '{"compilerOptions":{"module":"nodenext","moduleResolution":"nodenext"}}')
  write('test/highlight-compat/package.json', '{"type":"module"}')
  track('.gitignore', 'test/highlight-compat/tsconfig.json', 'test/highlight-compat/package.json')
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('tracked import check', () => {
  it('accepts tracked static, type, re-export, dynamic, require and transitive imports', () => {
    write('test/highlight-compat/src/main.ts', `
      import type { Value } from './types.js'
      export { value } from './value.ts'
      export * from './bridge.mjs'
      type Other = import('./types.ts').Value
      const lazy = import('./value.ts')
      const required = require('./value.ts')
      import { readFileSync } from 'node:fs'
      import path from 'path'
    `)
    write('test/highlight-compat/src/types.ts', 'export type Value = number\n')
    write('test/highlight-compat/src/value.ts', 'export const value = 1\n')
    write('test/highlight-compat/src/bridge.mjs', "export * from '../../../shared.ts'\n")
    write('shared.ts', 'export const shared = true\n')
    track('test/highlight-compat/src', 'shared.ts')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
    expect(result.stdout).toContain('Tracked imports checked in 5 source files.')
  })

  it.each([
    "import type { Value } from './profile-hidden.ts'",
    "export * from './profile-hidden.ts'",
    "const value = import('./profile-hidden.ts')",
    "type Value = import('./profile-hidden.ts').Value",
    "import value = require('./profile-hidden.ts')",
    "const value = require('./profile-hidden.ts')",
  ])('rejects an ignored source referenced by %s', (source) => {
    write('test/highlight-compat/src/main.ts', source)
    write('test/highlight-compat/src/profile-hidden.ts', 'export type Value = number\n')
    track('test/highlight-compat/src/main.ts')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('profile-hidden.ts is not tracked by git')
    expect(result.stderr).toContain('!! test/highlight-compat/src/profile-hidden.ts')
  })

  it('rejects an absent ignored import in a clean checkout', () => {
    write('test/highlight-compat/src/main.ts', "import './profile-hidden.ts'\n")
    track('test/highlight-compat/src/main.ts')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('cannot resolve a tracked file or installed dependency')
  })

  it('rejects an untracked source and prints its git status', () => {
    write('test/highlight-compat/src/main.ts', "import './untracked.ts'\n")
    write('test/highlight-compat/src/untracked.ts', 'export {}\n')
    track('test/highlight-compat/src/main.ts')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('untracked.ts is not tracked by git')
    expect(result.stderr).toContain('?? test/highlight-compat/src/untracked.ts')
  })

  it('follows imports into tracked JavaScript modules', () => {
    write('test/highlight-compat/src/main.ts', "import './bridge.mjs'\n")
    write('test/highlight-compat/src/bridge.mjs', "import './profile-hidden.ts'\n")
    write('test/highlight-compat/src/profile-hidden.ts', 'export {}\n')
    track('test/highlight-compat/src/main.ts', 'test/highlight-compat/src/bridge.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('bridge.mjs imports "./profile-hidden.ts"')
  })

  it('accepts installed dependencies without requiring node_modules to be tracked', () => {
    write('test/highlight-compat/src/main.ts', "import { value } from 'fixture-dependency'\n")
    write('test/highlight-compat/node_modules/fixture-dependency/package.json', '{"name":"fixture-dependency","main":"index.js","types":"index.d.ts"}')
    write('test/highlight-compat/node_modules/fixture-dependency/index.d.ts', 'export declare const value: number\n')
    write('test/highlight-compat/node_modules/fixture-dependency/index.js', 'exports.value = 1\n')
    track('test/highlight-compat/src/main.ts')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it.each(['missing', 'ignored', 'untracked', 'tracked'])('checks a %s URL-loaded oracle worker', (state) => {
    const worker = state === 'ignored' ? 'profile-oracle-worker.mjs' : 'oracle-worker.mjs'
    write('test/highlight-compat/src/main.mjs', `
      import { Worker } from 'node:worker_threads'
      const workerUrl = new URL('./${worker}', import.meta.url)
      const worker = new Worker(workerUrl)
    `)
    if (state !== 'missing') write(`test/highlight-compat/src/${worker}`, 'export {}\n')
    track('test/highlight-compat/src/main.mjs')
    if (state === 'tracked') track(`test/highlight-compat/src/${worker}`)
    const result = check()
    expect(result.status, String(result.stderr)).toBe(state === 'tracked' ? 0 : 1)
    if (state !== 'tracked') expect(result.stderr).toContain(worker)
  })

  it.each([
    "new Worker(new URL('./worker', import.meta.url))",
    "new Worker('./src/worker.mjs')",
  ])('rejects a missing Worker entry point in %s', (source) => {
    write('test/highlight-compat/src/main.mjs', source)
    track('test/highlight-compat/src/main.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('worker')
  })

  it('rejects a missing dependency imported by a tracked URL-loaded worker', () => {
    write('test/highlight-compat/src/main.mjs', "new Worker(new URL('../../../workers/worker.mjs', import.meta.url))\n")
    write('workers/worker.mjs', "import './missing.mjs'\n")
    track('test/highlight-compat/src', 'workers/worker.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('worker.mjs imports "./missing.mjs"')
  })

  it('distinguishes directory URLs from file references and checks URL-loaded assets', () => {
    write('test/highlight-compat/src/main.mjs', `
      const root = new URL('../goldens', import.meta.url)
      const parent = new URL('..', import.meta.url)
      const file = new URL('./profile-output.json', import.meta.url)
    `)
    track('test/highlight-compat/src/main.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('profile-output.json')
    expect(result.stderr).not.toContain('goldens')
  })

  it.each(['missing', 'ignored'])('rejects a %s runtime module concealed by a tracked declaration', (state) => {
    const module = state === 'ignored' ? 'profile-runtime' : 'runtime'
    write('test/highlight-compat/src/main.mjs', `import { value } from './${module}.js'\n`)
    write(`test/highlight-compat/src/${module}.d.ts`, 'export declare const value: number\n')
    track('test/highlight-compat/src/main.mjs')
    execFileSync('git', ['-C', root, 'add', '--force', '--', `test/highlight-compat/src/${module}.d.ts`])
    if (state === 'ignored') write(`test/highlight-compat/src/${module}.js`, 'export const value = 1\n')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${module}.js`)
  })

  it('accepts declarations for erased type-only dependencies', () => {
    write('test/highlight-compat/src/main.ts', `
      import type { Value } from './runtime.js'
      import { type Other } from './runtime.js'
      export type { Value } from './runtime.js'
      export { type Other } from './runtime.js'
    `)
    write('test/highlight-compat/src/runtime.d.ts', 'export type Value = number\nexport type Other = string\n')
    track('test/highlight-compat/src')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it.each([
    ['main.mjs', "import { value } from 'import-only'"],
    ['main.cjs', "const value = import('import-only')"],
  ])('accepts import-only ESM export conditions from %s', (file, source) => {
    write(`test/highlight-compat/src/${file}`, source)
    write('test/highlight-compat/node_modules/import-only/package.json', '{"type":"module","exports":{"import":"./index.mjs"}}')
    write('test/highlight-compat/node_modules/import-only/index.mjs', 'export const value = 1\n')
    track(`test/highlight-compat/src/${file}`)
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it('retains require conditions for CommonJS dependencies', () => {
    write('test/highlight-compat/src/main.cjs', "const value = require('require-only')\n")
    write('test/highlight-compat/node_modules/require-only/package.json', '{"exports":{"require":"./index.cjs"}}')
    write('test/highlight-compat/node_modules/require-only/index.cjs', 'exports.value = 1\n')
    track('test/highlight-compat/src/main.cjs')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it.each(['output.json', 'profile-output.json'])('rejects generated %s in the workflow cleanliness mode', (file) => {
    commitFixture()
    write(`test/highlight-compat/${file}`, '{}\n')
    const result = check('--check-clean')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(file)
  })

  it('permits dependency/cache files inside node_modules in cleanliness mode', () => {
    commitFixture()
    write('test/highlight-compat/node_modules/.cache/result.json', '{}\n')
    const result = check('--check-clean')
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it('does not treat comments or ordinary strings as imports and tolerates cycles', () => {
    write('test/highlight-compat/src/main.ts', `
      // import './profile-hidden.ts'
      const text = "import('./missing.ts')"
      import './cycle.ts'
    `)
    write('test/highlight-compat/src/cycle.ts', "import './main.ts'\n")
    track('test/highlight-compat/src')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })
})
