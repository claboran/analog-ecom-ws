import { defineEventHandler, getRequestURL, send } from 'h3';
import { getProductRaw } from '@analog-ecom-ws/s3-client';
import { LOCALES, type Locale } from '@analog-ecom-ws/product-schema';
import { wantsMarkdown } from '../lib/wants-markdown';

// Matches both /:locale/products/:sku (content negotiation) and
// /:locale/products/:sku.md (the always-markdown sibling route) - one
// regex, one handler, both backed by the same getProductRaw() call the
// page's .server.ts load function also uses (overall-goals-design.md §9).
const PRODUCT_DETAIL_PATH = new RegExp(`^/(${LOCALES.join('|')})/products/([^/]+?)(\\.md)?$`);

export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event);
  const match = pathname.match(PRODUCT_DETAIL_PATH);
  if (!match) {
    return;
  }

  const [, locale, sku, mdSuffix] = match;
  const isMarkdownSibling = !!mdSuffix;
  if (!isMarkdownSibling && !wantsMarkdown(event)) {
    return; // browser (or anything not asking for markdown): render the normal Angular route
  }

  const raw = await getProductRaw(sku, locale as Locale);
  if (raw === null) {
    return; // no such product: fall through to the normal 404 handling
  }

  // `send()` writes+ends the response itself (h3's own response-writer,
  // not framework/return-value serialization) - required for correctness
  // under the dev server. Analog's dev-mode middleware runner
  // (@analogjs/vite-plugin-nitro's register-dev-middleware.js) invokes
  // this handler directly and only inspects the *return value* to decide
  // whether to call `next()` - it never sends a `return`ed value as the
  // actual HTTP response itself (that auto-serialization only happens in
  // Nitro's real production h3 pipeline). `return raw` alone therefore
  // built the response, then hung forever waiting for something to end
  // it - reproduced and confirmed against the dev-mode source directly.
  // `send()` ends the response unconditionally; the truthy `return true`
  // afterwards is solely so the dev-mode wrapper's `if (!result) next()`
  // doesn't also try to continue the chain into Angular's SSR renderer on
  // an already-closed response.
  await send(event, raw, 'text/markdown; charset=utf-8');
  return true;
});
