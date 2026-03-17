"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  Zap,
  Users,
  BarChart3,
  Video,
  Scissors,
  Wand2,
  Globe,
  Clock,
  TrendingUp,
  MessageSquare,
  Shield,
  Rocket,
  Play,
  Star,
  CheckCircle2
} from "lucide-react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { PricingGrid } from "@/components/marketing-v2/pricing-grid";
import {
  PRICING_PLANS,
  type SupportedCurrency,
  getMonthlyPrice
} from "@/components/marketing-v2/pricing-config";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Clipping",
    description: "Automatically identify and extract viral moments from your long-form content with advanced AI analysis.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Scissors,
    title: "Smart Editing",
    description: "One-click editing with auto-captions, face tracking, and dynamic layouts optimized for each platform.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Globe,
    title: "Multi-Platform Export",
    description: "Export perfectly sized content for YouTube Shorts, TikTok, Instagram Reels, and more - all at once.",
    color: "from-orange-500 to-red-500"
  },
  {
    icon: Wand2,
    title: "Brand Customization",
    description: "Apply your brand colors, fonts, logos, and watermarks consistently across all your clips.",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: Clock,
    title: "Scheduled Publishing",
    description: "Plan and schedule your content calendar. Post automatically at the perfect time for maximum engagement.",
    color: "from-indigo-500 to-blue-500"
  },
  {
    icon: TrendingUp,
    title: "Analytics Dashboard",
    description: "Track performance, identify trends, and optimize your content strategy with detailed analytics.",
    color: "from-pink-500 to-rose-500"
  }
];

const stats = [
  { number: "20M+", label: "Active Creators", icon: Users },
  { number: "500M+", label: "Clips Generated", icon: Video },
  { number: "4.9/5", label: "User Rating", icon: Star },
  { number: "150+", label: "Countries", icon: Globe }
];

const testimonials = [
  {
    name: "Alex Rivera",
    role: "Content Creator",
    avatar: "AR",
    content: "ViralSnipAI transformed my workflow. I went from spending 8 hours editing to just 30 minutes. My productivity increased 15x!",
    metric: "15x productivity boost",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    name: "Sarah Chen",
    role: "YouTube Educator",
    avatar: "SC",
    content: "The AI understands context so well. It picks the exact moments my audience loves. My engagement rate doubled in 3 months.",
    metric: "2x engagement increase",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    name: "Marcus Johnson",
    role: "Podcast Producer",
    avatar: "MJ",
    content: "I run a clipping service for 15 podcasters now. ViralSnipAI made it possible to scale my business without hiring a team.",
    metric: "$25K monthly revenue",
    gradient: "from-orange-500 to-red-500"
  }
];

const workflow = [
  {
    step: "1",
    title: "Upload Your Content",
    description: "Drop your video link or upload directly. Supports YouTube, Vimeo, and local files up to 4 hours.",
    icon: Video
  },
  {
    step: "2",
    title: "AI Analyzes & Extracts",
    description: "Our AI scans your content, identifies viral moments, and creates optimized clips automatically.",
    icon: Sparkles
  },
  {
    step: "3",
    title: "Customize & Brand",
    description: "Apply your style, add captions, adjust timing, and preview across different platforms.",
    icon: Wand2
  },
  {
    step: "4",
    title: "Export & Publish",
    description: "Download or schedule direct publishing to all your social channels with one click.",
    icon: Rocket
  }
];

const templatePacks = [
  {
    name: "Podcast Clips",
    description: "Auto jump cuts, speaker captions, and quote callouts tuned for long-form podcasts.",
    icon: MessageSquare
  },
  {
    name: "Educational Shorts",
    description: "Lecture-style framing, key-point highlights, and clean subtitle themes for tutorials.",
    icon: BarChart3
  },
  {
    name: "Founder Updates",
    description: "Personal-brand layouts with punchy hook overlays designed for LinkedIn and X.",
    icon: Rocket
  }
];

const faqItems = [
  {
    question: "How does AI clipping work?",
    answer: "Our AI analyzes audio, visual elements, and engagement patterns to identify the most shareable moments in your content. It considers factors like pacing, emotional peaks, and topic relevance to select clips that resonate with your audience."
  },
  {
    question: "Can I edit the AI-generated clips?",
    answer: "Absolutely! All AI clips are fully editable. You can adjust timing, add transitions, modify captions, change layouts, and apply your brand styling. Think of AI as your first draft - you have complete creative control."
  },
  {
    question: "Which platforms are supported?",
    answer: "We support YouTube Shorts, TikTok, Instagram Reels, Facebook Stories, LinkedIn, Twitter/X, and Pinterest. Each export is optimized for the platform's specific requirements including aspect ratios, duration limits, and quality settings."
  },
  {
    question: "Is there a free plan?",
    answer: "Yes. The free workspace is designed for evaluation: limited ideas, scripts, titles, thumbnails, and niche discovery so you can test the workflow before moving to a paid plan."
  },
  {
    question: "How long does processing take?",
    answer: "Most videos are analyzed and clipped within 2-5 minutes depending on length. You'll receive a notification when your clips are ready. Processing happens in the background so you can continue working on other projects."
  },
  {
    question: "Can teams collaborate?",
    answer: "Current self-serve billing is optimized for individual operators. Pro unlocks the highest limits, analytics depth, and developer access. Team billing and deeper collaboration controls are handled separately from this Razorpay cutover."
  }
];

export function MarketingPageV3() {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const prefersReducedMotion = useReducedMotion() || false;

  const productSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "ViralSnipAI",
      description: "AI-powered video clipping platform that transforms long-form content into viral short-form videos for social media.",
      brand: {
        "@type": "Organization",
        name: "ViralSnipAI",
        url: "https://viralsnipai.com"
      },
      offers: PRICING_PLANS.map((plan) => ({
        "@type": "Offer",
        name: plan.name,
        priceCurrency: currency,
        price: String(getMonthlyPrice(plan, currency)),
        url: "https://viralsnipai.com/pricing"
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
    trackEvent({ name: "marketing_v3_view" });
  }, []);

  return (
    <>
      <main className="flex flex-1 flex-col overflow-hidden bg-white text-foreground dark:bg-black">
        <HeroSection prefersReducedMotion={prefersReducedMotion} />
        <StatsSection />
        <FeaturesSection prefersReducedMotion={prefersReducedMotion} />
        <TemplateSection />
        <WorkflowSection />
        <TestimonialsSection />
        <PricingSection currency={currency} setCurrency={setCurrency} />
        <FaqSection />
        <CtaSection />
      </main>
      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Button asChild size="lg" className="h-12 w-full shadow-lg">
          <Link href="/signup">
            Start Creating Free
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
    <section id="hero" className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-neutral-950 dark:via-black dark:to-blue-950/20">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-gradient-to-br from-blue-400/20 to-cyan-400/20 blur-3xl"
          animate={prefersReducedMotion ? {} : {
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -left-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-3xl"
          animate={prefersReducedMotion ? {} : {
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Trust badge */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex"
          >
            <Badge className="gap-2 border-blue-200 bg-blue-50 px-6 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              <Zap className="h-4 w-4" />
              AI Workflow For Creators, Teams, And Agencies
            </Badge>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl lg:text-7xl dark:text-white"
          >
            Transform Long Videos Into
            <span className="relative mx-3 inline-block">
              <span className="relative z-10 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-400">
                Publish-Ready Shorts
              </span>
              <motion.span
                className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-400/30 to-cyan-400/30 blur-xl"
                animate={prefersReducedMotion ? {} : {
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </span>
            In Minutes
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-gray-600 dark:text-neutral-400"
          >
            Upload once and let AI find hooks, cut highlights, add brand-safe captions, and export for TikTok, Reels, Shorts, LinkedIn, and X.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button
              asChild
              size="lg"
              className="group h-14 gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/40 dark:from-blue-500 dark:to-cyan-500"
            >
              <Link href="/signup">
                Start Creating Free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 gap-2 rounded-xl border-2 border-gray-300 bg-white px-8 text-lg font-semibold text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <Link href="#demo">
                <Play className="h-5 w-5" />
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600 dark:text-neutral-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Free forever plan</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Cancel anytime</span>
            </div>
          </motion.div>

          {/* Demo video placeholder */}
          <motion.div
            id="demo"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16"
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="overflow-hidden rounded-2xl border-4 border-white bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl dark:border-neutral-800">
                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-12">
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                      <p className="text-lg font-semibold text-white">Watch How It Works</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Floating elements */}
              <motion.div
                className="absolute -right-4 top-1/4 rounded-xl border border-white bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
                animate={prefersReducedMotion ? {} : {
                  y: [-10, 10, -10],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950">
                    <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Clip Ready!</p>
                    <p className="text-xs text-gray-600 dark:text-neutral-400">2.3 seconds</p>
                  </div>
                </div>
              </motion.div>
              <motion.div
                className="absolute -left-4 bottom-1/4 rounded-xl border border-white bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
                animate={prefersReducedMotion ? {} : {
                  y: [10, -10, 10],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
                    <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">12 Clips Found</p>
                    <p className="text-xs text-gray-600 dark:text-neutral-400">AI Analysis</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="border-y border-gray-200 bg-white py-16 dark:border-neutral-800 dark:bg-black">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                <stat.icon className="h-8 w-8 text-white" />
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">{stat.number}</div>
              <div className="mt-2 text-sm font-medium text-gray-600 dark:text-neutral-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" ref={ref} className="bg-gradient-to-b from-white to-gray-50 py-24 dark:from-black dark:to-neutral-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge className="mb-6 gap-2 border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            Powerful Features
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Everything you need to create viral content
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            Professional video editing tools powered by AI. No experience needed.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="group h-full border-2 border-gray-200 transition-all hover:border-blue-300 hover:shadow-xl dark:border-neutral-800 dark:hover:border-blue-700">
                <CardHeader>
                  <div className={cn(
                    "mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform group-hover:scale-110",
                    feature.color
                  )}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplateSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="marketplace" ref={ref} className="bg-white py-24 dark:bg-black">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <Badge className="mb-6 gap-2 border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            <Wand2 className="h-4 w-4" />
            Template Marketplace
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Start with proven clip styles
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            Pick a layout pack by content type and ship consistent posts faster.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {templatePacks.map((pack, index) => (
            <motion.div
              key={pack.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
            >
              <Card className="h-full border-2 border-gray-200 transition-all hover:border-indigo-300 hover:shadow-xl dark:border-neutral-800 dark:hover:border-indigo-700">
                <CardHeader>
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 shadow">
                    <pack.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                    {pack.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                    {pack.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="workflow" ref={ref} className="bg-white py-24 dark:bg-black">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            How it works
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            From upload to viral clip in 4 simple steps
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-4">
          {workflow.map((step, index) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -20 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line */}
              {index < workflow.length - 1 && (
                <div className="absolute left-1/2 top-16 hidden h-full w-0.5 bg-gradient-to-b from-blue-500 to-cyan-500 lg:block" style={{ transform: "translateX(-50%)" }} />
              )}
              
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-xl">
                    <step.icon className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white shadow-lg">
                    {step.step}
                  </div>
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">{step.title}</h3>
                <p className="text-base leading-relaxed text-gray-600 dark:text-neutral-400">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-gradient-to-b from-gray-50 to-white py-24 dark:from-neutral-950 dark:to-black">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Badge className="mb-6 gap-2 border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
            <MessageSquare className="h-4 w-4" />
            Success Stories
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Loved by creators worldwide
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            Real stories from real creators achieving real results
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full border-2 border-gray-200 shadow-lg transition-all hover:shadow-2xl dark:border-neutral-800">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-2xl font-bold text-white shadow-lg",
                      testimonial.gradient
                    )}>
                      {testimonial.avatar}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                        {testimonial.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-neutral-400">{testimonial.role}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-base leading-relaxed text-gray-700 dark:text-neutral-300">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 dark:bg-green-950 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                    {testimonial.metric}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
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
    <section ref={ref} id="pricing" className="bg-gradient-to-b from-white to-gray-50 py-24 dark:from-black dark:to-neutral-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <Badge className="mb-6 gap-2 border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
            <Shield className="h-4 w-4" />
            Simple Pricing
          </Badge>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Choose your plan
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            Start free. Scale as you grow. Cancel anytime.
          </p>

          {/* Toggle controls */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              {(["USD", "INR"] as SupportedCurrency[]).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrency(curr)}
                  className={cn(
                    "rounded-lg px-6 py-2.5 text-sm font-semibold transition-all",
                    currency === curr
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-gray-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center rounded-xl border-2 border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
              Monthly only
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-16"
        >
          <PricingGrid
            currency={currency}
            onSelectPlan={(planId) =>
              trackEvent({ name: "pricing_select", payload: { plan: planId, cycle: "monthly", currency } })
            }
          />
        </motion.div>
      </div>
    </section>
  );
}

function FaqSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" ref={ref} className="bg-white py-24 dark:bg-black">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Frequently asked questions
          </h2>
          <p className="text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
            Everything you need to know about ViralSnipAI
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqItems.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-blue-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-blue-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {faq.question}
                  </h3>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">+</span>
                    </div>
                  </motion.div>
                </div>
                <motion.div
                  initial={false}
                  animate={{
                    height: openIndex === index ? "auto" : 0,
                    opacity: openIndex === index ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-neutral-400">
                    {faq.answer}
                  </p>
                </motion.div>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-600 py-24 dark:from-blue-800 dark:via-blue-900 dark:to-cyan-800">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <Badge className="mb-6 gap-2 border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            <Rocket className="h-4 w-4" />
            Join 20M+ Creators
          </Badge>
          <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Ready to go viral?
          </h2>
          <p className="mb-10 text-xl leading-relaxed text-blue-50">
            Start creating engaging short-form content today. No credit card required.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group h-14 gap-2 rounded-xl bg-white px-8 text-lg font-semibold text-blue-600 shadow-2xl transition-all hover:bg-blue-50 hover:shadow-blue-900/50"
            >
              <Link href="/signup">
                Start Creating Free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 gap-2 rounded-xl border-2 border-white bg-transparent px-8 text-lg font-semibold text-white hover:bg-white/10"
            >
              <Link href="#pricing">View Pricing</Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-blue-50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>10 free clips monthly</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>Setup in 2 minutes</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
