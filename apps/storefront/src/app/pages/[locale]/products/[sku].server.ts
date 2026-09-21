import type { PageServerLoad } from '@analogjs/router';
import { getProduct } from '@analog-ecom-ws/s3-client';
import { LOCALES, type Locale, type Product } from '@analog-ecom-ws/product-schema';

export type ProductDetailData = {
  locale: Locale;
  sku: string;
  product: Product | null;
};

function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export async function load({ params = {} }: PageServerLoad): Promise<ProductDetailData> {
  const locale: Locale = isLocale(params['locale']) ? params['locale'] : 'en';
  const sku = params['sku'] ?? '';
  try {
    const product = await getProduct(sku, locale);
    return { locale, sku, product };
  } catch (err) {
    console.error(`Failed to load product ${sku} (${locale}) from S3:`, err);
    return { locale, sku, product: null };
  }
}
