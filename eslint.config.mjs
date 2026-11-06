import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['extension/**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // WXT renders standard browser images; Next.js image optimisation is not available.
      '@next/next/no-img-element': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Generated WXT bundles and declarations are not application source.
    'extension/.output/**',
    'extension/.wxt/**',
  ]),
]);

export default eslintConfig;
