import type { PageServerLoad } from '@analogjs/router';
import { listProducts } from '@analog-ecom-ws/s3-client';
import { LOCALES, type Locale, type Product } from '@analog-ecom-ws/product-schema';

export interface ProductListData {
  locale: Locale;
  products: Product[];
}

function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// Fetches the full catalog from S3 at request time - deliberately not
// using Analog's build-time content collections here (overall-goals-design.md §5).
export async function load({ params = {} }: PageServerLoad): Promise<ProductListData> {
  const locale: Locale = isLocale(params['locale']) ? params['locale'] : 'en';
  try {
    const products = await listProducts(locale);
    return { locale, products };
  } catch (err) {
    console.error('Failed to list products from S3:', err);
    return { locale, products: [] };
  }
}
