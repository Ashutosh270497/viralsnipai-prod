import { Metadata } from "next";

import { isUiV2Enabled } from "@/lib/feature-flags";
import { PricingPageV2 } from "@/components/marketing-v2/pricing-page";
import { LegacyMarketingPlaceholder } from "@/components/marketing/legacy-placeholder";

export const metadata: Metadata = {
  title: "ViralSnipAI Pricing — Free, Plus, and Pro",
  description:
    "Compare ViralSnipAI Free, Plus, and Pro plans. Monthly Razorpay billing for India and global customers.",
  openGraph: {
    title: "ViralSnipAI Pricing",
    description:
      "Flexible monthly plans for AI hooks, captioned clips, branded exports, and SnipRadar growth workflows. Free, Plus, and Pro tiers.",
    url: "https://viralsnipai.com/pricing",
    images: ["/api/og?path=pricing"]
  }
};

export default function PricingPage() {
  const enabled = isUiV2Enabled();
  if (!enabled) {
    return (
      <LegacyMarketingPlaceholder
        title="Pricing overview"
        description="Pricing is available in the new billing workspace. Sign in to manage plans and start a Razorpay subscription."
      />
    );
  }

  return <PricingPageV2 />;
}
