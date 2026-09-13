import type { Category } from '@analog-ecom-ws/product-schema';

// Flat hex approximations of the storefront's OKLCH brand tokens (SVG fill
// doesn't need to match exactly - just needs to read as "the same brand"):
// denim indigo for shirts, craft ochre for shoes. See
// apps/storefront/src/styles.css for the source palette.
const CATEGORY_COLORS: Record<Category, { bg: string; fg: string }> = {
  'apparel/shirts': { bg: '#2f3b6e', fg: '#f6f4ee' },
  'apparel/shoes': { bg: '#cf9a3e', fg: '#241a08' },
};

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A demo has no real product photography and no image pipeline (see
// overall-goals-design.md §5/§6) - a flat, deterministic SVG placeholder
// per SKU avoids stock-photo licensing questions entirely and keeps
// title/SKU/image generation from the same fixture data in sync.
export function renderPlaceholderSvg(title: string, category: Category): string {
  const { bg, fg } = CATEGORY_COLORS[category];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <rect width="640" height="640" fill="${bg}" />
  <text x="320" y="320" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="36" font-weight="600" fill="${fg}">${escapeXml(title)}</text>
</svg>
`;
}
