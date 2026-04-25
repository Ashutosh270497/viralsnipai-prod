import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? "local") as "local" | "s3";
const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_DIR ?? "uploads");

export function getStorageDriver() {
  return STORAGE_DRIVER;
}

export function assertWritableUploadStorageConfigured() {
  if (process.env.NODE_ENV === "production" && STORAGE_DRIVER === "local") {
    throw new Error(
      "Production upload storage is configured as local. Set STORAGE_DRIVER=s3 with S3/Supabase storage variables before accepting uploads."
    );
  }
}

function getS3Client() {
  if (!process.env.S3_BUCKET) {
    throw new Error("S3_BUCKET is required for S3 storage driver");
  }

  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
          }
        : undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT
  });
}

export interface SavedFile {
  key: string;
  url: string;
  storagePath: string;
}

export async function saveBuffer(buffer: Buffer, options?: { prefix?: string; extension?: string; contentType?: string }) {
  assertWritableUploadStorageConfigured();

  const key = `${options?.prefix ?? ""}${randomUUID()}${options?.extension ?? ""}`;
  if (STORAGE_DRIVER === "local") {
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    const filePath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return {
      key,
      url: `/api/uploads/${key}`,
      storagePath: filePath
    } satisfies SavedFile;
  }

  const client = getS3Client();
  const bucket = process.env.S3_BUCKET ?? "";
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType
    })
  );

  const endpoint = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT;
  const url = endpoint ? `${endpoint.replace(/\/$/, "")}/${bucket}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;

  return {
    key,
    url,
    storagePath: `${bucket}/${key}`
  } satisfies SavedFile;
}

export async function ensureUploadsSubdir(subdir: string) {
  if (STORAGE_DRIVER === "local") {
    const dir = path.join(LOCAL_UPLOAD_DIR, subdir);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
  return subdir;
}

export function getLocalUploadDir() {
  return LOCAL_UPLOAD_DIR;
}
