import type { Metadata } from "next";

import { PricingPageV2 } from "@/components/marketing-v2/pricing-page";

export const metadata: Metadata = {
  title: "Pricing — ViralSnipAI",
  description:
    "Free, Plus, and Pro plans for AI video repurposing. Upload long videos, detect viral clips, add captions, export with your brand. Monthly billing via Razorpay.",
  alternates: {
    canonical: "https://viralsnipai.com/pricing",
  },
  openGraph: {
    title: "ViralSnipAI Pricing — Free, Plus, Pro",
    description:
      "Three plans for turning long videos into viral-ready short clips. AI highlight detection, brand captions, and multi-platform exports.",
    url: "https://viralsnipai.com/pricing",
    images: ["/api/og?path=pricing"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ViralSnipAI Pricing — Free, Plus, Pro",
    description:
      "AI video repurposing. Start free — 3 uploads, 5 exports per month. No credit card required.",
    images: ["/api/og?path=pricing"],
  },
};

export default function PricingPage() {
  return <PricingPageV2 />;
}
