import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  const entry = ['src/main.ts', 'src/main.mjs', 'src/main.cjs'].find((file) => existsSync(join(packageRoot, file)))
  if (entry && !args.includes('--check-clean')) {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
    manifest.scripts = { ...manifest.scripts, 'fixture:entry': `node ${entry}` }
    write('test/highlight-compat/package.json', JSON.stringify(manifest))
  }
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
    write('test/highlight-compat/src/main.ts', [
      "import type { Value } from './types.js'",
      "export { value } from './value.ts'",
      "export * from './bridge.mjs'",
      "type Other = import('./types.ts').Value",
      "const lazy = import('./value.ts')",
      "const required = require('./value.ts')",
      "import { readFileSync } from 'node:fs'",
      "import path from 'path'",
    ].join('\n'))
    write('test/highlight-compat/src/types.ts', 'export type Value = number\n')
    write('test/highlight-compat/src/value.ts', 'export const value = 1\n')
    write('test/highlight-compat/src/bridge.mjs', "export * from '../../../shared.ts'\n")
    write('shared.ts', 'export const shared = true\n')
    track('test/highlight-compat/src', 'shared.ts')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
    expect(result.stdout).toContain('Tracked imports checked in 5 source files.')
  })

  it('leaves unimported highlighting data outside the executable graph', () => {
    write('test/highlight-compat/src/main.ts', 'export {}\n')
    for (const tree of ['fixtures', 'vendor', 'goldens', 'reports']) {
      write(`test/highlight-compat/${tree}/sample.js`, "import 'missing-fixture-dependency'\n")
    }
    track('test/highlight-compat')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
    expect(result.stdout).toContain('Tracked imports checked in 1 source files.')
  })

  it.each([
    'src/main.ts',
    'tests/main.test.ts',
    'scripts/main.mjs',
    'manifest/main.mjs',
    'vitest.config.ts',
    'vitest.platform.config.ts',
  ])('rejects a missing dependency in executable entry point %s', (entry) => {
    write('test/highlight-compat/package.json', JSON.stringify({ type: 'module', scripts: { probe: `node ${entry}` } }))
    write(`test/highlight-compat/${entry}`, "import 'missing-code-dependency'\n")
    track(`test/highlight-compat/${entry}`)
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${entry} imports "missing-code-dependency"`)
  })

  it.each(['fixtures', 'vendor', 'goldens', 'reports'])('checks %s JavaScript when executable code imports it transitively', (tree) => {
    write('test/highlight-compat/src/main.ts', "import './bridge.mjs'\n")
    write('test/highlight-compat/src/bridge.mjs', `import '../${tree}/sample.js'\n`)
    write(`test/highlight-compat/${tree}/sample.js`, "import 'missing-fixture-dependency'\n")
    track('test/highlight-compat')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`${tree}/sample.js imports "missing-fixture-dependency"`)
  })

  it.each(['missing', 'ignored'])('checks a %s dependency in recursively discovered manifest tests', (state) => {
    write('test/highlight-compat/vitest.config.mjs', "export default { test: { include: ['manifest/**/*.test.mjs'] } }\n")
    write('test/highlight-compat/manifest/nested/example.test.mjs', "import './profile-hidden.mjs'\n")
    if (state === 'ignored') write('test/highlight-compat/manifest/nested/profile-hidden.mjs', 'export {}\n')
    track('test/highlight-compat/vitest.config.mjs', 'test/highlight-compat/manifest/nested/example.test.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('manifest/nested/example.test.mjs imports "./profile-hidden.mjs"')
    if (state === 'ignored') expect(result.stderr).toContain('profile-hidden.mjs is not tracked by git')
  })

  it.each(['missing', 'ignored'])('checks a %s dependency in a package-script entry under a new directory', (state) => {
    write('test/highlight-compat/package.json', JSON.stringify({ type: 'module', scripts: { probe: 'node tools/check.mjs' } }))
    write('test/highlight-compat/tools/check.mjs', "import './profile-hidden.mjs'\n")
    if (state === 'ignored') write('test/highlight-compat/tools/profile-hidden.mjs', 'export {}\n')
    track('test/highlight-compat/tools/check.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('tools/check.mjs imports "./profile-hidden.mjs"')
    if (state === 'ignored') expect(result.stderr).toContain('profile-hidden.mjs is not tracked by git')
  })

  it('reads include globs from an explicit Vitest config outside the conventional directories', () => {
    write('test/highlight-compat/package.json', JSON.stringify({ type: 'module', scripts: { test: 'vitest --config=checks/runner.mjs' } }))
    write('test/highlight-compat/checks/runner.mjs', "import { include } from './patterns.mjs'; export default { test: { include } }\n")
    write('test/highlight-compat/checks/patterns.mjs', "export const include = ['specs/**/*.case.mjs']\n")
    write('test/highlight-compat/specs/nested/example.case.mjs', "import './missing.mjs'\n")
    track('test/highlight-compat/checks', 'test/highlight-compat/specs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('specs/nested/example.case.mjs imports "./missing.mjs"')
  })

  it.each(['--config checks/runner.mjs', '--config="checks/runner.mjs"', '-c checks/runner.mjs'])('accepts new executable directories and test exclusions with %s', (config) => {
    write('test/highlight-compat/package.json', JSON.stringify({ type: 'module', scripts: { test: `node --enable-source-maps "tools/check.mjs" && vitest ${config}` } }))
    write('test/highlight-compat/tools/check.mjs', 'export {}\n')
    write('test/highlight-compat/checks/runner.mjs', "export default { test: { include: ['specs/**/*.case.mjs'], exclude: ['specs/excluded/**'] } }\n")
    write('test/highlight-compat/specs/example.case.mjs', 'export {}\n')
    write('test/highlight-compat/specs/excluded/example.case.mjs', "import './missing.mjs'\n")
    track('test/highlight-compat/tools', 'test/highlight-compat/checks', 'test/highlight-compat/specs')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(0)
  })

  it('rejects an unclassified new top-level directory', () => {
    write('test/highlight-compat/tools/orphan.mjs', 'export {}\n')
    track('test/highlight-compat/tools/orphan.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('unclassified package entry: tools')
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
    "const url = new URL('./worker', import.meta.url); new Worker(url)",
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
    write('test/highlight-compat/src/main.ts', [
      "import type { Value } from './runtime.js'",
      "import { type Other } from './runtime.js'",
      "export type { Value } from './runtime.js'",
      "export { type Other } from './runtime.js'",
    ].join('\n'))
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

  it.each(['ignored', 'ignored-url', 'tracked', 'missing', 'missing-url', 'unignored', 'untracked-source'])('checks a declared generated artifact with %s state', (state) => {
    const path = state === 'unignored' ? 'vendor/generated.mjs' : 'vendor/profile-generated.mjs'
    write('test/highlight-compat/generated-inputs.json', JSON.stringify({ inputs: [{ path, command: 'npm run build:fixture', sources: ['src/input.ts'] }] }))
    const source = state.endsWith('-url') ? `new URL('../${path}', import.meta.url)\n` : `import '../${path}'\n`
    write('test/highlight-compat/src/main.mjs', source)
    write('test/highlight-compat/src/input.ts', 'export const input = 1\n')
    if (!state.startsWith('missing')) write(`test/highlight-compat/${path}`, 'export {}\n')
    track('test/highlight-compat/generated-inputs.json', 'test/highlight-compat/src/main.mjs')
    if (state !== 'untracked-source') track('test/highlight-compat/src/input.ts')
    if (state === 'tracked') execFileSync('git', ['-C', root, 'add', '--force', '--', `test/highlight-compat/${path}`])
    const result = check()
    expect(result.status, String(result.stderr)).toBe(state.startsWith('ignored') ? 0 : 1)
    if (state === 'tracked') expect(result.stderr).toContain('generated input must be gitignored and untracked')
    if (state.startsWith('missing')) {
      expect(result.stderr).toContain('run npm run build:fixture')
      expect(result.stderr).not.toContain('is not tracked by git')
    }
    if (state === 'unignored') expect(result.stderr).toContain('generated input must be gitignored and untracked')
    if (state === 'untracked-source') expect(result.stderr).toContain('generated input source is not tracked')
  })

  it.each(['listed', 'unlisted'])('treats a %s generated bundle with a relocated unresolved URL according to its contract', (state) => {
    if (state === 'listed') {
      write('test/highlight-compat/generated-inputs.json', JSON.stringify({ inputs: [{ path: 'vendor/profile-main.mjs', command: 'npm run build:fixture', sources: ['src'] }] }))
      track('test/highlight-compat/generated-inputs.json')
    }
    write('test/highlight-compat/src/main.mjs', "new URL('../vendor/profile-main.mjs', import.meta.url)\n")
    write('test/highlight-compat/vendor/profile-main.mjs', "new URL('./missing.wasm', import.meta.url)\n")
    track('test/highlight-compat/src/main.mjs')
    const result = check()
    expect(result.status, String(result.stderr)).toBe(state === 'listed' ? 0 : 1)
    if (state === 'unlisted') expect(result.stderr).toContain('vendor/profile-main.mjs is not tracked by git')
  })

  it('rejects an unlisted ignored artifact loaded from a data directory', () => {
    write('test/highlight-compat/src/main.mjs', "new URL('../vendor/profile-generated.mjs', import.meta.url)\n")
    write('test/highlight-compat/vendor/profile-generated.mjs', 'export {}\n')
    track('test/highlight-compat/src/main.mjs')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('vendor/profile-generated.mjs is not tracked by git')
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
