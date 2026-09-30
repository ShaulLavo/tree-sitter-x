import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      include: [
        'web-tree-sitter.js',
      ],
      exclude: [
        'test/**',
        'dist/**',
        'lib/**',
        'wasm/**'
      ],
    },
  }
})
