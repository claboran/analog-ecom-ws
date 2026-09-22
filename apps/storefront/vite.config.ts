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
// '/locales' must come before the bare 'product-schema' entry below: Vite
// checks alias entries in order and takes the first match, and the two
// specifiers would otherwise collide.
//
// It exists as its own alias (not just re-exported through the barrel)
// because the barrel doesn't tree-shake here: product-schema.ts does
// `import { z } from 'zod'` at module scope, so any `export * from
// './lib/product-schema'` re-export drags the whole zod schema graph into
// any client chunk that value-imports so much as LOCALES through the
// barrel - confirmed by bundle analysis, cost ~29kB gzip on every route
// (see README's "Lessons learned"). This alias lets app-layout.component.ts
// and [locale].page.ts (the only client-side value-importers of LOCALES)
// resolve straight to the zod-free file instead.
const workspaceLibAliases = {
  '@analog-ecom-ws/product-schema/locales': fileURLToPath(
    new URL('../../libs/product-schema/src/lib/locales.ts', import.meta.url),
  ),
  '@analog-ecom-ws/product-schema': fileURLToPath(
    new URL('../../libs/product-schema/src/index.ts', import.meta.url),
  ),
  '@analog-ecom-ws/s3-client': fileURLToPath(new URL('../../libs/s3-client/src/index.ts', import.meta.url)),
};

// Same resolution problem for the copied-in spartan helm components
// (libs/ui/<primitive>, imported as @spartan-ng/helm/<primitive>): one
// pattern alias instead of one entry per primitive. Vite only - they're
// imported by Angular components, which Vite bundles; Nitro never sees them.
const spartanHelmAlias = {
  find: /^@spartan-ng\/helm\/(.+)$/,
  replacement: `${fileURLToPath(new URL('../../libs/ui', import.meta.url))}/$1/src/index.ts`,
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
      alias: [
        ...Object.entries(workspaceLibAliases).map(([find, replacement]) => ({ find, replacement })),
        spartanHelmAlias,
      ],
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
