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

function check(): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [script, packageRoot], { encoding: 'utf8' })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tracked-imports-'))
  packageRoot = join(root, 'test/highlight-compat')
  execFileSync('git', ['init', '--quiet', root])
  write('.gitignore', 'profile*\nnode_modules\n')
  write('test/highlight-compat/tsconfig.json', '{"compilerOptions":{"module":"nodenext","moduleResolution":"nodenext"}}')
  track('.gitignore', 'test/highlight-compat/tsconfig.json')
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('tracked import check', () => {
  it('accepts tracked static, type, re-export, dynamic, require and transitive imports', () => {
    write('test/highlight-compat/src/main.ts', `
      import type { Value } from './types.js'
      export { value } from './value'
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
    write('test/highlight-compat/node_modules/fixture-dependency/package.json', '{"name":"fixture-dependency","types":"index.d.ts"}')
    write('test/highlight-compat/node_modules/fixture-dependency/index.d.ts', 'export declare const value: number\n')
    track('test/highlight-compat/src/main.ts')
    const result = check()
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
