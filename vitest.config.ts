import { defineConfig } from 'vitest/config';

/**
 * Vitest config for flue-snippets.
 *
 * For now we use the standard Node test pool because Flue's runtime is
 * abstracted — we can call the agent default-exported function directly
 * with a synthesized FlueContext. When we want true workerd execution,
 * swap to @cloudflare/vitest-pool-workers per snippet.
 *
 * Tests run against REAL hosted services. Set:
 *   LAB_URL=https://lab.coey.dev
 *   DEJA_URL=https://deja.coey.dev
 * (or local dev URLs if you're running them).
 */
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
    globals: false,
    reporters: ['verbose'],
  },
});
