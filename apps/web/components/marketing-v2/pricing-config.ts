/**
 * V1 marketing pricing configuration — video repurposing launch.
 *
 * Plan IDs map to the billing system: free → free, plus → plus, pro → pro.
 * Upload and export limits are enforced server-side in lib/media/v1-media-policy.ts.
 * All features listed here must be live and testable in V1.
 * Do not list V2/V3 features (scheduling, analytics, SnipRadar) here.
 */

export type SupportedCurrency = "USD" | "INR";
export type MarketingPlanId = "free" | "plus" | "pro";

export interface PricingPlan {
  id: MarketingPlanId;
  name: string;
  tagline: string;
  features: string[];
  isFeatured?: boolean;
  priceUSD: number;
  priceINR: number;
}

export type PricingComparisonRow = {
  feature: string;
  free: string;
  plus: string;
  pro: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try ViralSnipAI with no commitment.",
    priceUSD: 0,
    priceINR: 0,
    features: [
      "3 video uploads per month",
      "5 clip exports per month",
      "AI highlight detection",
      "Basic auto-captions",
      "ViralSnipAI watermark on exports",
      "Virality scoring on detected clips",
      "MP4 download",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline: "For creators shipping short-form content every week.",
    priceUSD: 9,
    priceINR: 799,
    isFeatured: true,
    features: [
      "25 video uploads per month",
      "50 clip exports per month",
      "No watermark on exports",
      "Brand kit — colors, fonts, logo, watermark",
      "Caption styling with brand colors and fonts",
      "All aspect ratios (Shorts, Reels, TikTok, LinkedIn, X)",
      "All formats: MP4, MOV, WebM, MP3, WAV",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For agencies, podcasters, and high-volume workflows.",
    priceUSD: 19,
    priceINR: 1799,
    features: [
      "100 video uploads per month",
      "250 clip exports per month",
      "Everything in Plus",
      "3 brand kits",
      "Priority AI processing",
      "Advanced export presets",
      "Sources up to 500 MB and 1 hour",
    ],
  },
];

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    feature: "Video uploads / month",
    free: "3",
    plus: "25",
    pro: "100",
  },
  {
    feature: "Clip exports / month",
    free: "5",
    plus: "50",
    pro: "250",
  },
  {
    feature: "AI highlight detection",
    free: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Virality scoring",
    free: "Included",
    plus: "Included",
    pro: "Included",
  },
  {
    feature: "Auto-captions",
    free: "Basic",
    plus: "Brand-styled",
    pro: "Brand-styled",
  },
  {
    feature: "Watermark",
    free: "ViralSnipAI watermark",
    plus: "Removed",
    pro: "Removed",
  },
  {
    feature: "Brand kit",
    free: "Not included",
    plus: "1 brand kit",
    pro: "3 brand kits",
  },
  {
    feature: "Export aspect ratios",
    free: "9:16 (Shorts)",
    plus: "All platforms",
    pro: "All platforms",
  },
  {
    feature: "AI processing priority",
    free: "Standard",
    plus: "Standard",
    pro: "Priority",
  },
  {
    feature: "Max source file size",
    free: "500 MB",
    plus: "500 MB",
    pro: "500 MB",
  },
];

export function getMonthlyPrice(plan: PricingPlan, currency: SupportedCurrency) {
  return currency === "USD" ? plan.priceUSD : plan.priceINR;
}
