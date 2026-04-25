import { Metadata } from "next";

import { MarketingPageV3 as MarketingPageV2 } from "@/components/marketing-v2/landing-page";

export const metadata: Metadata = {
  title: "ViralSnipAI — AI Video Repurposer for Shorts, Reels & LinkedIn",
  description:
    "Turn podcasts, webinars, interviews, and tutorials into viral-ready short clips with AI hooks, branded captions, and platform-ready exports.",
  alternates: {
    canonical: "https://viralsnipai.com/"
  },
  openGraph: {
    title: "ViralSnipAI — AI Video Repurposer for Shorts, Reels & LinkedIn",
    description:
      "Turn long videos into viral-ready short clips with AI hooks, branded captions, and platform-ready exports.",
    type: "website",
    url: "https://viralsnipai.com",
    images: ["/api/og?path=landing"]
  },
  twitter: {
    card: "summary_large_image",
    title: "ViralSnipAI — AI Video Repurposer for Shorts, Reels & LinkedIn",
    description:
      "Upload long videos, detect highlights, add branded captions, and export clips ready to post.",
    images: ["/api/og?path=landing"]
  }
};

export default function MarketingPage() {
  return <MarketingPageV2 />;
}
