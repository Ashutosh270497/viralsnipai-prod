export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForToken,
  getAuthenticatedUser,
} from "@/lib/integrations/x-api";
import { logger } from "@/lib/logger";
import { encryptXToken } from "@/lib/snipradar/token-encryption";
import { seedStarterTrackedAccountsForUser } from "@/lib/snipradar/starter-account-seeding";

/**
 * GET /api/snipradar/callback
 * OAuth 2.0 callback from X.com
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Use NEXTAUTH_URL for early redirects too
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (error) {
      logger.error("[SnipRadar OAuth] Error from X", { error });
      return NextResponse.redirect(
        new URL("/snipradar?error=oauth_denied", baseUrl)
      );
    }

    if (!code || !state) {
      logger.error("[SnipRadar OAuth] Missing code or state params");
      return NextResponse.redirect(
        new URL("/snipradar?error=missing_params", baseUrl)
      );
    }

    // Verify state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("x_oauth_state")?.value;
    const codeVerifier = cookieStore.get("x_oauth_code_verifier")?.value;

    // Use NEXTAUTH_URL as the base for redirects to avoid localhost/127.0.0.1 mismatch
    const appBaseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    if (!storedState || state !== storedState) {
      logger.error("[SnipRadar OAuth] State mismatch", {
        receivedState: state,
        storedState: storedState ?? "MISSING",
      });
      return NextResponse.redirect(
        new URL("/snipradar?error=state_mismatch", appBaseUrl)
      );
    }

    if (!codeVerifier) {
      logger.error("[SnipRadar OAuth] Missing code verifier cookie");
      return NextResponse.redirect(
        new URL("/snipradar?error=missing_verifier", appBaseUrl)
      );
    }

    // Clean up cookies
    cookieStore.delete("x_oauth_state");
    cookieStore.delete("x_oauth_code_verifier");

    const clientId = process.env.X_CLIENT_ID!;
    const clientSecret = process.env.X_CLIENT_SECRET!;
    const redirectUri = process.env.X_CALLBACK_URL!;

    const tokenResponse = await exchangeCodeForToken({
      code,
      codeVerifier,
      redirectUri,
      clientId,
      clientSecret,
    });

    const xUser = await getAuthenticatedUser(tokenResponse.access_token);
    if (!xUser) {
      logger.error("[SnipRadar OAuth] Failed to fetch user profile with access token");
      return NextResponse.redirect(
        new URL("/snipradar?error=user_fetch_failed", appBaseUrl)
      );
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000
    );

    // Encrypt tokens before persisting — decrypted only when needed at runtime.
    const encryptedAccessToken = encryptXToken(tokenResponse.access_token);
    const encryptedRefreshToken = tokenResponse.refresh_token
      ? encryptXToken(tokenResponse.refresh_token)
      : null;

    // Upsert X account (re-link if previously disconnected)
    await prisma.xAccount.upsert({
      where: {
        userId_xUserId: {
          userId: user.id,
          xUserId: xUser.id,
        },
      },
      update: {
        xUsername: xUser.username,
        xDisplayName: xUser.name,
        profileImageUrl: xUser.profile_image_url ?? null,
        followerCount: xUser.public_metrics?.followers_count ?? 0,
        followingCount: xUser.public_metrics?.following_count ?? 0,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        isActive: true,
      },
      create: {
        userId: user.id,
        xUserId: xUser.id,
        xUsername: xUser.username,
        xDisplayName: xUser.name,
        profileImageUrl: xUser.profile_image_url ?? null,
        followerCount: xUser.public_metrics?.followers_count ?? 0,
        followingCount: xUser.public_metrics?.following_count ?? 0,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
      },
    });

    // Create initial snapshot
    const xAccount = await prisma.xAccount.findFirst({
      where: { userId: user.id, xUserId: xUser.id },
    });

    let seededStarterAccounts = 0;

    if (xAccount) {
      await prisma.xAccountSnapshot.create({
        data: {
          xAccountId: xAccount.id,
          followerCount: xUser.public_metrics?.followers_count ?? 0,
          followingCount: xUser.public_metrics?.following_count ?? 0,
          tweetCount: xUser.public_metrics?.tweet_count ?? 0,
          followerGrowth: 0,
        },
      });

      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { selectedNiche: true },
      });
      const seeded = await seedStarterTrackedAccountsForUser({
        userId: user.id,
        xAccountId: xAccount.id,
        selectedNiche: profile?.selectedNiche ?? null,
      });
      seededStarterAccounts = seeded.seeded;
    }

    await recordActivationCheckpointSafe({
      userId: user.id,
      checkpoint: "snipradar_x_account_connected",
      metadata: {
        source: "oauth_callback",
        xUsername: xUser.username,
      },
    });

    logger.info("[SnipRadar OAuth] Account connected", { username: xUser.username });
    return NextResponse.redirect(
      new URL(`/snipradar/discover?connected=true&seeded=${seededStarterAccounts}`, appBaseUrl)
    );
  } catch (error) {
    logger.error("[SnipRadar OAuth] Callback error", error instanceof Error ? error : undefined);
    const fallbackUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return NextResponse.redirect(
      new URL("/snipradar?error=callback_failed", fallbackUrl)
    );
  }
}
