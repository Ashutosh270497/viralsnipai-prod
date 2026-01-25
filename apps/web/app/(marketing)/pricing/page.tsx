import { Metadata } from "next";

import { isUiV2Enabled } from "@/lib/feature-flags";
import { PricingPageV2 } from "@/components/marketing-v2/pricing-page";
import { LegacyMarketingPlaceholder } from "@/components/marketing/legacy-placeholder";

export const metadata: Metadata = {
  title: "Clippers Pricing — Plans for creators, agencies, and brands",
  description:
    "Compare Clippers plans. Start free, upgrade to Pro for 1080p exports and brand kits, or scale with Agency and Enterprise.",
  openGraph: {
    title: "Clippers Pricing",
    description:
      "Flexible plans for AI hooks, captioned clips, and branded exports. Free, Pro, Agency, and Enterprise tiers.",
    url: "https://clippers.app/pricing",
    images: ["/api/og?path=pricing"]
  }
};

export default function PricingPage() {
  const enabled = isUiV2Enabled();
  if (!enabled) {
    return (
      <LegacyMarketingPlaceholder
        title="Pricing overview"
        description="Full pricing breakdown is coming soon. In the meantime, sign in to view the billing page inside the app."
      />
    );
  }

  return <PricingPageV2 />;
}
