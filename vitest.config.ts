import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const pkg = (p: string) => path.resolve(__dirname, 'packages', p)

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Test against source, so a fresh clone needs no build first.
    alias: {
      '@gedcom/shared': pkg('shared/src/index.ts'),
      '@gedcom/parser': pkg('parser/src/index.ts'),
      '@': pkg('frontend/src'),
    },
  },
  test: {
    // Node by default; a test that needs a DOM opts in with `@vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    include: ['packages/*/tests/**/*.test.ts'],
  },
})
