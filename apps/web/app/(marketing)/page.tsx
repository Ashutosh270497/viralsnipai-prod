import { Metadata } from "next";

import { MarketingPageV3 } from "@/components/marketing-v2/landing-page";

export const metadata: Metadata = {
  title: "ViralSnipAI - AI Long-Video to Viral Clips Platform",
  description:
    "Turn long-form videos into viral-ready short clips with precise AI clipping, transcript editing, captions, reframe, export, brand templates, and creator workflows.",
  alternates: {
    canonical: "https://viralsnipai.com/"
  },
  openGraph: {
    title: "ViralSnipAI - AI Long-Video to Viral Clips Platform",
    description:
      "Turn long videos into viral-ready short clips with precise clipping, transcript editing, captions, reframe, and export.",
    type: "website",
    url: "https://viralsnipai.com",
    images: ["/api/og?path=landing"]
  },
  twitter: {
    card: "summary_large_image",
    title: "ViralSnipAI - AI Long-Video to Viral Clips Platform",
    description:
      "Upload long videos, generate precise clips, edit by transcript, style captions, reframe, and export.",
    images: ["/api/og?path=landing"]
  }
};

export default function MarketingPage() {
  return <MarketingPageV3 />;
}
