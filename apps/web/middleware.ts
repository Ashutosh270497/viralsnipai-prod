export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/hooksmith/:path*",
    "/repurpose/:path*",
    "/brand-kit/:path*",
    "/projects/:path*",
    "/transcribe/:path*",
    "/voicer/:path*",
    "/onboarding/:path*",
    "/snipradar/:path*"
  ]
}
