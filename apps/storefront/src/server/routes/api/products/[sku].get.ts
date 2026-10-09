import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3';
import { getProduct } from '@analog-ecom-ws/s3-client';
import { parseLocale, toProductSummary } from '../../../lib/product-view';

export default defineEventHandler(async (event) => {
  const sku = getRouterParam(event, 'sku') ?? '';
  const product = await getProduct(sku, parseLocale(getQuery(event)['locale']));
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }
  return { ...toProductSummary(product), description: product.bodyMarkdown };
});
