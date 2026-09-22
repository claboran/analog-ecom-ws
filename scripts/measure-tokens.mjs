#!/usr/bin/env node
// Measures token/byte cost of the rendered-HTML vs raw-markdown response for
// the same product detail URL - the actual comparison this repo's agent-facing
// content negotiation exists to make (see README "Serving markdown to
// agents"). Requires the storefront running locally (npm start or npm run dev).
//
// Usage: node scripts/measure-tokens.mjs [baseUrl]
// Output: a markdown table, ready to paste into README.md.

import { countTokens as countTokensCl100k } from 'gpt-tokenizer';
import { countTokens as countTokensGpt4o } from 'gpt-tokenizer/model/gpt-4o';

const baseUrl = process.argv[2] ?? 'http://localhost:4200';
const locales = ['en', 'de'];
const sku = 'TS-BLK-001';

// Crude HTML→text extraction, standing in for what a non-negotiating agent's
// scraper/readability step would produce: drop script/style contents, strip
// tags, collapse whitespace. Not a real readability implementation - good
// enough to show the order of magnitude, not exact.
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function measure(label, text) {
  return {
    label,
    bytes: Buffer.byteLength(text, 'utf8'),
    chars: text.length,
    cl100k: countTokensCl100k(text),
    gpt4o: countTokensGpt4o(text),
  };
}

async function run() {
  const rows = [];

  for (const locale of locales) {
    const htmlUrl = `${baseUrl}/${locale}/products/${sku}`;
    const mdUrl = `${baseUrl}/${locale}/products/${sku}.md`;

    const [htmlRes, mdRes] = await Promise.all([fetch(htmlUrl), fetch(mdUrl)]);
    if (!htmlRes.ok || !mdRes.ok) {
      throw new Error(
        `Fetch failed for ${locale}: html ${htmlRes.status}, md ${mdRes.status}. Is the storefront running at ${baseUrl}?`,
      );
    }
    const html = await htmlRes.text();
    const markdown = await mdRes.text();
    const extracted = extractText(html);

    rows.push(measure(`${locale} — rendered HTML (raw response)`, html));
    rows.push(measure(`${locale} — HTML, tags stripped (naive scrape)`, extracted));
    rows.push(measure(`${locale} — markdown (\`.md\` route)`, markdown));
  }

  const header = '| Variant | Bytes | Chars | Tokens (cl100k_base) | Tokens (o200k_base / gpt-4o) |';
  const sep = '|---|---:|---:|---:|---:|';
  const lines = rows.map(
    (r) => `| ${r.label} | ${r.bytes.toLocaleString()} | ${r.chars.toLocaleString()} | ${r.cl100k.toLocaleString()} | ${r.gpt4o.toLocaleString()} |`,
  );

  console.log([header, sep, ...lines].join('\n'));
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
