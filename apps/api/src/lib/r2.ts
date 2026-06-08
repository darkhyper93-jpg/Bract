import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

// DECISIÓN: usamos @aws-sdk/client-s3 en lugar de aws4fetch porque el SDK provee
// getSignedUrl() compatible con el flujo de upload del README §6.1
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export async function generateSignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    ContentType: mimeType,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET, Key: key }));
}
