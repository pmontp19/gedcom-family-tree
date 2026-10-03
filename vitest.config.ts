import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const pkg = (p: string) => path.resolve(__dirname, 'packages', p)

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Test against source, so a fresh clone needs no build first.
    alias: [
      { find: '@gedcom/shared/story', replacement: pkg('shared/src/models/story.ts') },
      { find: '@gedcom/shared', replacement: pkg('shared/src/index.ts') },
      { find: '@gedcom/parser', replacement: pkg('parser/src/index.ts') },
      { find: '@', replacement: pkg('frontend/src') },
    ],
  },
  test: {
    // Node by default; a test that needs a DOM opts in with `@vitest-environment jsdom`.
    environment: 'node',
    globals: true,
    include: ['packages/*/tests/**/*.test.ts'],
  },
})
