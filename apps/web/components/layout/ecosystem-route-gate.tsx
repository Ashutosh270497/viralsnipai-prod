"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { Ecosystem } from "@/lib/ecosystem";
import { getEcosystemHome, isRouteAllowedForEcosystem } from "@/lib/ecosystem";

interface EcosystemRouteGateProps {
  ecosystem: Ecosystem;
  children: React.ReactNode;
}

export function EcosystemRouteGate({ ecosystem, children }: EcosystemRouteGateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const routeAllowed = isRouteAllowedForEcosystem(pathname ?? "", ecosystem);

  useEffect(() => {
    if (!routeAllowed) {
      router.replace(getEcosystemHome(ecosystem));
    }
  }, [ecosystem, routeAllowed, router]);

  if (!routeAllowed) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Switching to your selected ecosystem...
      </div>
    );
  }

  return <>{children}</>;
}
