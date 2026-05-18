import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashPasswordResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";
import { newPasswordSchema } from "@/lib/validations";

const tokenSchema = z.string().min(20).max(256);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid reset request." }, { status: 400 });
  }

  const token = tokenSchema.safeParse((body as { token?: unknown }).token);
  const password = newPasswordSchema.safeParse({
    password: (body as { password?: unknown }).password,
    confirmPassword: (body as { confirmPassword?: unknown }).confirmPassword,
  });

  if (!token.success || !password.success) {
    return NextResponse.json(
      {
        error:
          password.success
            ? "Invalid or expired reset link."
            : password.error.errors[0]?.message || "Check your new password.",
      },
      { status: 400 },
    );
  }

  const tokenHash = hashPasswordResetToken(token.data);
  const user = await prisma.user.findFirst({
    where: {
      resetToken: tokenHash,
      resetTokenExpiry: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const hashedPassword = await bcrypt.hash(password.data.password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      sessionVersion: { increment: 1 },
    },
  });

  return NextResponse.json(
    { success: true, message: "Your password has been updated. Sign in with your new password." },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

