import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('pins the same exact Node runtime in package, lock metadata and CI', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { engines: { node: string } }
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')) as { packages: { '': { engines: { node: string } } } }
  const workflow = readFileSync(new URL('../../../.github/workflows/highlight-compat.yml', import.meta.url), 'utf8')
  expect(packageJson.engines.node).toBe('26.7.0')
  expect(lock.packages[''].engines.node).toBe(packageJson.engines.node)
  expect(workflow.match(/node-version: (\S+)/)?.[1]).toBe(packageJson.engines.node)
})

it('pins the tested Rust release in the checkout-binding CI build', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/highlight-compat.yml', import.meta.url), 'utf8')
  expect(workflow.match(/toolchain: (\S+)/)?.[1]).toBe('1.98.1')
})
