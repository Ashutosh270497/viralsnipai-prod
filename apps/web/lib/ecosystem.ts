export const ECOSYSTEM_COOKIE_KEY = "clippers_ecosystem";

export type Ecosystem = "x" | "youtube";

export function parseEcosystem(value: string | null | undefined): Ecosystem | null {
  if (value === "x" || value === "youtube") {
    return value;
  }
  return null;
}

export function getEcosystemHome(ecosystem: Ecosystem): string {
  return ecosystem === "x" ? "/snipradar/overview" : "/dashboard";
}

export function isRouteAllowedForEcosystem(pathname: string, ecosystem: Ecosystem): boolean {
  if (!pathname || pathname === "/") {
    return true;
  }

  // Global routes available in both ecosystems.
  if (pathname.startsWith("/settings") || pathname.startsWith("/activity")) {
    return true;
  }

  if (ecosystem === "x") {
    return pathname === "/snipradar" || pathname.startsWith("/snipradar/");
  }

  // YouTube ecosystem can access everything except X-only feature routes.
  return !(pathname === "/snipradar" || pathname.startsWith("/snipradar/"));
}
