import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * DEV ONLY: Bypass login by creating/fetching a dev user and returning a redirect
 * that triggers a demo login. Access via: http://localhost:3000/api/auth/dev-bypass
 *
 * Two guards (must BOTH be satisfied for the route to do anything):
 *   1. NODE_ENV must NOT be "production"
 *   2. ENABLE_DEV_BYPASS must equal "true" (case-insensitive)
 *
 * Why two guards: Vercel preview deployments run with NODE_ENV="production" or
 * "development" depending on config, so relying on NODE_ENV alone has burned
 * teams before. Requiring an explicit env var means the bypass is opt-in per
 * environment and cannot accidentally become live on a preview/staging URL.
 */
function isDevBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.ENABLE_DEV_BYPASS ?? "").trim().toLowerCase() === "true";
}

export async function GET(request: Request) {
  if (!isDevBypassEnabled()) {
    // Log every blocked attempt — this endpoint should be rare; any request
    // here in a non-dev environment is a misconfiguration signal worth seeing.
    logger.warn("dev-bypass: blocked attempt", {
      nodeEnv: process.env.NODE_ENV,
      enableFlag: process.env.ENABLE_DEV_BYPASS ?? null,
      ip: request.headers.get("x-forwarded-for") ?? null,
      userAgent: request.headers.get("user-agent") ?? null,
    });
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    // Create or find dev user
    const email = "dev@clippers.dev";
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: "Dev User",
        onboardingCompleted: true,
        plan: "creator",
        subscriptionTier: "creator",
        creditsRemaining: 999
      },
      update: {}
    });

    logger.info("dev-bypass: granted", { email: user.email });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return NextResponse.redirect(new URL(`/signin?dev-bypass=true`, baseUrl));
  } catch (error: any) {
    logger.error("dev-bypass: failed", { error: error?.message });
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
