import path from "path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { saveBuffer } from "@/lib/storage";

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || ".png";

  const saved = await saveBuffer(buffer, {
    prefix: `brand-kit/${user.id}/`,
    extension,
    contentType: file.type
  });

  return NextResponse.json({ logoPath: saved.url, logoStoragePath: saved.storagePath });
}
