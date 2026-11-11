import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Resolve WXT from the extension so root-level test mocks target the same modules.
const extensionRequire = createRequire(
  new URL('./extension/package.json', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'wxt/browser': extensionRequire.resolve('wxt/browser'),
      'wxt/utils/define-content-script': extensionRequire.resolve(
        'wxt/utils/define-content-script',
      ),
      'wxt/utils/content-script-ui/shadow-root': extensionRequire.resolve(
        'wxt/utils/content-script-ui/shadow-root',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Tests must not depend on a developer's ignored extension/.env.local file.
    env: {
      WXT_API_BASE_URL: 'http://localhost:3000',
    },
  },
});
