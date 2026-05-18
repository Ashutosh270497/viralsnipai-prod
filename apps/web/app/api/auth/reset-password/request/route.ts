import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limiter";
import { resetPasswordSchema } from "@/lib/validations";
import {
  PASSWORD_RESET_GENERIC_MESSAGE,
  buildPasswordResetUrl,
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

const IP_LIMIT = { id: "password-reset-ip", limit: 8, windowSec: 15 * 60 };
const EMAIL_LIMIT = { id: "password-reset-email", limit: 3, windowSec: 15 * 60 };

function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ipLimit = checkRateLimit(requestIp(request), IP_LIMIT);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts. Please wait and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", ...rateLimitHeaders(ipLimit, IP_LIMIT) } },
    );
  }

  let email: string;
  try {
    const parsed = resetPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    email = parsed.data.email.trim();
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const emailLimit = checkRateLimit(email.toLowerCase(), EMAIL_LIMIT);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many reset attempts. Please wait and try again." },
      { status: 429, headers: { "Cache-Control": "no-store", ...rateLimitHeaders(emailLimit, EMAIL_LIMIT) } },
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  if (user) {
    const token = createPasswordResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token.tokenHash,
        resetTokenExpiry: token.expiresAt,
      },
    });

    try {
      await sendPasswordResetEmail({
        email: user.email,
        resetUrl: buildPasswordResetUrl(token.rawToken),
      });
    } catch (error) {
      console.error("[auth] Failed to send password reset email", error);
      if (process.env.NODE_ENV !== "production") {
        console.info(`[auth] Development reset URL: ${buildPasswordResetUrl(token.rawToken)}`);
      }
    }
  }

  return NextResponse.json(
    { success: true, message: PASSWORD_RESET_GENERIC_MESSAGE },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
