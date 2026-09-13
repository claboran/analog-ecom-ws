import type { Locale } from '@analog-ecom-ws/product-schema';
import type { ProductFixture } from './fixtures';

// JSON is a valid subset of YAML flow syntax, so JSON.stringify-ing each
// frontmatter value is enough to produce valid YAML without pulling in a
// YAML serializer just for this - front-matter/js-yaml parses it back fine.
export function toProductMarkdown(fixture: ProductFixture, locale: Locale): string {
  const content = fixture.content[locale];
  const frontmatter: Record<string, unknown> = {
    sku: fixture.sku,
    title: content.title,
    price: fixture.price,
    currency: 'EUR',
    stock: fixture.stock,
    sizes: fixture.sizes,
    colors: fixture.colors,
    category: fixture.category,
    locale,
    images: [`/images/products/${fixture.sku}.svg`],
    updatedAt: fixture.updatedAt,
  };
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n');

  return `---\n${yaml}\n---\n\n# ${content.title}\n\n**${content.headline}**\n\n${content.body}\n`;
}
