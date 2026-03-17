import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboardingCompleted?: boolean;
      youtubeChannelUrl?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    onboardingCompleted?: boolean;
    youtubeChannelUrl?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    onboardingCompleted?: boolean;
    youtubeChannelUrl?: string | null;
  }
}
