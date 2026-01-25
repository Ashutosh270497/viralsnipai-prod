import { Metadata } from "next";

import { isUiV2Enabled } from "@/lib/feature-flags";
import { LegacyMarketingPage } from "@/components/marketing/legacy-landing";
import { MarketingPageV2 } from "@/components/marketing-v2/landing-page";

export const metadata: Metadata = {
  title: "Clippers — AI Video Repurposer for Shorts, Reels, TikTok, LinkedIn, X",
  description:
    "Turn podcasts, webinars, and long videos into viral-ready clips. Hooks, captions, templates, and cross-platform exports in minutes.",
  alternates: {
    canonical: "https://clippers.app/"
  },
  openGraph: {
    title: "Clippers — AI Video Repurposer for Shorts, Reels, TikTok, LinkedIn, X",
    description:
      "Turn podcasts, webinars, and long videos into viral-ready clips. Hooks, captions, templates, and cross-platform exports in minutes.",
    type: "website",
    url: "https://clippers.app",
    images: ["/api/og?path=landing"]
  },
  twitter: {
    card: "summary_large_image",
    title: "Clippers — AI Video Repurposer",
    description:
      "Find the hook, auto-caption in your brand style, and export everywhere in one click.",
    images: ["/api/og?path=landing"]
  }
};

export default function MarketingPage() {
  const flagEnabled = isUiV2Enabled();
  if (!flagEnabled) {
    return <LegacyMarketingPage />;
  }
  return <MarketingPageV2 />;
}
