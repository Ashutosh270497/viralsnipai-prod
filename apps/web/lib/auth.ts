import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions, getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import nodemailer from "nodemailer";

import { prisma } from "@/lib/prisma";

const emailTransport =
  process.env.NODE_ENV === "production"
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD
            }
          : undefined
      })
    : nodemailer.createTransport({
        jsonTransport: true
      });

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
  session: {
    strategy: "database"
  },
  pages: {
    signIn: "/signin",
    error: "/signin"
  },
  providers: [
    EmailProvider({
      maxAge: 10 * 60,
      sendVerificationRequest: async ({ identifier, url }) => {
        const result = await emailTransport.sendMail({
          to: identifier,
          from: "Clippers <no-reply@clippers.dev>",
          subject: "Your Clippers magic link",
          text: `Sign in to Clippers: ${url}`,
          html: `<p>Sign in to Clippers:</p><p><a href="${url}">${url}</a></p>`
        });

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log("Magic link email payload", result?.message ?? result);
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    CredentialsProvider({
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

        return user;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Log sign in attempt for debugging
      if (process.env.NODE_ENV === "development") {
        console.log("SignIn callback triggered:", {
          user: user?.email,
          provider: account?.provider,
          accountId: account?.providerAccountId
        });
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Log redirect for debugging
      if (process.env.NODE_ENV === "development") {
        console.log("Redirect callback:", { url, baseUrl });
      }

      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async session({ session, user }) {
      if (user) {
        session.user = session.user ?? {};
        session.user.id = user.id;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("Session callback:", {
          userId: user?.id,
          email: user?.email
        });
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
