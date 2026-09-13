import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command, CommandRunner } from 'nest-commander';
import { putProductMarkdown } from '@analog-ecom-ws/s3-client';
import { LOCALES } from '@analog-ecom-ws/product-schema';
import { PRODUCT_FIXTURES } from '../fixtures';
import { renderPlaceholderSvg } from '../placeholder-image';
import { toProductMarkdown } from '../to-markdown';

// Nx always runs project targets with cwd = workspace root, so this
// resolves to apps/storefront/public/images/products regardless of where
// `nx run product-ingest:seed` is invoked from.
const IMAGES_DIR = join(process.cwd(), 'apps/storefront/public/images/products');

@Command({
  name: 'seed',
  description: 'Seed S3Mock with the demo product catalog (EN+DE) and generate placeholder images',
})
export class SeedCommand extends CommandRunner {
  override async run(): Promise<void> {
    await mkdir(IMAGES_DIR, { recursive: true });

    for (const fixture of PRODUCT_FIXTURES) {
      for (const locale of LOCALES) {
        await putProductMarkdown(fixture.sku, locale, toProductMarkdown(fixture, locale));
      }
      const svg = renderPlaceholderSvg(fixture.content.en.title, fixture.category);
      await writeFile(join(IMAGES_DIR, `${fixture.sku}.svg`), svg, 'utf-8');
      console.log(`seeded ${fixture.sku} (${LOCALES.join(', ')}) + placeholder image`);
    }

    console.log(`\nDone: ${PRODUCT_FIXTURES.length} products x ${LOCALES.length} locales.`);
  }
}
