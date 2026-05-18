import { ApiResponseBuilder } from "@/lib/api/response";

export function assertSameOriginRequest(request: Request): Response | null {
  const method = request.method.toUpperCase();
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return null;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return process.env.NODE_ENV === "production"
      ? ApiResponseBuilder.forbidden("Request origin is required.")
      : null;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.has(origin)) {
    return null;
  }

  return ApiResponseBuilder.forbidden("Request origin is not allowed.");
}

export function getAllowedOrigins() {
  const origins = new Set<string>();
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ]) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed deployment config; health checks surface env issues.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:3001");
    origins.add("http://localhost:3200");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:3001");
    origins.add("http://127.0.0.1:3200");
  }

  return origins;
}
