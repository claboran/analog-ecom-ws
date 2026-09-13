import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import frontMatter from 'front-matter';
import { marked } from 'marked';
import {
  type Locale,
  type Product,
  ProductFrontmatterSchema,
  productObjectKey,
} from '@analog-ecom-ws/product-schema';
import { createS3Client, PRODUCTS_BUCKET } from './client';

const s3 = createS3Client();

// This module is the one shared fetch/parse function the whole design
// leans on (overall-goals-design.md §5): storefront .server.ts load
// functions, the agent content-negotiation middleware, the .md sibling
// route, the OG image route, sitemap and llms.txt all call getProduct /
// listProducts - none of them re-implement S3 fetch or frontmatter
// parsing on their own.

function parseProductMarkdown(raw: string): Product {
  const { attributes, body } = frontMatter<Record<string, unknown>>(raw);
  const frontmatter = ProductFrontmatterSchema.parse(attributes);
  return {
    ...frontmatter,
    bodyMarkdown: body.trim(),
    bodyHtml: marked.parse(body.trim(), { async: false }),
    raw,
  };
}

async function bodyToString(body: unknown): Promise<string> {
  // Node-only runtime (Nitro server + the ingest CLI both run on Node),
  // so the SdkStreamMixin helper is always available on the response body.
  return (body as { transformToString: (encoding?: string) => Promise<string> }).transformToString('utf-8');
}

export async function getProductRaw(sku: string, locale: Locale): Promise<string | null> {
  try {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: PRODUCTS_BUCKET, Key: productObjectKey(sku, locale) }),
    );
    return await bodyToString(result.Body);
  } catch (err) {
    if ((err as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw err;
  }
}

export async function getProduct(sku: string, locale: Locale): Promise<Product | null> {
  const raw = await getProductRaw(sku, locale);
  return raw === null ? null : parseProductMarkdown(raw);
}

export async function listProductSkus(): Promise<string[]> {
  const skus = new Set<string>();
  let continuationToken: string | undefined;
  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: PRODUCTS_BUCKET,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of result.Contents ?? []) {
      const match = obj.Key?.match(/^([^/]+)\//);
      if (match) {
        skus.add(match[1]);
      }
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return [...skus].sort();
}

export async function listProducts(locale: Locale): Promise<Product[]> {
  const skus = await listProductSkus();
  const products = await Promise.all(skus.map((sku) => getProduct(sku, locale)));
  return products.filter((product): product is Product => product !== null);
}

export async function putProductMarkdown(sku: string, locale: Locale, raw: string): Promise<void> {
  // Validate before writing, so the ingest CLI can never push a fixture
  // that the storefront would later fail to parse - same schema on both
  // ends.
  parseProductMarkdown(raw);
  await s3.send(
    new PutObjectCommand({
      Bucket: PRODUCTS_BUCKET,
      Key: productObjectKey(sku, locale),
      Body: raw,
      ContentType: 'text/markdown; charset=utf-8',
    }),
  );
}

export async function clearProducts(): Promise<number> {
  let continuationToken: string | undefined;
  let deleted = 0;
  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: PRODUCTS_BUCKET,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of result.Contents ?? []) {
      if (!obj.Key) continue;
      await s3.send(new DeleteObjectCommand({ Bucket: PRODUCTS_BUCKET, Key: obj.Key }));
      deleted++;
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return deleted;
}
