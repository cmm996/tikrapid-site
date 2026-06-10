import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function saveUploadedImage(file: File | null, folder: string) {
  if (!file || file.size === 0) return "";
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("只支持 png、jpg、webp、gif 图片");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片不能超过 5MB");
  }

  const uploadRoot = process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "");
  const ext = extensionFor(file.type);
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(uploadRoot, safeFolder);
  await mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${safeFolder}/${filename}`;
}

function extensionFor(type: string) {
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  return ".png";
}

export function uploadPathFromSegments(segments: string[]) {
  if (segments.some((segment) => segment.includes("..") || segment.includes("/") || segment.includes("\\"))) {
    return null;
  }
  const uploadRoot = process.env.UPLOAD_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");
  return path.join(/*turbopackIgnore: true*/ uploadRoot, ...segments);
}
