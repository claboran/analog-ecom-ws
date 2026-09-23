import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3';
import { ImageResponse } from '@analogjs/content/og';
import { getProduct } from '@analog-ecom-ws/s3-client';
import { LOCALES, type Locale } from '@analog-ecom-ws/product-schema/locales';
import { formatPrice } from '../../../../../app/lib/format-price';

// Per-product OG image, rendered at request time from the same
// getProduct() every other consumer uses (README's "Product content
// model" - one fetch function, no re-implementation). Wired into
// [sku].page.ts's <meta property="og:image"> via ProductDetailComponent.
//
// Deliberately title + price only, no product photo: this catalog's
// images are generated placeholder SVGs (see product-ingest's fixtures),
// and satori (the renderer behind ImageResponse) has its own constrained
// layout/rendering engine - SVG <img> sources aren't reliably supported
// the way a real browser would render them. Raster photos would embed
// fine; these placeholders don't, so the template skips it rather than
// risk a broken/blank image in production.

// satori can't use system fonts (it targets serverless/edge runtimes with
// no OS font access) - it needs actual font bytes. Fetched once and cached
// for the life of the server process, not per request.
let fontDataPromise: Promise<ArrayBuffer> | undefined;
function loadFontData(): Promise<ArrayBuffer> {
  fontDataPromise ??= fetch('https://og-playground.vercel.app/inter-latin-ext-700-normal.woff').then((res) =>
    res.arrayBuffer(),
  );
  return fontDataPromise;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default defineEventHandler(async (event) => {
  const sku = getRouterParam(event, 'sku');
  const rawLocale = getQuery(event)['locale'];
  const locale: Locale = (LOCALES as readonly string[]).includes(rawLocale as string) ? (rawLocale as Locale) : 'en';

  if (!sku) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sku' });
  }

  const product = await getProduct(sku, locale);
  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' });
  }

  const fontData = await loadFontData();

  const template = `
    <div tw="flex w-full h-full items-center justify-center bg-white" style="font-family: Inter">
      <div tw="flex flex-col items-center justify-center px-24 text-center">
        <div tw="text-2xl text-gray-500 uppercase tracking-widest">Analog Goods</div>
        <div tw="text-6xl font-bold text-gray-900 mt-6">${escapeHtml(product.title)}</div>
        <div tw="text-4xl text-gray-600 mt-8">${escapeHtml(formatPrice(product.price, locale))}</div>
      </div>
    </div>
  `;

  return new ImageResponse(template, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: fontData, style: 'normal', weight: 700 }],
  });
});
