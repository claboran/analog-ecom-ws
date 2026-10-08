import { LOCALES, type Locale, type Product } from '@analog-ecom-ws/product-schema';

export const parseLocale = (value: unknown): Locale =>
  (LOCALES as readonly string[]).includes(value as string) ? (value as Locale) : 'en';

// Slim, agent-friendly projection of a Product: no rendered HTML or raw
// frontmatter. `path` is the storefront page for the product.
export const toProductSummary = (product: Product) => ({
  sku: product.sku,
  title: product.title,
  price: product.price,
  currency: product.currency,
  stock: product.stock,
  sizes: product.sizes,
  colors: product.colors,
  category: product.category,
  path: `/${product.locale}/products/${product.sku}`,
});
