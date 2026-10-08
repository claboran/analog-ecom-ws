import { defineEventHandler, getQuery } from 'h3';
import { listProducts } from '@analog-ecom-ws/s3-client';
import { parseLocale, toProductSummary } from '../../../lib/product-view';

// GET /api/products?locale=en&q=trail&category=apparel/shoes
// `q`: every whitespace-separated term must appear in the title, category or
// description (case-insensitive). No `q` lists the whole catalog.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const locale = parseLocale(query['locale']);
  const terms = String(query['q'] ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const category = query['category'] ? String(query['category']) : null;

  const products = await listProducts(locale);
  return products
    .filter((p) => !category || p.category === category)
    .filter((p) => {
      const haystack = `${p.title} ${p.category} ${p.bodyMarkdown}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .map(toProductSummary);
});
