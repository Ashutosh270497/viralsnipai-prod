"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Captions,
  CheckCircle2,
  CreditCard,
  Download,
  FileVideo,
  Layers3,
  MessageSquare,
  Mic2,
  Palette,
  Play,
  Presentation,
  Ratio,
  Scissors,
  Sparkles,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingGrid } from "@/components/marketing-v2/pricing-grid";
import {
  PRICING_PLANS,
  getMonthlyPrice,
  type SupportedCurrency,
} from "@/components/marketing-v2/pricing-config";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const trustItems = ["3 free uploads/month", "No credit card required", "Cancel anytime"];

const workflow = [
  {
    title: "Upload long video",
    description: "Drop in a podcast, webinar, interview, tutorial, or founder recording.",
    icon: Upload,
    cue: "MP4, MOV, WebM",
  },
  {
    title: "AI finds high-retention moments",
    description: "ViralSnipAI transcribes the source and ranks moments by hook strength.",
    icon: Sparkles,
    cue: "8 clips detected",
  },
  {
    title: "Edit hooks, captions, and brand style",
    description: "Review clip boundaries, tune captions, and apply your brand kit.",
    icon: Wand2,
    cue: "Hook score 92",
  },
  {
    title: "Export platform-ready clips",
    description: "Render short-form MP4s ready for Shorts, Reels, LinkedIn, and feeds.",
    icon: Download,
    cue: "9:16 export ready",
  },
];

const useCases = [
  {
    name: "Podcasts",
    description: "Pull the strongest ideas, stories, and guest moments out of long episodes.",
    icon: Mic2,
  },
  {
    name: "Webinars & demos",
    description: "Turn product explainers and Q&A segments into crisp short-form clips.",
    icon: Presentation,
  },
  {
    name: "Founder videos",
    description: "Repurpose POVs, launches, and thought leadership into repeatable content.",
    icon: UserRound,
  },
  {
    name: "Tutorials & courses",
    description: "Break dense lessons into standalone clips that drive attention back.",
    icon: BookOpen,
  },
  {
    name: "Interviews",
    description: "Find quote-worthy answers and package them with captions in minutes.",
    icon: MessageSquare,
  },
  {
    name: "Agency client content",
    description: "Process client recordings without rebuilding captions and brand style each time.",
    icon: Users,
  },
];

const v1Features = [
  {
    title: "AI clip detection",
    description: "Finds promising moments automatically and ranks them for review.",
    icon: Scissors,
  },
  {
    title: "Auto captions",
    description: "Creates timestamped captions you can edit before export.",
    icon: Captions,
  },
  {
    title: "Hook suggestions",
    description: "Surfaces stronger framing for the first seconds of each clip.",
    icon: Zap,
  },
  {
    title: "Brand kit",
    description: "Apply fonts, colors, logo, and caption style consistently.",
    icon: Palette,
  },
  {
    title: "9:16 exports",
    description: "Ship vertical clips for Shorts, Reels, TikTok, and LinkedIn.",
    icon: Ratio,
  },
  {
    title: "Download-ready MP4",
    description: "Export rendered clips that are ready to post or hand off.",
    icon: FileVideo,
  },
  {
    title: "Usage limits and billing",
    description: "Free, Plus, and Pro limits are clear and enforced server-side.",
    icon: CreditCard,
  },
];

const faqItems = [
  {
    question: "What kind of videos work best?",
    answer:
      "Podcasts, webinars, interviews, tutorials, course lessons, founder videos, and demos work best because they contain enough context for the AI to identify strong moments.",
  },
  {
    question: "Can I use it for YouTube Shorts and Instagram Reels?",
    answer:
      "Yes. V1 focuses on short-form repurposing, including vertical exports for YouTube Shorts, Instagram Reels, TikTok, and LinkedIn-style clips.",
  },
  {
    question: "Does it guarantee virality?",
    answer:
      "No. ViralSnipAI improves your starting point by finding stronger moments, hooks, captions, and formats. Actual performance still depends on the content, audience, timing, and distribution.",
  },
  {
    question: "Can I remove watermark?",
    answer:
      "Free exports include a ViralSnipAI watermark. Plus and Pro plans are designed for watermark-free branded exports.",
  },
  {
    question: "Do I need editing experience?",
    answer:
      "No. The flow is built for creators and teams who want AI to do the first pass. You can still review clips, edit captions, adjust style, and choose what to export.",
  },
  {
    question: "What happens to my uploaded videos?",
    answer:
      "Uploaded videos are stored so ViralSnipAI can process clips, captions, and exports for your account. Your projects and exports are protected by server-side ownership checks.",
  },
];

export function MarketingPageV3() {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const prefersReducedMotion = useReducedMotion() || false;

  const productSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "ViralSnipAI",
      description:
        "ViralSnipAI turns long videos into viral-ready short clips with AI hooks, captions, and branded exports.",
      brand: { "@type": "Organization", name: "ViralSnipAI", url: "https://viralsnipai.com" },
      offers: PRICING_PLANS.filter((plan) => plan.id !== "free").map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        priceCurrency: currency,
        price: String(getMonthlyPrice(plan, currency)),
        url: "https://viralsnipai.com/pricing",
      })),
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
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    }),
    []
  );

  useEffect(() => {
    trackEvent({ name: "marketing_landing_view" });
  }, []);

  return (
    <>
      <main className="flex flex-1 flex-col overflow-hidden bg-[#f8fbfb] text-slate-950 dark:bg-[#081111] dark:text-white">
        <HeroSection prefersReducedMotion={prefersReducedMotion} />
        <WorkflowSection />
        <UseCasesSection />
        <FeaturesSection />
        <PricingSection currency={currency} setCurrency={setCurrency} />
        <FaqSection />
        <CtaSection />
      </main>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Button
          asChild
          size="lg"
          className="h-12 w-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-xl shadow-emerald-900/20"
        >
          <Link href="/signup">
            Start free
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Script id="product-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(productSchema)}
      </Script>
      <Script id="faq-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(faqSchema)}
      </Script>
    </>
  );
}

function HeroSection({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <section className="relative isolate overflow-hidden px-6 pb-20 pt-20 sm:pb-28 sm:pt-28 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.22),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f5fbfa_58%,#eef9fb_100%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(20,184,166,0.24),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(79,70,229,0.18),transparent_30%),linear-gradient(180deg,#0d1918_0%,#081111_66%,#0c181f_100%)]" />
      <div className="absolute left-1/2 top-24 -z-10 h-72 w-[56rem] -translate-x-1/2 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" />

      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <Badge className="mb-7 gap-2 rounded-full border-emerald-500/25 bg-white/75 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-950/5 backdrop-blur dark:bg-white/[0.08] dark:text-emerald-200">
              <Sparkles className="h-4 w-4" />
              V1 beta for video repurposing
            </Badge>
          </motion.div>

          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-balance text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl dark:text-white"
          >
            Turn long videos into{" "}
            <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 bg-clip-text text-transparent">
              viral-ready clips
            </span>
          </motion.h1>

          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className="mx-auto mt-6 max-w-3xl text-pretty text-lg leading-8 text-slate-700 sm:text-xl dark:text-slate-300"
          >
            Upload podcasts, webinars, interviews, or tutorials. ViralSnipAI finds the
            strongest moments, adds branded captions, and exports short-form clips ready to post.
          </motion.p>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 text-base font-semibold text-white shadow-2xl shadow-emerald-600/25 hover:from-emerald-400 hover:to-cyan-400 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:ring-offset-[#081111]"
              onClick={() => trackEvent({ name: "cta_start_free", payload: { source: "hero" } })}
            >
              <Link href="/signup">
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-slate-300 bg-white/70 px-8 text-base font-semibold text-slate-900 shadow-sm backdrop-blur hover:bg-white focus-visible:ring-2 focus-visible:ring-cyan-400 dark:border-white/15 dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12]"
            >
              <Link href="#how-it-works">
                <Play className="mr-2 h-4 w-4" />
                See how it works
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {trustItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        <ProductMockup prefersReducedMotion={prefersReducedMotion} />
      </div>
    </section>
  );
}

function ProductMockup({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.28 }}
      className="relative mx-auto mt-16 max-w-6xl"
    >
      <div className="absolute inset-x-10 -top-8 -z-10 h-40 rounded-full bg-gradient-to-r from-emerald-400/25 via-cyan-400/20 to-blue-500/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur dark:border-white/10 dark:bg-white/[0.08] dark:shadow-black/40">
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 dark:border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 sm:block">
              Project: Founder interview - Q2 launch
            </div>
          </div>

          <div className="grid min-h-[460px] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative bg-[radial-gradient(circle_at_30%_22%,rgba(20,184,166,0.22),transparent_28%),linear-gradient(135deg,#172033,#0b1220)] p-5 sm:p-8">
              <div className="aspect-video overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
                <div className="flex h-full flex-col justify-between bg-[linear-gradient(135deg,rgba(20,184,166,0.28),rgba(37,99,235,0.14)_40%,rgba(15,23,42,0.92)),url('/api/og?path=landing')] bg-cover bg-center p-5">
                  <div className="flex items-center justify-between">
                    <Badge className="border-white/15 bg-black/30 text-white backdrop-blur">00:18 - 00:43</Badge>
                    <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-100">Hook score: 92</Badge>
                  </div>
                  <div className="rounded-2xl bg-black/40 p-4 text-left backdrop-blur">
                    <p className="text-lg font-semibold text-white">&ldquo;This is the moment your audience rewatches.&rdquo;</p>
                    <p className="mt-2 text-sm text-slate-300">Caption style: Bold clean, emerald highlight</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-4 gap-2">
                {[82, 92, 76, 88].map((score, index) => (
                  <div key={score} className="rounded-2xl border border-white/10 bg-white/[0.08] p-3">
                    <div className="mb-2 h-12 rounded-xl bg-gradient-to-br from-cyan-400/30 to-blue-500/20" />
                    <p className="text-xs font-semibold text-white">Clip {index + 1}</p>
                    <p className="text-[11px] text-slate-400">Score {score}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-900/95 p-5 sm:p-8 lg:border-l lg:border-t-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-300">AI clip queue</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">8 clips detected</h2>
                </div>
                <div className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Ready
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {[
                  ["Captions added", "Timestamped SRT generated", "100%"],
                  ["Brand kit applied", "Logo, color, font", "100%"],
                  ["Platform preset", "Shorts/Reels/LinkedIn", "Ready"],
                ].map(([title, subtitle, value]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-white">{title}</p>
                        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
                      </div>
                      <span className="text-sm font-semibold text-cyan-200">{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                <p className="text-sm font-semibold text-cyan-100">Suggested hook</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Start with the surprising claim, then show the proof in the first five seconds.
                </p>
              </div>
            </div>
          </div>
        </div>

        <FloatingBadge className="-left-2 top-16 sm:-left-8" icon={BadgeCheck} title="8 clips detected" subtitle="Ranked by hook strength" />
        <FloatingBadge className="-right-2 top-36 sm:-right-8" icon={Captions} title="Captions added" subtitle="Brand colors applied" />
        <FloatingBadge className="bottom-8 left-6 sm:left-12" icon={TrendingUp} title="Hook score: 92" subtitle="High-retention moment" />
        <FloatingBadge className="bottom-20 right-4 hidden sm:flex" icon={Layers3} title="Ready for Shorts/Reels/LinkedIn" subtitle="Platform-ready exports" />
      </div>
    </motion.div>
  );
}

function FloatingBadge({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: typeof Sparkles;
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute hidden max-w-[230px] items-center gap-3 rounded-2xl border border-white/70 bg-white/90 p-3 shadow-xl shadow-slate-900/10 backdrop-blur md:flex dark:border-white/10 dark:bg-slate-900/90",
        className
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-950 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-600 dark:text-slate-400">{subtitle}</span>
      </span>
    </div>
  );
}

function WorkflowSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" ref={ref} className="px-6 py-24 lg:px-8">
      <SectionHeading
        eyebrow="How it works"
        title="From long-form recording to short-form assets"
        description="A focused V1 workflow for turning raw video into clips your team can review, export, and publish."
      />
      <div className="mx-auto mt-14 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflow.map((step, index) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-950/10 dark:border-white/10 dark:bg-white/[0.055] dark:hover:border-emerald-300/30"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 opacity-80" />
            <div className="mb-8 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/15">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-slate-400">0{index + 1}</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-950 dark:text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              {step.description}
            </p>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">
              {step.cue}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function UseCasesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="border-y border-slate-200/80 bg-white/70 px-6 py-24 dark:border-white/10 dark:bg-white/[0.035] lg:px-8">
      <SectionHeading
        eyebrow="Built for creators and teams"
        title="One workflow for the content you already record"
        description="ViralSnipAI is intentionally focused on long video repurposing for the V1 beta."
      />
      <div ref={ref} className="mx-auto mt-14 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {useCases.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.42, delay: index * 0.06 }}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5 transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-950/10 dark:border-white/10 dark:bg-[#0f1d1f] dark:hover:border-cyan-300/30"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 transition group-hover:scale-105 dark:bg-cyan-400/10 dark:text-cyan-200 dark:ring-cyan-300/15">
              <item.icon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{item.name}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="px-6 py-24 lg:px-8">
      <SectionHeading
        eyebrow="What's included in V1"
        title="Launch-ready video repurposing features"
        description="No scheduling suite, competitor tracker, or automation OS here. V1 stays focused on upload, clips, captions, brand, export, and billing."
      />
      <div ref={ref} className="mx-auto mt-14 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {v1Features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 18 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.42, delay: index * 0.05 }}
            className={cn(
              "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.055]",
              index === 0 && "lg:col-span-1"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-lg shadow-emerald-900/20">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{feature.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function PricingSection({
  currency,
  setCurrency,
}: {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      id="pricing"
      className="border-y border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#eef9fb_100%)] px-6 py-24 dark:border-white/10 dark:bg-[linear-gradient(180deg,#0b1718_0%,#0c1720_100%)] lg:px-8"
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.45 }}
      >
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when clips become a workflow."
          description="Free, Plus, and Pro stay focused on the V1 repurposing product. India-friendly INR pricing is available."
        />
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
            {(["USD", "INR"] as SupportedCurrency[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCurrency(item)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                  currency === item
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-14 max-w-7xl">
          <PricingGrid
            currency={currency}
            onSelectPlan={(planId) =>
              trackEvent({ name: "pricing_select", payload: { plan: planId, currency } })
            }
          />
        </div>
      </motion.div>
    </section>
  );
}

function FaqSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" ref={ref} className="px-6 py-24 lg:px-8">
      <SectionHeading
        eyebrow="FAQ"
        title="Straight answers before beta"
        description="V1 is intentionally narrow: upload long video, generate clips, edit captions, apply brand, export."
      />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqItems.map((item, index) => (
          <motion.div
            key={item.question}
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35, delay: index * 0.04 }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm shadow-slate-950/5 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 dark:border-white/10 dark:bg-white/[0.055] dark:hover:border-emerald-300/30"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-slate-950 sm:text-lg dark:text-white">
                  {item.question}
                </h3>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {openIndex === index ? "-" : "+"}
                </span>
              </div>
              <motion.div
                initial={false}
                animate={{ height: openIndex === index ? "auto" : 0, opacity: openIndex === index ? 1 : 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.answer}</p>
              </motion.div>
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="px-6 pb-24 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 px-6 py-16 text-center shadow-2xl shadow-slate-950/20 dark:border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(20,184,166,0.34),transparent_34%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.25),transparent_28%)]" />
        <div className="relative mx-auto max-w-3xl">
          <Badge className="mb-6 border-white/15 bg-white/10 text-emerald-100">V1 beta is open</Badge>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ready to turn your next long video into clips?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Upload your next podcast, demo, tutorial, or interview and leave with short-form clips ready to review and export.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-9 rounded-full bg-white px-8 font-semibold text-slate-950 shadow-xl hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300"
            onClick={() => trackEvent({ name: "cta_start_free", payload: { source: "final_cta" } })}
          >
            <Link href="/signup">
              Start free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-700 sm:text-lg dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}
