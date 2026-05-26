import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    // Default to a plain node environment for fast pure-unit tests.
    // Files that need Nuxt auto-imports / DOM opt in with:
    //   // @vitest-environment nuxt
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    // The API e2e suite builds + boots a Nuxt server in beforeAll.
    hookTimeout: 180000,
    testTimeout: 30000
  }
})
