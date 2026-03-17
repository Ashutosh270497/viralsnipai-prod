import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DEV ONLY: Bypass login by creating/fetching a dev user and returning a redirect
 * that triggers a demo login. Access via: http://localhost:3000/api/auth/dev-bypass
 *
 * This should NEVER be deployed to production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
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

    // Redirect to the NextAuth demo sign-in which creates a JWT session
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const signInUrl = new URL("/api/auth/callback/credentials", baseUrl);

    // We can't directly create a JWT, so redirect to a page that auto-triggers demo login
    return NextResponse.redirect(new URL(`/signin?dev-bypass=true`, baseUrl));
  } catch (error: any) {
    console.error("[Dev Bypass] Error:", error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
