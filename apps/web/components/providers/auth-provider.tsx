"use client";

import { useEffect, useRef } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

import { useToast } from "@/components/ui/use-toast";

const PROTECTED_PREFIXES = [
  "/activity",
  "/brand-kit",
  "/competitors",
  "/dashboard",
  "/hooksmith",
  "/imagen",
  "/keywords",
  "/niche-discovery",
  "/onboarding",
  "/projects",
  "/repurpose",
  "/settings",
  "/snipradar",
  "/transcribe",
  "/veo",
  "/voicer",
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionExpiryWatcher />
      {children}
    </SessionProvider>
  );
}

function SessionExpiryWatcher() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status } = useSession();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    const isProtected = PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!isProtected) return;

    const revoked = session?.error === "SESSION_REVOKED";
    if (status === "unauthenticated" || revoked) {
      hasRedirected.current = true;
      toast({
        title: "Session expired",
        description: "Your session expired. Please sign in again.",
      });
      router.replace(
        `/signin?reason=session_expired&callbackUrl=${encodeURIComponent(pathname)}`,
      );
    }
  }, [pathname, router, session?.error, status, toast]);

  return null;
}
