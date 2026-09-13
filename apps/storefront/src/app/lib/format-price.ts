import type { Locale } from '@analog-ecom-ws/product-schema';

// Currency is always fixed EUR (overall-goals-design.md §7) - only the
// locale-driven formatting (symbol placement, decimal separator) varies.
export function formatPrice(price: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(price);
}
