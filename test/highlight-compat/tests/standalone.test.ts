import { globSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_INCLUDE, PLATFORM_TESTS } from '../vitest.config.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// The one file that names the pattern it forbids.
const SELF = 'tests/standalone.test.ts'
const PLATFORM_READ = /PLATFORM_ROOT|\/work\/projects\/platform/

describe('the default suite', () => {
  it('reads nothing from a Platform checkout', () => {
    const files = globSync([...DEFAULT_INCLUDE, 'src/**/*.ts'], { cwd: ROOT, exclude: [PLATFORM_TESTS, 'node_modules/**', SELF] })
    expect(files.length).toBeGreaterThan(20)
    expect(files.filter((path) => PLATFORM_READ.test(readFileSync(`${ROOT}${path}`, 'utf8'))).sort()).toEqual([])
  })
})
