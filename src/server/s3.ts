import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

/**
 * Minimal AWS S3 client. Same bucket as spenza-backend (`ws-call-audio` by default),
 * but read/write happens with this app's own IAM credentials so the customer
 * controls their transcripts independently of Spenza.
 *
 * Credentials are taken from the standard env vars (AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, AWS_REGION). If none are set, the SDK falls back to
 * the default credentials chain (~/.aws/credentials, EC2 instance role, etc).
 */

const REGION = process.env.AWS_REGION ?? "us-east-1";
export const RECORDINGS_BUCKET = process.env.S3_RECORDINGS_BUCKET ?? "ws-call-audio";

let _client: S3Client | null = null;
function client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({ region: REGION });
  return _client;
}

export async function putJson(key: string, value: unknown): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: RECORDINGS_BUCKET,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: "application/json",
    }),
  );
}

export async function getJson<T = unknown>(key: string): Promise<T | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: RECORDINGS_BUCKET, Key: key }),
    );
    const text = await res.Body?.transformToString();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    // Object missing or other access errors → caller decides what to do.
    if ((err as { name?: string })?.name === "NoSuchKey") return null;
    throw err;
  }
}

/**
 * Parse the S3 object key from a presigned URL like
 * https://ws-call-audio.s3.us-east-1.amazonaws.com/{key}?X-Amz-...
 * or                  https://s3.us-east-1.amazonaws.com/ws-call-audio/{key}?...
 */
export function s3KeyFromPresignedUrl(presignedUrl: string): string | null {
  try {
    const u = new URL(presignedUrl);
    const host = u.hostname;
    let pathname = u.pathname.replace(/^\//, "");
    // Path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    if (host.startsWith("s3.") || host === "s3.amazonaws.com") {
      const idx = pathname.indexOf("/");
      if (idx === -1) return null;
      return pathname.slice(idx + 1);
    }
    // Virtual-host style: <bucket>.s3.<region>.amazonaws.com/<key>
    return pathname || null;
  } catch {
    return null;
  }
}
