import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { recordActivationCheckpointSafe } from "@/lib/analytics/activation";
import { ensureSubscriptionBootstrap } from "@/lib/billing/subscriptions";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NEXTAUTH_DEBUG === "true",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  pages: {
    signIn: "/signin",
    error: "/signin"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      },
      allowDangerousEmailAccountLinking: false,
    }),
    ...(process.env.NODE_ENV === 'development' ? [CredentialsProvider({
      id: "demo",
      name: "Demo Login",
      credentials: {
        demo: { label: "Demo", type: "text" }
      },
      async authorize(credentials) {
        if (credentials?.demo !== "true") {
          return null;
        }

        const email = "demo@clippers.dev";
        const user = await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: "Demo Creator"
          },
          update: {}
        });

        await recordActivationCheckpointSafe({
          userId: user.id,
          checkpoint: "creator_onboarding_started",
          metadata: {
            source: "demo_login",
          },
        });

        await ensureSubscriptionBootstrap(user.id);

        return user;
      }
    })] : []),
    CredentialsProvider({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || !user.password) {
          throw new Error("Invalid email or password");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid email or password");
        }

        await ensureSubscriptionBootstrap(user.id);

        return user;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Auth] signIn:", { email: user?.email, provider: account?.provider });
      }

      // For Google OAuth: create/link user in database
      if (account?.provider === "google") {
        try {
          const email = user.email ?? (profile as any)?.email;
          if (!email) {
            console.error("[Auth] Google sign-in: no email");
            return false;
          }

          // Upsert user — handles race condition where two simultaneous OAuth sign-ins
          // with the same email could both pass findUnique and try to create
          const dbUser = await prisma.user.upsert({
            where: { email },
            create: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
              onboardingCompleted: false,
              plan: "free",
              subscriptionTier: "free",
            },
            update: {
              // Update name/image only if they're currently null (don't overwrite user-set values)
              ...(user.name ? { name: user.name } : {}),
              ...(user.image ? { image: user.image } : {}),
            },
          });

          // Only record activation checkpoint for new users (no onboardingCompleted means new)
          if (!dbUser.onboardingCompleted) {
            await recordActivationCheckpointSafe({
              userId: dbUser.id,
              checkpoint: "creator_onboarding_started",
              metadata: { source: "google_oauth" },
            });
          }

          await ensureSubscriptionBootstrap(dbUser.id);

          user.id = dbUser.id;
          user.onboardingCompleted = dbUser.onboardingCompleted;
          user.youtubeChannelUrl = dbUser.youtubeChannelUrl;

          // Store OAuth account link
          await prisma.account.upsert({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId
              }
            },
            create: {
              userId: dbUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token
            },
            update: {
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token
            }
          });
        } catch (error: any) {
          console.error("[Auth] Google sign-in error:", error?.message);
          return false;
        }
      }

      return true;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        token.youtubeChannelUrl = user.youtubeChannelUrl ?? null;
      }

      if (trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string }
        });
        if (dbUser) {
          token.onboardingCompleted = dbUser.onboardingCompleted ?? false;
          token.youtubeChannelUrl = dbUser.youtubeChannelUrl ?? null;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user = session.user ?? {};
        session.user.id = token.id as string;
        session.user.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false;
        session.user.youtubeChannelUrl = (token.youtubeChannelUrl as string | null) ?? null;
        session.user.name = token.name as string | null;
        session.user.email = token.email as string;
      }
      return session;
    }
  }
};

export const getCurrentSession = () => getServerSession(authOptions);

export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * Returns a user record guaranteed to exist in the DB.
 * Useful after local DB resets where JWT still has an old user ID.
 */
export async function getCurrentDbUser() {
  const user = await getCurrentUser();
  if (!user?.id && !user?.email) {
    return null;
  }

  if (user?.id) {
    const byId = await prisma.user.findUnique({
      where: { id: user.id },
    });
    if (byId) {
      await ensureSubscriptionBootstrap(byId.id);
      return byId;
    }
  }

  if (!user?.email) {
    return null;
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: user.email },
  });
  if (byEmail) {
    await ensureSubscriptionBootstrap(byEmail.id);
    return byEmail;
  }

  // Self-heal for development/non-prod resets where session survives but row was wiped.
  const dbUser = await prisma.user.create({
    data: {
      email: user.email,
      name: user.name ?? null,
      image: (user as any).image ?? null,
      onboardingCompleted: false,
      plan: "free",
      subscriptionTier: "free",
    },
  });

  await recordActivationCheckpointSafe({
    userId: dbUser.id,
    checkpoint: "creator_onboarding_started",
    metadata: {
      source: "session_self_heal",
    },
  });

  await ensureSubscriptionBootstrap(dbUser.id);

  return dbUser;
}
