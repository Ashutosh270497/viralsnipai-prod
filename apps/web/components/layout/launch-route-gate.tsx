"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { isFeatureEnabled, type LaunchFeatureName } from "@/config/features";

type GatedRoute = {
  prefixes: string[];
  feature: LaunchFeatureName;
  title: string;
  description: string;
};

const GATED_ROUTES: GatedRoute[] = [
  {
    prefixes: ["/snipradar"],
    feature: "snipRadar",
    title: "SnipRadar is coming soon",
    description: "V1 is focused on video upload, AI clip detection, caption editing, brand kit, exports, and billing.",
  },
  {
    prefixes: ["/keywords"],
    feature: "keywordResearch",
    title: "Keyword research is coming soon",
    description: "Creator growth tools will return behind the V2 creator growth launch flag.",
  },
  {
    prefixes: ["/competitors"],
    feature: "competitorTracking",
    title: "Competitor tracking is coming soon",
    description: "Competitive intelligence is part of the V3 automation roadmap and is hidden from V1 launch.",
  },
  {
    prefixes: ["/imagen"],
    feature: "imagen",
    title: "Imagen is coming soon",
    description: "Image generation is not part of the focused V1 video repurposing launch.",
  },
  {
    prefixes: ["/veo", "/video"],
    feature: "veo",
    title: "Video generation is coming soon",
    description: "V1 only supports repurposing existing long-form videos into short-form clips.",
  },
  {
    prefixes: ["/voicer"],
    feature: "voiceCloning",
    title: "Voice cloning is coming soon",
    description: "Voice features stay hidden until the automation roadmap is enabled.",
  },
  {
    prefixes: ["/dashboard/content-calendar"],
    feature: "contentCalendar",
    title: "Content calendar is coming soon",
    description: "Planning tools are part of V2. V1 stays focused on producing clips from existing video.",
  },
  {
    prefixes: ["/dashboard/title-generator"],
    feature: "youtubeTitleGenerator",
    title: "Title generator is coming soon",
    description: "Creator growth utilities are hidden until the V2 launch flag is enabled.",
  },
  {
    prefixes: ["/dashboard/thumbnail-generator"],
    feature: "thumbnailIdeas",
    title: "Thumbnail ideas are coming soon",
    description: "Thumbnail ideation is part of V2 and is not advertised as a V1 feature.",
  },
  {
    prefixes: ["/hooksmith"],
    feature: "viralHookGenerator",
    title: "Hooksmith is coming soon",
    description: "V1 includes captions and clip review. Standalone hook generation is part of the V2 creator growth roadmap.",
  },
  {
    prefixes: ["/dashboard/script-generator", "/niche-discovery"],
    feature: "basicCreatorAnalytics",
    title: "Creator growth tools are coming soon",
    description: "V1 keeps the workspace focused on repurposing long videos into branded clips.",
  },
];

export function LaunchRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const gated = GATED_ROUTES.find((route) =>
    route.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );

  if (!gated || isFeatureEnabled(gated.feature)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/80 p-8 text-center shadow-xl shadow-slate-950/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-primary/75">
          Launch gated
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {gated.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {gated.description}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href="/repurpose"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Create a clip
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-border/70 bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
