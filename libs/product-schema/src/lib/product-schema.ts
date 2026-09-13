import { z } from 'zod';

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const CATEGORIES = ['apparel/shirts', 'apparel/shoes'] as const;
export type Category = (typeof CATEGORIES)[number];

// Frontmatter contract for one product/locale markdown object
// (s3://products/<sku>/<locale>.md). See overall-goals-design.md §5.
export const ProductFrontmatterSchema = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  price: z.number().positive(),
  currency: z.literal('EUR'),
  stock: z.number().int().min(0),
  sizes: z.array(z.string().min(1)).min(1),
  colors: z.array(z.string().min(1)).min(1),
  category: z.enum(CATEGORIES),
  locale: z.enum(LOCALES),
  images: z.array(z.string().min(1)).min(1),
  updatedAt: z.iso.datetime(),
});

export type ProductFrontmatter = z.infer<typeof ProductFrontmatterSchema>;

// A fully parsed product: validated frontmatter + the markdown body, both
// as raw markdown (for agent-facing responses) and rendered HTML (for the
// Angular page). `raw` is the complete original file (frontmatter + body)
// exactly as stored in S3 - the thing content negotiation hands back
// unmodified.
//
// Tried rendering bodyMarkdown at the point of use instead, via Analog's
// own <analog-markdown> component (@analogjs/content) - it takes raw
// markdown as a `content` input, independent of the file-based content-
// collection APIs, so it looked like a clean fit. Reverted: it triggers a
// genuine SSR-breaking incompatibility in this project's Vite/Nitro AOT
// server build - @angular/common's PlatformLocation runs a static
// initializer needing the Angular JIT compiler (a partially-Ivy-linked
// dependency inside @analogjs/content), and the standard `import
// '@angular/compiler'` workaround gets tree-shaken out of the production
// server bundle since nothing appears to statically use it. Rendering
// with `marked` ourselves (see libs/s3-client/product-store.ts) avoids
// the whole problem and was already working.
export const ProductSchema = ProductFrontmatterSchema.extend({
  bodyMarkdown: z.string(),
  bodyHtml: z.string(),
  raw: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

// Key *within* the `products` bucket - s3://products/<sku>/<locale>.md is
// bucket "products" + key "<sku>/<locale>.md", not a "products/" prefix
// inside the bucket (see overall-goals-design.md §5).
export const productObjectKey = (sku: string, locale: Locale): string =>
  `${sku}/${locale}.md`;
