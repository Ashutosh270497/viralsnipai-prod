import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth";
import { ECOSYSTEM_COOKIE_KEY, getEcosystemHome, parseEcosystem } from "@/lib/ecosystem";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ecosystem: z.enum(["x", "youtube"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ecosystem" }, { status: 400 });
  }

  const ecosystem = parsed.data.ecosystem;
  const response = NextResponse.json({
    ecosystem,
    home: getEcosystemHome(ecosystem),
  });

  response.cookies.set({
    name: ECOSYSTEM_COOKIE_KEY,
    value: ecosystem,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ecosystem = parseEcosystem(cookies().get(ECOSYSTEM_COOKIE_KEY)?.value);

  return NextResponse.json({
    ecosystem,
    home: ecosystem ? getEcosystemHome(ecosystem) : null,
  });
}
