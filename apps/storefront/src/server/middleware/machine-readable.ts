import { defineEventHandler, getRequestURL, send } from 'h3';
import { listProducts } from '@analog-ecom-ws/s3-client';
import { LOCALES } from '@analog-ecom-ws/product-schema';
import { buildRobotsTxt } from '../lib/robots-txt';

// Nitro/h3 file-based routes treat a dot before the last segment as an
// HTTP-method suffix (`.get.ts`), so a literal `llms.txt.ts` /
// `sitemap-products.xml.ts` filename wouldn't route the way it looks -
// same reasoning as the .md sibling route in markdown-negotiation.ts.
// Handled here as plain pathname checks instead of fighting that
// convention (overall-goals-design.md §9, §11).

const buildLlmsTxt = async (baseUrl: string): Promise<string> =>
  (await Promise.all(
    LOCALES.map((locale) => listProducts(locale)),
  ))
    .flatMap(product => product)
    .reduce((acc: string[], product) =>
        [...acc, `- [${product.title} (${product.locale})](${baseUrl}/${product.locale}/products/${product.sku}.md)`],
      [
        '# Analog Goods',
        '',
        'A small storefront demo for AnalogJS i18n + spartan.ng - markdown served to agents, rendered pages for browsers, both from the same product data.',
        '',
        `- [Landing page (en)](${baseUrl}/en)`,
        `- [Landing page (de)](${baseUrl}/de)`,
        '',
        '## Products',
        '',
      ],
    ).join('\n') + '\n';

const  buildProductsSitemap = async (baseUrl: string): Promise<string> => {
  const urls = (await listProducts(LOCALES[0]))
    .map((product) => {
      const alternates = LOCALES.map(
        (locale) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}/products/${product.sku}"/>`,
      ).join('\n');
      return LOCALES.map(
        (locale) =>
          `  <url>\n    <loc>${baseUrl}/${locale}/products/${product.sku}</loc>\n${alternates}\n  </url>`,
      ).join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
};

// `send()` writes+ends the response directly rather than relying on
// return-value serialization - required under the dev server, see the
// comment in markdown-negotiation.ts for the full explanation.
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const baseUrl = `${url.protocol}//${url.host}`;

  if (url.pathname === '/robots.txt') {
    await send(event, buildRobotsTxt(baseUrl), 'text/plain; charset=utf-8');
    return true;
  }

  if (url.pathname === '/llms.txt') {
    await send(event, await buildLlmsTxt(baseUrl), 'text/plain; charset=utf-8');
    return true;
  }

  if (url.pathname === '/sitemap-products.xml') {
    await send(event, await buildProductsSitemap(baseUrl), 'application/xml; charset=utf-8');
    return true;
  }

  return;
});
