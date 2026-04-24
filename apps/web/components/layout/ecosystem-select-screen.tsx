"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Youtube, Radar, Loader2 } from "lucide-react";

import type { Ecosystem } from "@/lib/ecosystem";
import { getEcosystemHome, isRouteAllowedForEcosystem } from "@/lib/ecosystem";
import { isFeatureEnabled } from "@/config/features";

const SNIPRADAR_ENABLED = isFeatureEnabled("snipRadar");

interface EcosystemSelectScreenProps {
  userName?: string;
}

export function EcosystemSelectScreen({ userName }: EcosystemSelectScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<Ecosystem | null>(null);

  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/")) {
      return null;
    }
    return raw;
  }, [searchParams]);

  async function handleSelect(ecosystem: Ecosystem) {
    setPending(ecosystem);
    try {
      const response = await fetch("/api/ecosystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ecosystem }),
      });

      if (!response.ok) {
        throw new Error("Failed to save ecosystem preference");
      }

      const fallbackHome = getEcosystemHome(ecosystem);
      const destination =
        nextPath && isRouteAllowedForEcosystem(nextPath, ecosystem) ? nextPath : fallbackHome;
      router.replace(destination);
    } catch (error) {
      console.error("[Ecosystem Select] Failed to persist preference", error);
      setPending(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-4xl flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Workspace Mode
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pick Your Creator Ecosystem
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          {userName
            ? `${userName}, choose where you want to work first.`
            : "Choose where you want to work first."}{" "}
          You can switch anytime from the top-right toggle.
        </p>
      </div>

      <div className={SNIPRADAR_ENABLED ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
        <button
          type="button"
          onClick={() => handleSelect("youtube")}
          disabled={pending !== null}
          className="group rounded-2xl border border-border/70 bg-card/60 p-6 text-left transition hover:border-primary/40 hover:bg-card"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Youtube className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold">ViralSnipAI Core</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Turn long videos into short clips with AI detection, captions, brand styling, and
            exports.
          </p>
          <div className="mt-5">
            <div className="inline-flex items-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
              {pending === "youtube" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enter Core Workspace
            </div>
          </div>
        </button>

        {SNIPRADAR_ENABLED ? (
          <button
            type="button"
            onClick={() => handleSelect("x")}
            disabled={pending !== null}
            className="group rounded-2xl border border-border/70 bg-card/60 p-6 text-left transition hover:border-primary/40 hover:bg-card"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Radar className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">Automation OS</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access SnipRadar, X automation, scheduling, CRM, APIs, and advanced growth workflows.
            </p>
            <div className="mt-5">
              <div className="inline-flex items-center rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                {pending === "x" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enter Automation OS
              </div>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
