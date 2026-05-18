import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

function buildSigninRedirect(request: NextRequest) {
  const signinUrl = new URL("/signin", request.url);
  signinUrl.searchParams.set("reason", "session_expired");
  signinUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return signinUrl;
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || token.error === "SESSION_REVOKED") {
    return NextResponse.redirect(buildSigninRedirect(request));
  }

  return NextResponse.next();
}

// Keep this list aligned with `apps/web/app/(workspace)/*` segments. The
// `(workspace)/layout.tsx` server component also enforces auth via
// `getCurrentUser()`, but listing every workspace segment here gives us a fast
// edge-level redirect and a better session-expiry message.
export const config = {
  matcher: [
    "/activity/:path*",
    "/brand-kit/:path*",
    "/competitors/:path*",
    "/dashboard/:path*",
    "/hooksmith/:path*",
    "/imagen/:path*",
    "/keywords/:path*",
    "/niche-discovery/:path*",
    "/onboarding/:path*",
    "/projects/:path*",
    "/repurpose/:path*",
    "/settings/:path*",
    "/snipradar/:path*",
    "/transcribe/:path*",
    "/veo/:path*",
    "/voicer/:path*",
  ],
};
