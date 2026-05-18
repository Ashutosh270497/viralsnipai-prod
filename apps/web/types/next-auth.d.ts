import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboardingCompleted?: boolean;
      youtubeChannelUrl?: string | null;
      sessionVersion?: number;
    } & DefaultSession["user"];
    error?: "SESSION_REVOKED";
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    onboardingCompleted?: boolean;
    youtubeChannelUrl?: string | null;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    onboardingCompleted?: boolean;
    youtubeChannelUrl?: string | null;
    sessionVersion?: number;
    error?: "SESSION_REVOKED";
  }
}
