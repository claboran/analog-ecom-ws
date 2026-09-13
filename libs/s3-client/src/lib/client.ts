import { S3Client } from '@aws-sdk/client-s3';

export const PRODUCTS_BUCKET = process.env['S3_BUCKET'] ?? 'products';

// S3Mock doesn't validate credentials, but the SDK still requires the
// shape - the demo access key/secret are placeholders, never real.
export function createS3Client(): S3Client {
  return new S3Client({
    endpoint: process.env['S3_ENDPOINT'] ?? 'http://localhost:9090',
    region: process.env['S3_REGION'] ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env['S3_ACCESS_KEY'] ?? 'demo',
      secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'demo',
    },
  });
}
