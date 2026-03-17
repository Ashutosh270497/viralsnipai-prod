import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function buildDatabaseUrl(): string | undefined {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return undefined;
  }

  try {
    const parsed = new URL(rawUrl);
    const isSupabasePooler = parsed.hostname.includes(".pooler.supabase.com");

    if (!isSupabasePooler) {
      return rawUrl;
    }

    // Supabase pooler in session mode can saturate quickly in local dev/hot-reload.
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set(
        "connection_limit",
        process.env.NODE_ENV === "production" ? "5" : "1"
      );
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "15");
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const databaseUrl = buildDatabaseUrl();

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
