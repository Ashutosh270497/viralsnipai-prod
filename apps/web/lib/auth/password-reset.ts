import crypto from "crypto";
import nodemailer from "nodemailer";

import { EMAIL_CONFIG } from "@/lib/constants";
import { getSupportEmail } from "@/lib/support";

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists, we sent reset instructions.";

export function createPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
  };
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(token: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/new-password?token=${encodeURIComponent(token)}`;
}

export function isPasswordResetEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD,
  );
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  if (!isPasswordResetEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] Password reset URL for ${email}: ${resetUrl}`);
      return { delivered: false, devLogged: true };
    }

    console.warn(
      "[auth] Password reset requested but SMTP is not configured. Returning a generic response.",
    );
    return { delivered: false, devLogged: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: EMAIL_CONFIG.FROM_ADDRESS,
    to: email,
    replyTo: EMAIL_CONFIG.REPLY_TO || getSupportEmail(),
    subject: "Reset your ViralSnipAI password",
    text: [
      "We received a request to reset your ViralSnipAI password.",
      "",
      `Use this secure link within 30 minutes: ${resetUrl}`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:20px;margin:0 0 12px">Reset your ViralSnipAI password</h1>
        <p>Use the secure link below within 30 minutes.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;border-radius:10px;background:#2563eb;color:white;padding:12px 18px;text-decoration:none;font-weight:700">
            Set a new password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });

  return { delivered: true, devLogged: false };
}

