// Fails if zod ended up in the built client bundle. Client code may only
// `import type` from apps/storefront/src/app/lib/cart-schema.ts (see the
// eslint guard); this is the backstop that checks the actual build output.
// Run after `npm run storefront:build`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/apps/storefront/client';
if (!existsSync(dir)) {
  console.error(`${dir} not found - run \`npm run storefront:build\` first.`);
  process.exit(1);
}

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  );

// A zod build always contains its class/error names; plain "zod" text could
// show up in unrelated strings, so match zod's own identifiers.
const marker = /ZodError|ZodType|ZodObject|\$ZodType/;
const offenders = walk(dir)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => marker.test(readFileSync(f, 'utf8')));

if (offenders.length > 0) {
  console.error(`zod found in the client bundle:\n${offenders.map((f) => `  ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('OK: no zod in the client bundle.');
