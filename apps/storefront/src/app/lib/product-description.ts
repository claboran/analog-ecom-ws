import type { Product } from '@analog-ecom-ws/product-schema';

// Google truncates snippets around 155-160 characters; Lighthouse only
// checks that the tag exists and is non-empty, but the shorter form is what
// actually shows up in results.
export const META_DESCRIPTION_MAX_LENGTH = 155;

// Plain-text description derived from the product's markdown body - the one
// place that decides what "the description" of a product is, shared by the
// JSON-LD `description` (full text) and `<meta name="description">`
// (truncated), so the two can't drift apart.
export const productDescription = (product: Product, maxLength = Infinity): string => {
  // Paragraphs become sentences: the bold headline paragraph has no
  // terminal punctuation of its own, so without this it runs straight into
  // the body ("...out of the way Midweight combed cotton...").
  const paragraphs = product.bodyMarkdown
    .replace(/^#.*\n+/, '')
    .replace(/\*\*/g, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter(Boolean);
  const text = paragraphs
    .map((paragraph, index) =>
      index < paragraphs.length - 1 && !/[.!?…]$/.test(paragraph) ? `${paragraph}.` : paragraph,
    )
    .join(' ');

  if (text.length <= maxLength) {
    return text;
  }
  // Cut at the last word boundary that still leaves room for the ellipsis.
  const cut = text.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length).trimEnd()}…`;
};
