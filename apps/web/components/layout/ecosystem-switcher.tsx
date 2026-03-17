"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, Youtube } from "lucide-react";

import type { Ecosystem } from "@/lib/ecosystem";
import { ECOSYSTEM_COOKIE_KEY, getEcosystemHome } from "@/lib/ecosystem";
import { cn } from "@/lib/utils";

interface EcosystemSwitcherProps {
  ecosystem: Ecosystem;
}

export function EcosystemSwitcher({ ecosystem }: EcosystemSwitcherProps) {
  const router = useRouter();
  const [pendingTarget, setPendingTarget] = useState<Ecosystem | null>(null);
  const activeEcosystem = pendingTarget ?? ecosystem;

  useEffect(() => {
    // Once server-provided ecosystem catches up, clear optimistic pending state.
    if (pendingTarget && pendingTarget === ecosystem) {
      setPendingTarget(null);
    }
  }, [ecosystem, pendingTarget]);

  useEffect(() => {
    // Prefetch target routes to make toggle feel instant.
    const xHome = getEcosystemHome("x");
    const youtubeHome = getEcosystemHome("youtube");
    router.prefetch(xHome);
    router.prefetch(youtubeHome);
  }, [router]);

  function persistEcosystemCookie(next: Ecosystem) {
    if (typeof document === "undefined") {
      return;
    }
    // Match API route cookie options for consistent server/client behavior.
    document.cookie = `${ECOSYSTEM_COOKIE_KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  function switchEcosystem(next: Ecosystem) {
    if (next === activeEcosystem || pendingTarget) {
      return;
    }

    setPendingTarget(next);
    persistEcosystemCookie(next);
    const nextHome = getEcosystemHome(next);

    // Force a full navigation so server layouts/read guards pick up the new cookie immediately.
    if (typeof window !== "undefined") {
      window.location.assign(nextHome);
      return;
    }

    router.replace(nextHome);
  }

  function tabClass(target: Ecosystem) {
    const active = target === activeEcosystem;
    return cn(
      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      pendingTarget && "opacity-90",
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border/70 bg-card/70 p-1"
      aria-busy={Boolean(pendingTarget)}
    >
      <button
        type="button"
        className={tabClass("x")}
        onClick={() => switchEcosystem("x")}
        disabled={Boolean(pendingTarget)}
        aria-pressed={activeEcosystem === "x"}
      >
        <Radar className="h-3.5 w-3.5" />X
      </button>
      <button
        type="button"
        className={tabClass("youtube")}
        onClick={() => switchEcosystem("youtube")}
        disabled={Boolean(pendingTarget)}
        aria-pressed={activeEcosystem === "youtube"}
      >
        <Youtube className="h-3.5 w-3.5" />
        YouTube
      </button>
    </div>
  );
}
