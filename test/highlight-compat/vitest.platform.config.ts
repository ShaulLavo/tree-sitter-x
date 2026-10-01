import { defineConfig } from 'vitest/config'
import { PLATFORM_TESTS } from './vitest.config.ts'

/** Checks that read a live Platform checkout at PLATFORM_ROOT (default /work/projects/platform). */
export default defineConfig({
  test: {
    include: [PLATFORM_TESTS],
  },
})
