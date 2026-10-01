import { defineConfig } from 'vitest/config'

/** The default suite runs from this repository alone; Platform checks run only via `npm run test:platform`. */
export const DEFAULT_INCLUDE = ['tests/**/*.test.ts', 'manifest/**/*.test.mjs']
export const PLATFORM_TESTS = 'manifest/**/*.platform.test.mjs'

export default defineConfig({
  test: {
    include: DEFAULT_INCLUDE,
    exclude: [PLATFORM_TESTS, '**/node_modules/**'],
  },
})
