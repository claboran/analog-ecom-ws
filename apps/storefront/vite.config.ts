/// <reference types="vitest" />

import { fileURLToPath } from 'node:url';
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

// vite-tsconfig-paths doesn't reliably follow the tsconfig.json `extends`
// chain up to the workspace root's tsconfig.base.json - and Nitro (which
// runs .server.ts load functions) has an entirely separate module
// resolution pipeline that doesn't see Vite's `resolve.alias` at all.
// Explicit aliases for the two workspace libs, given to both Vite and
// Nitro below, guarantee resolution in both places.
const workspaceLibAliases = {
  '@analog-ecom-ws/product-schema': fileURLToPath(
    new URL('../../libs/product-schema/src/index.ts', import.meta.url),
  ),
  '@analog-ecom-ws/s3-client': fileURLToPath(new URL('../../libs/s3-client/src/index.ts', import.meta.url)),
};

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    root: import.meta.dirname,
    cacheDir: `../../node_modules/.vite`,
    build: {
      outDir: '../../dist/apps/storefront/client',
      reportCompressedSize: true,
      target: ['es2020'],
    },
    server: {
      fs: {
        allow: ['.'],
      },
    },
    resolve: {
      alias: workspaceLibAliases,
    },
    plugins: [
      analog({
        i18n: {
          defaultLocale: 'en',
          locales: ['en', 'de'],
        },
        nitro: {
          alias: workspaceLibAliases,
        },
      }),
      viteTsConfigPaths({ root: '../../' }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      reporters: ['default'],
    },
  };
});
