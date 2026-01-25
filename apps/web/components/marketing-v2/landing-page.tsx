"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Download,
  LineChart,
  PenTool,
  Play,
  Sparkles,
  Wand2,
  Youtube,
  Instagram,
  Linkedin,
  Twitter,
  Scissors,
  Zap,
  Users,
  BarChart3
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { PricingGrid } from "@/components/marketing-v2/pricing-grid";
import {
  PRICING_PLANS,
  type SupportedCurrency,
  type BillingCycle,
  getMonthlyPrice
} from "@/components/marketing-v2/pricing-config";

const heroHighlights = [
  "Trusted by 1.2M+ shorts editors",
  "4.9 ★ average rating",
  "Clips ready in minutes"
];

const featureGrid = [
  {
    title: "Auto Curation",
    description: "AI scans your footage, detects viral-worthy moments, and assembles clipped timelines automatically.",
    icon: Sparkles
  },
  {
    title: "Face Tracking",
    description: "Keep speakers framed perfectly in vertical shots with real-time face detection and smart reframing.",
    icon: PenTool
  },
  {
    title: "Auto Captioning",
    description: "Burn-in captions in your fonts with emoji emphasis, karaoke highlights, and translation support.",
    icon: Wand2
  },
  {
    title: "Hook Titles & CTAs",
    description: "Generate scroll-stopping titles, call-to-actions, and overlays that keep viewers watching to the end.",
    icon: Clapperboard
  }
];

const exampleClips = [
  { title: "Creator vlog", views: "1M" },
  { title: "Podcast debate", views: "1M" },
  { title: "News reaction", views: "837K" },
  { title: "Sports highlight", views: "721K" },
  { title: "Talk show moment", views: "601K" }
];

const insightsCards = [
  {
    title: "How @kickclipper scaled to $300K/month editing IShowSpeed content",
    image: "/marketing/stories/kickclipper.png"
  },
  {
    title: "This TikTok clipper hit 32M views in 30 days using Clippers automations",
    image: "/marketing/stories/tiktok-pro.png"
  }
];

const monetizationCards = [
  {
    title: "Monetize with TikTok, YouTube, Whop, and Stake",
    image: "/marketing/monetization/multiple.png"
  },
  {
    title: "Join the TikTok Creator Rewards Program",
    image: "/marketing/monetization/rewards.png"
  }
];

const integrations = [
  { name: "YouTube", icon: Youtube },
  { name: "Instagram", icon: Instagram },
  { name: "TikTok", icon: Play },
  { name: "LinkedIn", icon: Linkedin },
  { name: "X", icon: Twitter }
];

const faqItems = [
  {
    question: "How much does an AI clip cost?",
    answer:
      "AI clipping uses one credit per processed video (up to 20 minutes). Templates have dynamic pricing, shown before rendering. Credits reset monthly."
  },
  {
    question: "Can I remove watermarks?",
    answer:
      "Yes. Pro, Expert, Business, and Custom plans unlock watermark toggles, custom overlays, and per-project branding."
  },
  {
    question: "Which platforms can I export to?",
    answer:
      "One timeline outputs Shorts, Reels, TikTok, LinkedIn, and X. Schedule posts directly or download MP4s and caption files."
  },
  {
    question: "Can my team collaborate?",
    answer:
      "Invite editors, leave frame-accurate comments, lock templates, and manage approvals before publishing."
  },
  {
    question: "Do you assist with onboarding?",
    answer:
      "Studio and Business plans include onboarding, template migration, and automation support. All plans get live chat help."
  }
];

export function MarketingPageV2() {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const prefersReducedMotion = useReducedMotion();

  const productSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Clippers",
      description: "AI workspace that turns long-form recordings into viral Shorts, Reels, TikTok, LinkedIn, and X clips.",
      brand: {
        "@type": "Organization",
        name: "Clippers",
        url: "https://clippers.app"
      },
      offers: PRICING_PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        priceCurrency: currency,
        price: String(getMonthlyPrice(plan, currency)),
        url: "https://clippers.app/pricing"
      }))
    }),
    [currency]
  );

  const faqSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }),
    []
  );

  useEffect(() => {
    trackEvent({ name: "marketing_v2_view" });
  }, []);

  return (
    <>
      <main className="flex flex-1 flex-col bg-gray-50 text-foreground dark:bg-black">
        <HeroSection />
        <TrustBadge />
        <FeatureSection />
        <ExampleSection />
        <InsightsSection />
        <MarketplaceSection />
        <MonetizationSection />
        <TemplatesSection />
        <ScheduleSection />
        <PricingSection />
        <CostTable />
        <FaqSection />
        <FinalCta />
      </main>
      <Script id="product-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(productSchema)}
      </Script>
      <Script id="faq-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(faqSchema)}
      </Script>
    </>
  );

  function HeroSection() {
    return (
      <section className="relative overflow-hidden border-b border-gray-200 bg-white dark:border-neutral-800 dark:bg-black" id="hero">
        <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 pb-24 pt-32 text-left sm:px-10 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-col gap-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">
              <Zap className="h-4 w-4" />
              Creator OS 2.0
            </div>
            <div className="space-y-6">
              <h1 className="text-balance text-5xl font-bold leading-tight text-gray-900 sm:text-6xl md:text-[3.75rem] dark:text-white">
                Turn one recording into a week of ready-to-post clips
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
                Clippers finds viral hooks, remixes layouts, burns captions, and queues exports for every channel. Drop your long-form video, choose a template, and publish with branded overlays in minutes.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button size="lg" className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                Start for free
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-lg border-gray-300 px-8 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
              >
                Watch 90s demo
              </Button>
            </div>
            <div className="grid gap-4 text-base text-gray-600 sm:grid-cols-2 dark:text-neutral-400">
              {[
                "Template marketplace with creator revenue share",
                "Auto captions with brand fonts & karaoke highlights",
                "Multi-platform exports sized for Shorts, Reels & TikTok",
                "Team approvals, comments, and schedule queue"
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <SocialProof />
          </div>
          <HeroVisual prefersReducedMotion={prefersReducedMotion} />
        </div>
      </section>
    );
  }

  function SocialProof() {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <AvatarGroup />
        <div className="flex items-center gap-1.5 text-gray-900 dark:text-white">
          {Array.from({ length: 5 }).map((_, index) => (
            <span key={index} className="text-lg text-yellow-400">
              ★
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-600 dark:text-neutral-400">
          Trusted by 1.2M+ shorts clippers · 4.9 out of 5
        </p>
      </div>
    );
  }

  function AvatarGroup() {
    return (
      <div className="flex -space-x-2">
        {[1, 2, 3, 4].map((index) => (
          <span
            key={index}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-sm font-semibold text-gray-700 dark:border-neutral-900 dark:bg-neutral-700 dark:text-neutral-200"
          >
            {index === 1 ? "MJ" : index === 2 ? "AL" : index === 3 ? "RS" : "PK"}
          </span>
        ))}
      </div>
    );
  }

  function TrustBadge() {
    return (
      <section className="border-b border-gray-200 bg-white py-16 text-center dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-500">Trusted by video-first teams</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-gray-700 dark:text-neutral-300">
            {["Morning Brew", "HubSpot Podcast Network", "Creator House", "Hootsuite", "VaynerMedia"].map((brand) => (
              <span key={brand} className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function FeatureSection() {
    return (
      <section className="border-b border-gray-200 bg-white py-24 dark:border-neutral-800 dark:bg-black" id="features">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="text-center md:text-left">
            <Badge className="bg-blue-50 text-blue-600 border-blue-200 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">AI powered features</Badge>
            <h2 className="mt-4 text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">AI handles the editing. You own the storytelling.</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">
              From auto curation to hook generation, Clippers removes repetitive timelines so you can focus on creative direction.
            </p>
          </header>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {featureGrid.map((feature) => (
              <Card key={feature.title} className="border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow dark:border-neutral-800 dark:bg-neutral-900">
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                    <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function ExampleSection() {
    return (
      <section className="border-b border-gray-200 bg-gray-50 py-24 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 text-center sm:px-10">
          <div>
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Example Clips</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-neutral-400">
              Pull breakout moments and let Clippers remix them for each platform automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch justify-center gap-6">
            {exampleClips.map((clip) => (
              <div key={clip.title} className="flex h-72 w-40 flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="h-48 rounded-xl bg-blue-600" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{clip.title}</p>
                <span className="text-xs text-gray-600 dark:text-neutral-400">
                  ▶ {clip.views}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function InsightsSection() {
    return (
      <section className="border-b border-gray-200 bg-white py-24 dark:border-neutral-800 dark:bg-black" id="insights">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="text-center md:text-left">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Insights</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">
              Learn the content strategies used by top clippers building massive audiences.
            </p>
          </header>
          <div className="grid gap-8 lg:grid-cols-2">
            {insightsCards.map((insight) => (
              <div key={insight.title} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="h-56 w-full bg-blue-600" />
                <div className="px-8 py-6 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{insight.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function MarketplaceSection() {
    return (
      <section className="border-b border-gray-200 bg-gray-50 py-24 dark:border-neutral-800 dark:bg-neutral-950" id="marketplace">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="text-center md:text-left">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Template Marketplace</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">
              Submit, discover, and monetize Clippers templates. Showcase your designs or install proven systems created by the community.
            </p>
          </header>
          <div className="grid gap-8 lg:grid-cols-3">
            <Card className="border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Creator submissions</CardTitle>
                <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                  Publish your templates with safe zone checks, captions, and motion presets. Our review workflow keeps quality high while crediting every creator.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Search & discovery</CardTitle>
                <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                  Filter by niche, aspect ratio, or runtime. Preview templates with live clips and one-click install them into your workspace.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                  <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">Revenue share</CardTitle>
                <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                  Earn 70% on every sale, with monthly payouts. Teams can co-author packs, track analytics, and run promotions right from Clippers.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="rounded-lg bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700">
              <Link href="/templates">Browse templates</Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="rounded-lg border-gray-300 px-8 text-base font-semibold dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900">
              <Link href="/templates/submit">Submit your template</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  function MonetizationSection() {
    return (
      <section className="border-b border-gray-200 bg-white py-24 dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="text-center md:text-left">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Monetization</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">Learn the strategies to monetize your viral clips.</p>
          </header>
          <div className="grid gap-8 lg:grid-cols-2">
            {monetizationCards.map((item) => (
              <div key={item.title} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="h-52 w-full bg-blue-600" />
                <div className="px-8 py-6 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function TemplatesSection() {
    return (
      <section className="border-b border-gray-200 bg-gray-50 py-24 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 text-center sm:px-10">
          <Badge className="mx-auto bg-blue-50 text-blue-600 border-blue-200 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-400">AI Templates</Badge>
          <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Create viral clips with trending AI templates</h2>
          <p className="text-lg text-gray-600 dark:text-neutral-400">
            Explore the library and remix trending formats without prompt engineering.
          </p>
          <Button size="lg" className="mx-auto rounded-lg bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700">
            Explore Templates
          </Button>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-48 rounded-xl border border-gray-200 bg-blue-600 shadow-sm dark:border-neutral-800" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  function ScheduleSection() {
    return (
      <section className="border-b border-gray-200 bg-white py-24 dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="text-center md:text-left">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Schedule and Post</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">
              Schedule content across TikTok, YouTube, and Instagram automatically. Set once and let Clippers post while you focus on strategy.
            </p>
          </header>
          <div className="grid gap-8 md:grid-cols-2">
            <ScheduleTile title="Schedule once, post everywhere">
              Queue Shorts, Reels, and TikTok uploads at peak times without leaving Clippers. Auto-attach captions and thumbnails.
            </ScheduleTile>
            <ScheduleTile title="Automated titles & descriptions">
              Generate optimized titles, descriptions, and hashtags with AI to maximize discoverability across every platform.
            </ScheduleTile>
          </div>
        </div>
      </section>
    );
  }

  function ScheduleTile({ title, children }: { title: string; children: ReactNode }) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-left shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-neutral-400">{children}</p>
      </div>
    );
  }

  function PricingSection() {
    return (
      <section className="border-b border-gray-200 bg-gray-50 py-24 dark:border-neutral-800 dark:bg-neutral-950" id="pricing">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 sm:px-10">
          <header className="flex flex-col gap-6 text-center md:text-left">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Pricing</h2>
              <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">Save 30% with yearly billing. Switch currencies anytime.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                {(["USD", "INR"] as SupportedCurrency[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCurrency(value)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-semibold transition",
                      currency === value ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                {(["monthly", "yearly"] as BillingCycle[]).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "rounded-md px-4 py-2 text-sm font-semibold capitalize transition",
                      billingCycle === cycle
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                    )}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View full pricing <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </header>
          <PricingGrid
            currency={currency}
            billingCycle={billingCycle}
            onSelectPlan={(planId, cycle) =>
              trackEvent({ name: "pricing_select", payload: { plan: planId, cycle, currency } })
            }
          />
        </div>
      </section>
    );
  }

  function CostTable() {
    return (
      <section className="border-b border-gray-200 bg-white py-24 dark:border-neutral-800 dark:bg-black">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 sm:px-10">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">How much does a video cost?</h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-neutral-400">
              Clip with transparent credit pricing for Hooksmith and AI templates.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-left text-base">
              <thead className="bg-gray-50 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
                <tr>
                  <th className="px-8 py-4 font-semibold">AI Tool</th>
                  <th className="px-8 py-4 font-semibold">Credit cost</th>
                  <th className="px-8 py-4 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200 dark:border-neutral-800">
                  <td className="px-8 py-4 font-semibold text-gray-900 dark:text-white">
                    AI Clipping <span className="ml-2 rounded-full bg-green-50 px-3 py-1 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">¼ competitor price</span>
                  </td>
                  <td className="px-8 py-4 text-gray-600 dark:text-neutral-400">1 credit per video (20 minutes)</td>
                  <td className="px-8 py-4 text-gray-600 dark:text-neutral-400">Includes hooks, captions, smart crops</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-neutral-800">
                  <td className="px-8 py-4 font-semibold text-gray-900 dark:text-white">AI Templates</td>
                  <td className="px-8 py-4 text-gray-600 dark:text-neutral-400">Different per template</td>
                  <td className="px-8 py-4 text-gray-600 dark:text-neutral-400">
                    See template gallery <Link href="/templates" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Learn more</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  function FaqSection() {
    return (
      <section className="border-b border-gray-200 bg-gray-50 py-24 dark:border-neutral-800 dark:bg-neutral-950" id="faq">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 sm:px-10">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">Frequently asked questions</h2>
          </div>
          <div className="space-y-4">
            {faqItems.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-gray-200 bg-white px-8 py-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-semibold text-gray-900 dark:text-white">
                  {faq.question}
                  <span className="text-gray-400 transition group-open:rotate-90 dark:text-neutral-500">
                    →
                  </span>
                </summary>
                <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-neutral-400">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function FinalCta() {
    return (
      <section className="bg-white py-20 text-center dark:bg-black">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-6">
          <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl dark:text-white">
            Ready to create engaging Shorts today?
          </h2>
          <p className="text-lg text-gray-600 dark:text-neutral-400">
            Drop your video link and start generating viral clips in minutes.
          </p>
          <div className="w-full max-w-xl">
            <form className="flex items-center gap-3" onSubmit={(event) => event.preventDefault()}>
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500"
              />
              <Button
                type="submit"
                size="lg"
                className="rounded-lg bg-blue-600 px-8 text-base font-semibold text-white hover:bg-blue-700"
                onClick={() => trackEvent({ name: "hero_get_clips" })}
              >
                Generate preview
              </Button>
            </form>
          </div>
        </div>
      </section>
    );
  }
}

function HeroVisual({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-lg"
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      animate={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-4">
          <div className="rounded-xl bg-blue-600 p-6 text-white shadow-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-100">
              <span>Clip remix timeline</span>
              <span>Live</span>
            </div>
            <p className="mt-4 text-xl font-bold">"Creator Economy Roundtable"</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-100">
              <span className="rounded-full bg-blue-500 px-3 py-1">12 highlights</span>
              <span className="rounded-full bg-blue-500 px-3 py-1">Auto captions on</span>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Marketplace</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-neutral-400">"Viral Coach Starter Pack" installed for this project.</p>
              <Button variant="ghost" size="sm" className="mt-3 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-neutral-700">
                Manage templates
              </Button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Smart captions</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-neutral-400">Translate to 6 languages with karaoke highlights.</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Download className="h-3.5 w-3.5" />
                  Export SRT
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-5 text-sm text-gray-700 dark:border-blue-900 dark:bg-blue-950 dark:text-neutral-300">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <span>Schedule queue</span>
              <span>Tomorrow · 09:00</span>
            </div>
            <p className="mt-3 text-gray-900 dark:text-white">Shorts, Reels, TikTok, and LinkedIn posts ready to publish with branded overlays.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
