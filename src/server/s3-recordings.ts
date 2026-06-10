/**
 * Server-only helpers for listing past call recordings out of S3.
 *
 * The recordings bucket is populated by spenza-backend after each call ends
 * (see voice.recording.ready webhook). We just read it.
 *
 * Credentials and bucket come from env: AWS_REGION, AWS_ACCESS_KEY_ID,
 * AWS_SECRET_ACCESS_KEY, RECORDINGS_BUCKET, RECORDINGS_PREFIX.
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type RecordingItem = {
  /** Full S3 key — also used as the row id. */
  key: string;
  /** Filename portion (last path segment). */
  name: string;
  /** Bytes. */
  size: number;
  /** ISO timestamp from S3 LastModified. */
  lastModified: string;
};

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region) throw new Error("AWS_REGION not set");
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set");
  }
  client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function getBucket(): string {
  const bucket = process.env.RECORDINGS_BUCKET;
  if (!bucket) throw new Error("RECORDINGS_BUCKET not set");
  return bucket;
}

const AUDIO_EXTENSIONS = [".wav", ".mp3", ".m4a", ".ogg", ".webm"];

function isAudioKey(key: string): boolean {
  const lower = key.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function toItem(obj: _Object): RecordingItem | null {
  if (!obj.Key) return null;
  if (!isAudioKey(obj.Key)) return null;
  const name = obj.Key.split("/").pop() ?? obj.Key;
  return {
    key: obj.Key,
    name,
    size: obj.Size ?? 0,
    lastModified: (obj.LastModified ?? new Date(0)).toISOString(),
  };
}

/**
 * List all audio recordings under the configured bucket/prefix.
 * Paginates through ListObjectsV2 and returns newest-first.
 */
export async function listRecordings(): Promise<RecordingItem[]> {
  const s3 = getClient();
  const Bucket = getBucket();
  const Prefix = process.env.RECORDINGS_PREFIX || undefined;

  const items: RecordingItem[] = [];
  let ContinuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }),
    );
    for (const obj of res.Contents ?? []) {
      const item = toItem(obj);
      if (item) items.push(item);
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return items;
}

/**
 * Presign a GET URL for a single object so the browser can stream or download
 * it without needing AWS credentials. URL is valid for 10 minutes.
 */
export async function getRecordingUrl(key: string): Promise<string> {
  const s3 = getClient();
  const Bucket = getBucket();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), {
    expiresIn: 600,
  });
}
