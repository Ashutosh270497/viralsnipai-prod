import { prisma } from "@/lib/prisma";
import {
  getUserTweets,
  postTweetWithResult,
  refreshAccessToken,
  sendDirectMessageWithResult,
  type TokenResponse,
} from "@/lib/integrations/x-api";
import { decryptXToken, encryptXToken } from "@/lib/snipradar/token-encryption";
import type { XSearchResponse } from "@/lib/types/snipradar";

export type RefreshableXAccount = {
  id: string;
  xUserId: string;
  xUsername: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt?: Date | string | null;
};

type FetchTweetsWithAuthResult = {
  response: XSearchResponse;
  reauthRequired: boolean;
  refreshedToken: boolean;
  authMessage: string | null;
};

type PostTweetWithAuthResult = {
  tweetId: string | null;
  reauthRequired: boolean;
  refreshedToken: boolean;
  authMessage: string | null;
  accessToken: string | null;
  status?: number;
};

type SendDirectMessageWithAuthResult = {
  dmEventId: string | null;
  reauthRequired: boolean;
  refreshedToken: boolean;
  authMessage: string | null;
  accessToken: string | null;
  status?: number;
};

const tokenRefreshInFlight = new Map<string, Promise<TokenResponse | null>>();

async function refreshAccountToken(account: RefreshableXAccount): Promise<TokenResponse | null> {
  if (!account.refreshToken) return null;
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const existing = tokenRefreshInFlight.get(account.id);
  if (existing) return existing;

  // Decrypt the refresh token before sending to the X API.
  const plaintextRefreshToken = decryptXToken(account.refreshToken);

  const refreshPromise = (async () => {
    try {
      const newTokens = await refreshAccessToken({
        refreshToken: plaintextRefreshToken,
        clientId,
        clientSecret,
      });

      // Encrypt the new tokens before writing back to the database.
      const newRefreshToken = newTokens.refresh_token ?? account.refreshToken;
      await prisma.xAccount.update({
        where: { id: account.id },
        data: {
          accessToken: encryptXToken(newTokens.access_token),
          refreshToken: newRefreshToken ? encryptXToken(newRefreshToken) : null,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });

      return newTokens;
    } catch (error) {
      console.warn("[SnipRadar Auth] Token refresh failed", {
        accountId: account.id,
        username: account.xUsername,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      tokenRefreshInFlight.delete(account.id);
    }
  })();

  tokenRefreshInFlight.set(account.id, refreshPromise);
  return refreshPromise;
}

export async function getUserTweetsWithAutoRefresh(params: {
  account: RefreshableXAccount;
  maxResults: number;
  startTime?: Date;
  includeReplies?: boolean;
}): Promise<FetchTweetsWithAuthResult> {
  const { account, maxResults, startTime, includeReplies } = params;
  // Decrypt tokens — they may be stored encrypted or as legacy plaintext.
  let activeAccessToken = decryptXToken(account.accessToken);
  const decryptedRefreshToken = account.refreshToken ? decryptXToken(account.refreshToken) : null;
  const decryptedAccount: RefreshableXAccount = {
    ...account,
    accessToken: activeAccessToken,
    refreshToken: decryptedRefreshToken,
  };
  let refreshedToken = false;

  const expiry = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  const isExpiredOrNearExpiry =
    Boolean(expiry) &&
    !Number.isNaN(expiry!.getTime()) &&
    expiry!.getTime() <= Date.now() + 60_000;

  if (
    activeAccessToken &&
    activeAccessToken !== "bearer-only" &&
    decryptedAccount.refreshToken &&
    isExpiredOrNearExpiry
  ) {
    const refreshed = await refreshAccountToken(decryptedAccount);
    if (refreshed?.access_token) {
      activeAccessToken = refreshed.access_token;
      refreshedToken = true;
    }
  }

  const initialResponse = await getUserTweets({
    userId: decryptedAccount.xUserId,
    accessToken: activeAccessToken !== "bearer-only" ? activeAccessToken : undefined,
    maxResults,
    startTime,
    includeReplies,
    suppressAuthErrorLogging: true,
  });

  if (initialResponse.error?.status !== 401) {
    return {
      response: initialResponse,
      reauthRequired: false,
      refreshedToken,
      authMessage: null,
    };
  }

  if (!decryptedAccount.refreshToken) {
    return {
      response: initialResponse,
      reauthRequired: true,
      refreshedToken,
      authMessage:
        "X authorization expired. Reconnect your X account to resume live metrics.",
    };
  }

  const refreshed = await refreshAccountToken(decryptedAccount);
  if (!refreshed?.access_token) {
    return {
      response: initialResponse,
      reauthRequired: true,
      refreshedToken,
      authMessage:
        "X token refresh failed. Reconnect your X account to resume live metrics.",
    };
  }

  refreshedToken = true;

  const retryResponse = await getUserTweets({
    userId: decryptedAccount.xUserId,
    accessToken: refreshed.access_token,
    maxResults,
    startTime,
    includeReplies,
  });

  if (retryResponse.error?.status === 401) {
    return {
      response: retryResponse,
      reauthRequired: true,
      refreshedToken: true,
      authMessage:
        "X rejected refreshed credentials. Reconnect your X account to continue.",
    };
  }

  return {
    response: retryResponse,
    reauthRequired: false,
    refreshedToken: true,
    authMessage: null,
  };
}

export async function postTweetWithAutoRefresh(params: {
  account: RefreshableXAccount;
  text: string;
  replyToTweetId?: string;
}): Promise<PostTweetWithAuthResult> {
  const { account, text, replyToTweetId } = params;

  // Decrypt tokens before use — supports both encrypted and legacy plaintext storage.
  const plaintextAccessToken = decryptXToken(account.accessToken);
  const plaintextRefreshToken = account.refreshToken ? decryptXToken(account.refreshToken) : null;
  const decryptedAccount: RefreshableXAccount = {
    ...account,
    accessToken: plaintextAccessToken,
    refreshToken: plaintextRefreshToken,
  };

  if (!plaintextAccessToken || plaintextAccessToken === "bearer-only") {
    return {
      tweetId: null,
      reauthRequired: true,
      refreshedToken: false,
      authMessage:
        "Posting requires OAuth authorization. Reconnect your X account to continue.",
      accessToken: null,
      status: 401,
    };
  }

  let activeToken = plaintextAccessToken;
  let refreshedToken = false;

  // Proactive refresh when token is already expired.
  const expiry = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  if (expiry && !Number.isNaN(expiry.getTime()) && expiry <= new Date() && decryptedAccount.refreshToken) {
    const refreshed = await refreshAccountToken(decryptedAccount);
    if (refreshed?.access_token) {
      activeToken = refreshed.access_token;
      refreshedToken = true;
    }
  }

  const initialResult = await postTweetWithResult({
    text,
    accessToken: activeToken,
    replyToTweetId,
  });
  if (initialResult.ok) {
    return {
      tweetId: initialResult.tweetId,
      reauthRequired: false,
      refreshedToken,
      authMessage: null,
      accessToken: activeToken,
    };
  }

  if (initialResult.error.status !== 401) {
    return {
      tweetId: null,
      reauthRequired: false,
      refreshedToken,
      authMessage: initialResult.error.detail ?? "Failed to post tweet on X.",
      accessToken: activeToken,
      status: initialResult.error.status,
    };
  }

  if (!decryptedAccount.refreshToken) {
    return {
      tweetId: null,
      reauthRequired: true,
      refreshedToken,
      authMessage:
        "X authorization expired. Reconnect your X account to resume posting.",
      accessToken: activeToken,
      status: 401,
    };
  }

  const refreshed = await refreshAccountToken(decryptedAccount);
  if (!refreshed?.access_token) {
    return {
      tweetId: null,
      reauthRequired: true,
      refreshedToken,
      authMessage:
        "X token refresh failed. Reconnect your X account to resume posting.",
      accessToken: activeToken,
      status: 401,
    };
  }

  activeToken = refreshed.access_token;
  refreshedToken = true;

  const retryResult = await postTweetWithResult({
    text,
    accessToken: activeToken,
    replyToTweetId,
  });

  if (retryResult.ok) {
    return {
      tweetId: retryResult.tweetId,
      reauthRequired: false,
      refreshedToken,
      authMessage: null,
      accessToken: activeToken,
    };
  }

  return {
    tweetId: null,
    reauthRequired: retryResult.error.status === 401,
    refreshedToken,
    authMessage:
      retryResult.error.status === 401
        ? "X rejected refreshed credentials. Reconnect your X account to continue."
        : retryResult.error.detail ?? "Failed to post tweet on X.",
    accessToken: activeToken,
    status: retryResult.error.status,
  };
}

export async function sendDirectMessageWithAutoRefresh(params: {
  account: RefreshableXAccount;
  participantId: string;
  text: string;
}): Promise<SendDirectMessageWithAuthResult> {
  const { account, participantId, text } = params;

  // Decrypt tokens before use — supports both encrypted and legacy plaintext storage.
  const plaintextAccessToken = decryptXToken(account.accessToken);
  const plaintextRefreshToken = account.refreshToken ? decryptXToken(account.refreshToken) : null;
  const decryptedAccount: RefreshableXAccount = {
    ...account,
    accessToken: plaintextAccessToken,
    refreshToken: plaintextRefreshToken,
  };

  if (!plaintextAccessToken || plaintextAccessToken === "bearer-only") {
    return {
      dmEventId: null,
      reauthRequired: true,
      refreshedToken: false,
      authMessage:
        "Sending DMs requires OAuth authorization. Reconnect your X account to continue.",
      accessToken: null,
      status: 401,
    };
  }

  let activeToken = plaintextAccessToken;
  let refreshedToken = false;

  const expiry = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) : null;
  if (expiry && !Number.isNaN(expiry.getTime()) && expiry <= new Date() && decryptedAccount.refreshToken) {
    const refreshed = await refreshAccountToken(decryptedAccount);
    if (refreshed?.access_token) {
      activeToken = refreshed.access_token;
      refreshedToken = true;
    }
  }

  const initialResult = await sendDirectMessageWithResult({
    participantId,
    text,
    accessToken: activeToken,
  });

  if (initialResult.ok) {
    return {
      dmEventId: initialResult.dmEventId,
      reauthRequired: false,
      refreshedToken,
      authMessage: null,
      accessToken: activeToken,
    };
  }

  if (initialResult.error.status !== 401) {
    return {
      dmEventId: null,
      reauthRequired: false,
      refreshedToken,
      authMessage: initialResult.error.detail ?? "Failed to send direct message on X.",
      accessToken: activeToken,
      status: initialResult.error.status,
    };
  }

  if (!decryptedAccount.refreshToken) {
    return {
      dmEventId: null,
      reauthRequired: true,
      refreshedToken,
      authMessage: "X authorization expired. Reconnect your X account to resume direct messages.",
      accessToken: activeToken,
      status: 401,
    };
  }

  const refreshed = await refreshAccountToken(decryptedAccount);
  if (!refreshed?.access_token) {
    return {
      dmEventId: null,
      reauthRequired: true,
      refreshedToken,
      authMessage: "X token refresh failed. Reconnect your X account to resume direct messages.",
      accessToken: activeToken,
      status: 401,
    };
  }

  activeToken = refreshed.access_token;
  refreshedToken = true;

  const retryResult = await sendDirectMessageWithResult({
    participantId,
    text,
    accessToken: activeToken,
  });

  if (retryResult.ok) {
    return {
      dmEventId: retryResult.dmEventId,
      reauthRequired: false,
      refreshedToken,
      authMessage: null,
      accessToken: activeToken,
    };
  }

  return {
    dmEventId: null,
    reauthRequired: retryResult.error.status === 401,
    refreshedToken,
    authMessage:
      retryResult.error.status === 401
        ? "X rejected refreshed credentials. Reconnect your X account to continue."
        : retryResult.error.detail ?? "Failed to send direct message on X.",
    accessToken: activeToken,
    status: retryResult.error.status,
  };
}
