export { default } from "next-auth/middleware"

// Keep this list aligned with `apps/web/app/(workspace)/*` segments. The
// `(workspace)/layout.tsx` server component also enforces auth via
// `getCurrentUser()`, but listing every workspace segment here gives us a fast
// edge-level redirect (cheaper than rendering a server component just to
// bounce to /signin) and a defence-in-depth gap closer.
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
    "/voicer/:path*"
  ]
}
