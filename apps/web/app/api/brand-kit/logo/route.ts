import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { saveBuffer } from "@/lib/storage";

const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const ALLOWED_LOGO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  // Validate MIME type
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported logo format. Allowed: PNG, JPEG, WebP, SVG." },
      { status: 400 }
    );
  }

  // Validate extension
  const extension = path.extname(file.name).toLowerCase() || ".png";
  if (!ALLOWED_LOGO_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: "File extension not allowed for logos." },
      { status: 400 }
    );
  }

  // Validate size before reading into memory
  if (file.size > MAX_LOGO_SIZE) {
    return NextResponse.json(
      { error: "Logo file too large. Maximum size is 5 MB." },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const saved = await saveBuffer(buffer, {
    prefix: `brand-kit/${user.id}/`,
    extension,
    contentType: file.type
  });

  return NextResponse.json({ logoPath: saved.url, logoStoragePath: saved.storagePath });
}
