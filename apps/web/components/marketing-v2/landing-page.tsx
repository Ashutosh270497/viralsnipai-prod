"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Captions,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Film,
  MessageSquare,
  Palette,
  Play,
  Ratio,
  Scissors,
  Search,
  Share2,
  Sparkles,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";

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

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.075,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const platformTags = ["YouTube Shorts", "TikTok", "Instagram Reels", "X", "LinkedIn"];

const proofSteps = [
  {
    title: "Long video upload",
    description: "Import podcasts, webinars, interviews, tutorials, founder videos, or YouTube sources.",
    icon: Upload,
    metric: "01",
    chips: ["Upload", "YouTube URL", "Source prep"],
  },
  {
    title: "AI-generated clip candidates",
    description: "Transcript timing, scene signals, virality scoring, and candidate reasons surface the strongest moments.",
    icon: Sparkles,
    metric: "120",
    chips: ["Scene-aware", "Transcript precision", "Viral score"],
  },
  {
    title: "Social-ready exported clips",
    description: "Review, caption, reframe, brand, batch export, and prepare each clip for the platform it belongs on.",
    icon: Download,
    metric: "9:16",
    chips: ["Caption styling", "Platform presets", "Review workflow"],
  },
];

const workflow = [
  {
    title: "Upload or import your video",
    description: "Start with a long video, podcast, tutorial, interview, webinar, or YouTube source.",
    icon: Upload,
    cue: "Long-form source",
  },
  {
    title: "AI detects viral-worthy moments",
    description: "ViralSnipAI finds timestamped candidates, ranks hooks, and explains why moments were selected.",
    icon: Sparkles,
    cue: "Ranked candidates",
  },
  {
    title: "Review, edit, caption, and reframe",
    description: "Approve clips, trim with transcript timing, style captions, and fit every platform layout.",
    icon: Wand2,
    cue: "Creator control",
  },
  {
    title: "Export clips for every platform",
    description: "Queue one clip or batches, download assets, and prepare social-ready metadata.",
    icon: Download,
    cue: "Ready to publish",
  },
];

const featureCards = [
  {
    title: "AI Clipping",
    description: "Finds real timestamped moments from transcript and scene signals, then ranks clips by hook, pacing, and shareability.",
    icon: Scissors,
    visual: "Clip queue",
    accent: "from-cyan-400 to-blue-500",
  },
  {
    title: "Transcript Editing",
    description: "Trim clips by selecting words, search quotes, create new clips from transcript moments, and mark filler ranges.",
    icon: FileText,
    visual: "Word timeline",
    accent: "from-violet-400 to-fuchsia-500",
  },
  {
    title: "Smart Captions",
    description: "Style captions with presets, edit cues, translate tracks, highlight keywords, and export SRT/VTT or burned-in captions.",
    icon: Captions,
    visual: "Caption studio",
    accent: "from-emerald-400 to-cyan-500",
  },
  {
    title: "Reframe & Layout",
    description: "Switch 9:16, 1:1, 16:9, 4:5, speaker focus, center crop, safe zones, and manual framing.",
    icon: Ratio,
    visual: "Safe zones",
    accent: "from-blue-400 to-indigo-500",
  },
  {
    title: "Export Center",
    description: "Create render jobs, batch exports, retry failures, and download finished videos, captions, thumbnails, or zip files.",
    icon: Download,
    visual: "Render queue",
    accent: "from-cyan-300 to-emerald-400",
  },
  {
    title: "Brand Templates",
    description: "Apply reusable caption style, watermark, overlays, layout defaults, and CTA settings across clips in one click.",
    icon: Palette,
    visual: "Brand presets",
    accent: "from-orange-300 to-pink-500",
  },
  {
    title: "Review & Approval",
    description: "Filter, approve, reject, mark export-ready, inspect quality reasons, and keep client review organized.",
    icon: BadgeCheck,
    visual: "Approval queue",
    accent: "from-lime-300 to-emerald-500",
  },
  {
    title: "Social-Ready Workflow",
    description: "Prepare platform titles, captions, hashtags, CTAs, share links, drafts, and future scheduling foundations.",
    icon: MessageSquare,
    visual: "Post prep",
    accent: "from-sky-400 to-violet-500",
  },
];

const showcaseTabs = [
  {
    id: "clipping",
    label: "AI Clipping",
    icon: Scissors,
    title: "Precise clips selected from real timestamped candidates",
    description:
      "The V1 pipeline does not ask an LLM to invent timestamps. It creates local candidates from transcript timing and scene cuts, then uses OpenRouter to choose the strongest candidate IDs.",
    bullets: ["Scene-aware candidates", "Virality and pacing signals", "Boundary confidence and reasons"],
    previewLabel: "7 clips selected",
    mockTitle: "High-confidence hook",
  },
  {
    id: "transcript",
    label: "Transcript Editor",
    icon: FileText,
    title: "Edit short-form clips by working directly with words",
    description:
      "Use transcript timing to set clip starts and ends, search for quotes, create clips from selected phrases, and mark filler words without destroying the original media.",
    bullets: ["Trim by word", "Search to clip", "Remove fillers and pauses"],
    previewLabel: "Word-level timing",
    mockTitle: "Transcript range selected",
  },
  {
    id: "captions",
    label: "Captions Studio",
    icon: Captions,
    title: "Make captions feel native to short-form feeds",
    description:
      "Choose caption templates, edit cues, translate tracks, highlight keywords, and export captions as burned-in MP4, SRT, or VTT.",
    bullets: ["Style presets", "Cue editor", "Translation tracks"],
    previewLabel: "Bold captions",
    mockTitle: "Keyword highlight active",
  },
  {
    id: "reframe",
    label: "Reframe",
    icon: Ratio,
    title: "Fit every clip to the platform without losing the subject",
    description:
      "Preview 9:16, 1:1, 16:9, 4:5, manual crop, auto reframe defaults, and safe caption zones before export.",
    bullets: ["Platform aspect ratios", "Manual crop", "Safe zones"],
    previewLabel: "9:16 layout",
    mockTitle: "Safe-zone preview",
  },
  {
    id: "export",
    label: "Export",
    icon: Download,
    title: "Move approved clips into a production-ready export queue",
    description:
      "Select approved clips, choose platform presets, include captions and layouts, track render status, and download completed assets.",
    bullets: ["Batch exports", "Render job status", "Social-ready metadata"],
    previewLabel: "Export ready",
    mockTitle: "Batch job queued",
  },
];

const clipWall = [
  { type: "Podcast", title: "The insight moment", score: 94, caption: "This is where the story changes.", tone: "from-cyan-400/35 to-blue-950" },
  { type: "Founder", title: "Hard lesson clip", score: 89, caption: "Most teams miss this one thing.", tone: "from-violet-400/35 to-slate-950" },
  { type: "Education", title: "Framework breakdown", score: 92, caption: "Steal this three-step system.", tone: "from-emerald-400/30 to-slate-950" },
  { type: "Tutorial", title: "Fast how-to", score: 84, caption: "Here is the 30-second version.", tone: "from-blue-400/35 to-slate-950" },
  { type: "Interview", title: "Quote pull", score: 91, caption: "That answer deserves its own clip.", tone: "from-fuchsia-400/30 to-slate-950" },
  { type: "Product", title: "Demo proof", score: 87, caption: "Show the outcome before the process.", tone: "from-cyan-300/30 to-slate-950" },
  { type: "Agency", title: "Client highlight", score: 90, caption: "The approved take goes straight to export.", tone: "from-indigo-400/35 to-slate-950" },
];

const platformNodes = ["YouTube Shorts", "TikTok", "Instagram Reels", "X", "LinkedIn", "Facebook Reels"];

const useCases = [
  {
    title: "Podcasters",
    pain: "Hours of conversation become hard to mine manually.",
    outcome: "Find sharp ideas, pull quote clips, caption them, and ship multiple episodes worth of shorts.",
  },
  {
    title: "YouTubers",
    pain: "Long videos need a second life across short-form channels.",
    outcome: "Turn tutorials, interviews, and commentary into platform-ready vertical cuts.",
  },
  {
    title: "Founders",
    pain: "Good POVs get buried inside calls, webinars, and recorded demos.",
    outcome: "Create founder-led thought clips with hooks, CTAs, captions, and social metadata.",
  },
  {
    title: "Coaches",
    pain: "Teaching moments need fast packaging for daily distribution.",
    outcome: "Pull educational clips, reframe for feeds, and style captions for easy watching.",
  },
  {
    title: "Agencies",
    pain: "Client review, approval, and export handoff can become messy.",
    outcome: "Review status, share links, comments, brand templates, and batch exports keep the workflow organized.",
  },
  {
    title: "Educators",
    pain: "Long lessons need concise, searchable clips for discovery.",
    outcome: "Convert teaching blocks into short clips with precise transcript boundaries.",
  },
  {
    title: "SaaS teams",
    pain: "Product demos and webinars rarely become enough reusable content.",
    outcome: "Package demos, proof points, and customer education into ready-to-share clips.",
  },
];

const faqs = [
  {
    question: "What does ViralSnipAI do?",
    answer:
      "ViralSnipAI turns long-form videos into short-form clips with AI-assisted clipping, transcript editing, captions, reframe/layout tools, review workflow, and export preparation.",
  },
  {
    question: "Which videos can I upload?",
    answer:
      "The product is designed for podcasts, webinars, tutorials, interviews, founder recordings, product demos, and YouTube-style long-form videos.",
  },
  {
    question: "Does it support captions?",
    answer:
      "Yes. The workflow includes smart captions, caption style presets, cue editing, translation tracks, keyword highlights, SRT/VTT export, and burn-in rendering support.",
  },
  {
    question: "Can I edit clips manually?",
    answer:
      "Yes. You can review clips, adjust status, edit with transcript timing, create clips from transcript selections, style captions, adjust layouts, and manage exports.",
  },
  {
    question: "Can I export for Shorts, Reels, TikTok, and other platforms?",
    answer:
      "Yes. The export workflow supports platform-ready aspect ratios and presets for YouTube Shorts, Instagram Reels, TikTok, X, LinkedIn, square feed, and landscape formats.",
  },
  {
    question: "Does ViralSnipAI support teams or agencies?",
    answer:
      "The foundation includes review status, share links, comments, brand templates, export jobs, API keys, and workspace-ready models for team and agency workflows.",
  },
  {
    question: "What makes ViralSnipAI different?",
    answer:
      "The clipping pipeline separates timing from reasoning: OpenAI handles transcription timing, OpenRouter handles ranking and metadata, and local deterministic services own candidate timestamps and final clip boundaries.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Pricing and checkout continue to use the existing billing flow. Paid plans are handled through the current Razorpay checkout and cancellation behavior.",
  },
];

export function MarketingPageV3() {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");
  const [activeShowcase, setActiveShowcase] = useState(showcaseTabs[0].id);
  const [openFaq, setOpenFaq] = useState(0);

  const selectedShowcase = showcaseTabs.find((tab) => tab.id === activeShowcase) ?? showcaseTabs[0];

  const productSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "ViralSnipAI",
      description:
        "AI-powered long-video-to-short-clip platform with precise clipping, transcript editing, captions, reframe, export, and creator workflows.",
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
      mainEntity: faqs.map((item) => ({
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
      <div className="min-h-screen overflow-hidden bg-[#030611] text-white">
        <HeroSection />
        <ProductProofSection />
        <HowItWorksSection />
        <FeatureGridSection />
        <ShowcaseSection
          activeShowcase={activeShowcase}
          selectedShowcase={selectedShowcase}
          onSelect={setActiveShowcase}
        />
        <ClipWallSection />
        <PlatformSection />
        <UseCasesSection />
        <PricingSection currency={currency} setCurrency={setCurrency} />
        <FaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />
        <FinalCtaSection />
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Button
          asChild
          size="lg"
          className="h-12 w-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 text-white shadow-2xl shadow-cyan-500/25"
        >
          <Link href="/signup">
            Start clipping free
            <ArrowRight className="ml-2 h-4 w-4" />
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

function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative isolate px-6 pb-16 pt-16 sm:pb-24 sm:pt-24 lg:px-8">
      <BackgroundGlow />
      <div className="absolute inset-0 -z-10 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <SectionBadge className="mb-6">
            <Sparkles className="mr-2 h-4 w-4" />
            AI-powered clipping, captions & repurposing
          </SectionBadge>
          <h1 className="max-w-[680px] text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Turn Long Videos Into{" "}
            <GradientText>Viral Clips</GradientText>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-slate-300 sm:text-lg">
            Upload podcasts, webinars, interviews, tutorials, or YouTube videos. ViralSnipAI finds
            the best moments, adds captions, lets you edit by transcript, and exports platform-ready clips.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group h-14 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 px-8 text-base font-semibold text-white shadow-xl shadow-cyan-500/10 transition hover:brightness-110 hover:shadow-cyan-500/25"
              onClick={() => trackEvent({ name: "cta_start_free", payload: { source: "hero" } })}
            >
              <Link href="/signup">
                Start clipping free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 rounded-full border-white/15 bg-white/[0.06] px-8 text-base font-semibold text-white backdrop-blur hover:bg-white/[0.11]"
            >
              <Link href="#how-it-works">
                <Play className="mr-2 h-4 w-4" />
                See workflow
              </Link>
            </Button>
          </div>
          <p className="mt-6 max-w-xl text-sm leading-6 text-slate-400">
            Built for creators, podcasters, founders, educators, agencies, and content teams.
          </p>
          <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            {platformTags.map((platform) => (
              <PlatformIconBadge key={platform} label={platform} />
            ))}
          </div>
        </motion.div>

        <HeroProductVisual />
      </div>
    </section>
  );
}

function HeroProductVisual() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[640px]"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 34, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-r from-cyan-500/15 via-blue-500/8 to-violet-500/14 blur-3xl landing-glow-pulse" />
      <ProductDashboardMock className="relative" />
      <FloatingCard className="-left-4 top-10 landing-float" icon={Scissors} title="AI found" value="7 clips" />
      <FloatingCard className="-right-3 bottom-10 landing-float-soft" icon={Download} title="Export" value="Ready" />
    </motion.div>
  );
}

function ProductProofSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionShell className="py-14">
      <div className="rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_25%_0%,rgba(34,211,238,0.14),transparent_32%),rgba(255,255,255,0.045)] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Product proof</p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              From one long video to a week of short-form content
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              The workflow makes the transformation visible: source in, clip candidates reviewed,
              social-ready assets out.
            </p>
          </div>
          <motion.div
            className="grid gap-4 md:grid-cols-3"
            variants={staggerVariants}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {proofSteps.map((step) => (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="group relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-slate-950/60 p-5 transition hover:-translate-y-1 hover:border-cyan-300/30"
              >
                <div className="absolute right-4 top-4 text-5xl font-black text-white/[0.04]">{step.metric}</div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-300/15">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {step.chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-300">
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </SectionShell>
  );
}

function HowItWorksSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionShell id="how-it-works">
      <SectionHeading
        eyebrow="Workflow"
        title="A clean path from upload to approved clips"
        description="ViralSnipAI keeps the workflow simple while giving creators precise control where it matters."
      />
      <motion.div
        className="relative mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:before:absolute xl:before:left-8 xl:before:right-8 xl:before:top-12 xl:before:h-px xl:before:bg-gradient-to-r xl:before:from-transparent xl:before:via-cyan-300/35 xl:before:to-transparent"
        variants={staggerVariants}
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {workflow.map((step, index) => (
          <motion.div
            key={step.title}
            variants={itemVariants}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[0.07]"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100 ring-1 ring-cyan-300/15">
                <step.icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-semibold text-slate-500">0{index + 1}</span>
            </div>
            <h3 className="text-xl font-semibold text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{step.description}</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                <Zap className="h-4 w-4" />
                {step.cue}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}

function FeatureGridSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionShell id="features">
      <SectionHeading
        eyebrow="Core features"
        title="Everything you need to create viral-ready content"
        description="Precise clipping, editing, captions, reframe, export, brand consistency, review, and social preparation in one workflow."
      />
      <motion.div
        className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        variants={staggerVariants}
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        {featureCards.map((feature, index) => (
          <motion.div
            key={feature.title}
            variants={itemVariants}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-cyan-300/35 hover:bg-white/[0.07] hover:shadow-cyan-950/20",
              index < 2 && "xl:col-span-2"
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="flex items-start gap-4">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-black/20 ring-1 ring-white/15", feature.accent)}>
                <feature.icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="h-32 rounded-xl bg-[linear-gradient(135deg,rgba(34,211,238,0.2),rgba(139,92,246,0.12)),radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.16),transparent_20%)] p-4">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      {feature.visual}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
                  </div>
                  <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
                    <div className="aspect-[9/16] rounded-lg border border-white/10 bg-black/35" />
                    <div className="space-y-2 self-end">
                      <span className="block h-2 rounded-full bg-cyan-300/70" />
                      <span className="block h-2 w-4/5 rounded-full bg-blue-300/50" />
                      <span className="block h-2 w-2/3 rounded-full bg-violet-300/60" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </SectionShell>
  );
}

function ShowcaseSection({
  activeShowcase,
  selectedShowcase,
  onSelect,
}: {
  activeShowcase: string;
  selectedShowcase: (typeof showcaseTabs)[number];
  onSelect: (id: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionShell className="py-24">
      <SectionHeading
        eyebrow="Feature showcase"
        title="A real clipping operating system, not a generic AI button"
        description="Each module maps to the actual ViralSnipAI workflow: clipping, transcript editing, captions, reframe, and export."
      />
      <div className="mt-14 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-3">
          {showcaseTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
                activeShowcase === tab.id
                  ? "border-cyan-300/40 bg-cyan-400/10 text-white shadow-lg shadow-cyan-950/15"
                  : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]">
                <tab.icon className="h-5 w-5" />
              </span>
              <span className="font-semibold">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_32%),rgba(255,255,255,0.045)] p-5 shadow-2xl shadow-black/20">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedShowcase.id}
              className="grid gap-6 lg:grid-cols-[1fr_0.82fr]"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="relative min-h-[400px] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#070b14] p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_18%,rgba(34,211,238,0.24),transparent_25%),radial-gradient(circle_at_78%_65%,rgba(139,92,246,0.24),transparent_30%)]" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <Badge className="border-cyan-300/20 bg-cyan-400/10 text-cyan-100">
                      {selectedShowcase.previewLabel}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-400">Workspace preview</span>
                  </div>
                  <div className="mx-auto w-full max-w-xl rounded-[1.4rem] border border-white/10 bg-black/35 p-4 shadow-2xl backdrop-blur">
                    <ShowcasePreviewMock selectedShowcase={selectedShowcase} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedShowcase.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs text-slate-300">
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <h3 className="text-3xl font-semibold tracking-tight text-white">{selectedShowcase.title}</h3>
                <p className="mt-4 text-base leading-7 text-slate-300">{selectedShowcase.description}</p>
                <ul className="mt-6 space-y-3">
                  {selectedShowcase.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3 text-sm text-slate-200">
                      <CheckCircle2 className="h-4 w-4 text-cyan-300" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionShell>
  );
}

function ClipWallSection() {
  const marqueeClips = [...clipWall, ...clipWall];

  return (
    <SectionShell>
      <div className="grid gap-10 lg:grid-cols-[0.55fr_1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Output gallery</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Designed for clips people actually watch
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-300">
            See the kind of output the workflow is built to produce: vertical framing, caption
            overlays, platform badges, and quick quality signals before export.
          </p>
        </div>
        <div className="relative overflow-hidden py-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#030611] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#030611] to-transparent" />
          <div className="landing-marquee-track flex w-max gap-4 pr-4">
            {marqueeClips.map((clip, index) => (
              <div
                key={`${clip.title}-${index}`}
                aria-hidden={index >= clipWall.length}
                className={cn(index % 5 === 1 && "translate-y-8", index % 5 === 3 && "-translate-y-5")}
              >
                <VideoClipCardMock
                  title={clip.type}
                  caption={clip.caption}
                  score={clip.score}
                  tone={index % 4 === 0 ? "cyan" : index % 4 === 1 ? "violet" : index % 4 === 2 ? "emerald" : "blue"}
                />
                <p className="mt-3 px-2 text-sm font-semibold text-white">{clip.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function PlatformSection() {
  return (
    <SectionShell>
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.2),transparent_32%),rgba(255,255,255,0.04)] p-8 sm:p-10">
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/10 landing-orbit" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/10 landing-orbit-slow" />
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Platforms</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">Prepare content for every platform</h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Create once, clip intelligently, and package content for short-form feeds, social posts,
              client review, and download-ready exports.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-200">
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2">Create once</span>
              <ArrowRight className="h-4 w-4 text-cyan-200" />
              <span className="rounded-full border border-white/10 bg-black/25 px-4 py-2">Adapt</span>
              <ArrowRight className="h-4 w-4 text-cyan-200" />
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-cyan-100">Export everywhere</span>
            </div>
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {platformNodes.map((name) => (
              <div key={name} className="landing-float-soft flex min-h-28 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/25 p-4 text-center shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[0.06]">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100">
                  <Share2 className="h-5 w-5" />
                </span>
                <PlatformIconBadge label={name} className="justify-center" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function UseCasesSection() {
  return (
    <SectionShell>
      <SectionHeading
        eyebrow="Use cases"
        title="Built for creators and teams who need more from every recording"
        description="ViralSnipAI is shaped around the people who turn expertise, conversations, demos, and education into distribution."
      />
      <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {useCases.map((item, index) => (
          <div
            key={item.title}
            className={cn(
              "rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07]",
              index === 4 && "xl:col-span-2"
            )}
          >
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-100">
              <Film className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.pain}</p>
            <p className="mt-4 text-sm leading-6 text-slate-200">{item.outcome}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function PricingSection({
  currency,
  setCurrency,
}: {
  currency: SupportedCurrency;
  setCurrency: (currency: SupportedCurrency) => void;
}) {
  return (
    <SectionShell id="pricing" className="py-24">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[radial-gradient(circle_at_30%_0%,rgba(34,211,238,0.16),transparent_32%),rgba(255,255,255,0.045)] p-5 sm:p-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when clipping becomes a workflow."
          description="Pricing data, plan names, plan limits, plan prices, and checkout routing are preserved from the existing pricing source."
        />
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
            {(["USD", "INR"] as SupportedCurrency[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCurrency(item)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                  currency === item ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {/* Pricing data is preserved from the existing source. This wrapper only changes presentation. */}
        <div className="mt-12 [&_.bg-white]:!bg-slate-950/80 [&_.dark\\:bg-\\[\\#0f1d1f\\]]:!bg-slate-950/80 [&_.text-slate-950]:!text-white [&_.text-slate-600]:!text-slate-300 [&_.border-slate-200]:!border-white/10 [&_.shadow-slate-950\\/5]:!shadow-black/30">
          <PricingGrid
            currency={currency}
            onSelectPlan={(planId) =>
              trackEvent({ name: "pricing_select", payload: { plan: planId, currency } })
            }
          />
        </div>
      </div>
    </SectionShell>
  );
}

function FaqSection({
  openFaq,
  setOpenFaq,
}: {
  openFaq: number;
  setOpenFaq: (index: number) => void;
}) {
  return (
    <SectionShell id="faq">
      <SectionHeading
        eyebrow="FAQ"
        title="Straight answers before you start clipping"
        description="Clear, product-true answers for creators, founders, agencies, and content teams."
      />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqs.map((item, index) => {
          const isOpen = openFaq === index;
          return (
            <button
              key={item.question}
              type="button"
              onClick={() => setOpenFaq(isOpen ? -1 : index)}
              className="w-full rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.065]"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-white sm:text-lg">{item.question}</h3>
                <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-cyan-200 transition", isOpen && "rotate-180")} />
              </div>
              {isOpen ? <p className="mt-4 text-sm leading-7 text-slate-300">{item.answer}</p> : null}
            </button>
          );
        })}
      </div>
    </SectionShell>
  );
}

function FinalCtaSection() {
  return (
    <SectionShell className="pb-24">
      <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950 p-8 text-center shadow-2xl shadow-black/40 sm:p-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(139,92,246,0.28),transparent_32%)]" />
        <div className="relative mx-auto max-w-3xl">
          <SectionBadge className="mb-6">V1 creator workflow</SectionBadge>
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ready to turn your long videos into viral clips?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Upload your first video and let ViralSnipAI find, caption, reframe, and prepare your best moments.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 rounded-full bg-white px-8 font-semibold text-slate-950 hover:bg-cyan-50">
              <Link href="/signup">
                Start clipping free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 rounded-full border-white/15 bg-white/[0.06] px-8 font-semibold text-white hover:bg-white/[0.11]">
              <Link href="#pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

function ShowcasePreviewMock({
  selectedShowcase,
}: {
  selectedShowcase: (typeof showcaseTabs)[number];
}) {
  if (selectedShowcase.id === "transcript") {
    return (
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="aspect-[9/16] rounded-2xl bg-[linear-gradient(180deg,rgba(34,211,238,0.2),rgba(2,6,23,0.96))] p-4">
          <div className="flex justify-between text-xs font-semibold text-white">
            <span>Preview</span>
            <span>00:18</span>
          </div>
          <div className="mt-28 rounded-xl bg-black/55 p-3 text-center text-xs font-black uppercase text-white">
            Trim by transcript words
          </div>
        </div>
        <TranscriptStripMock />
      </div>
    );
  }

  if (selectedShowcase.id === "captions") {
    return (
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <VideoClipFrame title="Caption preview" score={92} caption="Keyword highlights make the hook pop." />
        <CaptionPreviewMock />
      </div>
    );
  }

  if (selectedShowcase.id === "reframe") {
    return (
      <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative aspect-[9/16] rounded-2xl border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(96,165,250,0.22),rgba(2,6,23,0.96))] p-4">
          <div className="absolute inset-x-7 top-8 h-px bg-cyan-300/35" />
          <div className="absolute inset-x-7 bottom-8 h-px bg-cyan-300/35" />
          <div className="absolute inset-y-8 left-7 w-px bg-cyan-300/35" />
          <div className="absolute inset-y-8 right-7 w-px bg-cyan-300/35" />
          <div className="absolute inset-x-5 bottom-12 rounded-xl bg-black/55 p-3 text-center text-xs font-black uppercase text-white">
            Safe caption zone
          </div>
        </div>
        <div className="space-y-3">
          {["9:16 Shorts/Reels", "1:1 Square", "16:9 Landscape", "Manual crop"].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (selectedShowcase.id === "export") {
    return <ExportQueueMock />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
      <div className="grid grid-cols-2 gap-3">
        <VideoClipCardMock title="Hook" caption="The first three seconds land." score={94} compact />
        <VideoClipCardMock title="Story" caption="Clean payoff and strong pacing." score={89} compact tone="violet" />
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan-100">
            <Search className="h-3.5 w-3.5" />
            Quality signals
          </div>
          <div className="space-y-2">
            <span className="block h-2 rounded-full bg-cyan-300/70" />
            <span className="block h-2 w-4/5 rounded-full bg-blue-300/50" />
            <span className="block h-2 w-2/3 rounded-full bg-violet-300/60" />
          </div>
        </div>
        {selectedShowcase.bullets.map((bullet) => (
          <div key={bullet} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs text-slate-300">
            {bullet}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductDashboardMock({ className }: { className?: string }) {
  return (
    <GlowCard className={cn("landing-sweep overflow-hidden rounded-[2rem] p-2.5", className)}>
      <div className="rounded-[1.55rem] border border-white/10 bg-[#060a14]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
          </div>
          <span className="hidden rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 sm:inline-flex">
            ViralSnipAI Studio
          </span>
        </div>
        <div className="bg-[radial-gradient(circle_at_42%_0%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#0b1220,#020617)] p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[0.78fr_1.05fr_0.82fr]">
            <div className="hidden space-y-3 md:block">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Clip queue</p>
                <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">
                  7 found
                </span>
              </div>
              {[
                ["Hook-first story", "High confidence", 92],
                ["Founder lesson", "Strong opening", 88],
                ["Demo payoff", "Export ready", 84],
              ].map(([title, detail, score]) => (
                <ProductMockupClipCard key={title} title={String(title)} detail={String(detail)} score={Number(score)} />
              ))}
            </div>

            <div className="relative mx-auto aspect-[9/16] max-h-[360px] min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-900 shadow-2xl md:mx-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(96,165,250,0.38),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.1),rgba(2,6,23,0.92))]" />
              <div className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
                00:18 - 00:43
              </div>
              <ViralScoreBadgeMock score={92} className="absolute right-3 top-3" />
              <div className="absolute inset-x-5 bottom-8 rounded-2xl bg-black/60 p-4 text-center backdrop-blur">
                <p className="text-sm font-black uppercase leading-tight tracking-wide text-white sm:text-base">
                  This is the moment your audience rewatches
                </p>
                <p className="mt-2 text-xs text-cyan-100">Word-level captions</p>
              </div>
            </div>

            <ProductMockupReviewPanel />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {["Captions", "9:16", "Transcript", "Review"].map((item) => (
                <span key={item} className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-slate-300">
                  {item}
                </span>
              ))}
            </div>
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              Export ready
            </span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
}

function ProductMockupClipCard({
  title,
  detail,
  score,
}: {
  title: string;
  detail: string;
  score: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] font-bold text-cyan-100">
          {score}
        </span>
      </div>
    </div>
  );
}

function ProductMockupReviewPanel() {
  return (
    <div className="hidden space-y-3 md:block">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Review</p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <p className="text-sm font-semibold text-white">Viral score</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-tight text-white">92</span>
          <span className="pb-1 text-xs text-emerald-100">High potential</span>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
        <p className="text-sm font-semibold text-white">Timing</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">Word-level captions and clean boundaries.</p>
      </div>
      <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
        <p className="text-sm font-semibold text-emerald-100">Approved for export</p>
        <p className="mt-2 text-xs leading-5 text-emerald-100/75">Shorts, Reels, TikTok, X</p>
      </div>
    </div>
  );
}

function VideoClipFrame({ title, score, caption }: { title: string; score: number; caption: string }) {
  return (
    <div className="relative aspect-[9/16] rounded-2xl bg-[linear-gradient(180deg,rgba(96,165,250,0.28),rgba(2,6,23,0.95))] p-4">
      <div className="flex justify-between text-xs font-semibold text-white">
        <span>{title}</span>
        <span>{score}</span>
      </div>
      <div className="absolute inset-x-5 bottom-10 rounded-xl bg-black/55 p-3 text-center text-xs font-black uppercase text-white">
        {caption}
      </div>
    </div>
  );
}

function VideoClipCardMock({
  title,
  caption,
  score,
  tone = "cyan",
  compact = false,
}: {
  title: string;
  caption: string;
  score: number;
  tone?: "cyan" | "violet" | "blue" | "emerald";
  compact?: boolean;
}) {
  const toneClass = {
    cyan: "from-cyan-400/35 via-blue-500/10 to-slate-950",
    violet: "from-violet-400/35 via-fuchsia-500/10 to-slate-950",
    blue: "from-blue-400/35 via-indigo-500/10 to-slate-950",
    emerald: "from-emerald-400/30 via-cyan-500/10 to-slate-950",
  }[tone];

  return (
    <div
      className={cn(
        "shrink-0 rounded-[1.45rem] border border-white/10 bg-white/[0.045] p-2.5 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07]",
        compact ? "w-28" : "w-48 sm:w-56"
      )}
    >
      <div className={cn("relative aspect-[9/16] overflow-hidden rounded-[1.15rem] bg-gradient-to-b p-3", toneClass)}>
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex items-center justify-between text-[10px] font-semibold text-white">
          <span className="rounded-full bg-black/35 px-2 py-1 backdrop-blur">{title}</span>
          <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-emerald-100">{score}</span>
        </div>
        <div className={cn("absolute inset-x-3 rounded-2xl bg-black/58 p-3 text-center backdrop-blur", compact ? "bottom-5" : "bottom-7")}>
          <p className={cn("font-black uppercase leading-tight text-white", compact ? "text-[10px]" : "text-sm")}>{caption}</p>
        </div>
      </div>
      {!compact ? <p className="mt-3 px-1 text-sm font-semibold text-white">{title}</p> : null}
    </div>
  );
}

function TranscriptStripMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-cyan-100">Transcript editor</span>
        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">Word timing</span>
      </div>
      <div className="space-y-2 text-xs leading-6 text-slate-300">
        <p>
          <span className="rounded bg-cyan-300/20 px-1 py-0.5 text-cyan-100">Find</span>{" "}
          <span className="rounded bg-cyan-300/20 px-1 py-0.5 text-cyan-100">the strongest</span>{" "}
          <span className="rounded bg-white/10 px-1 py-0.5 text-white">moment</span>{" "}
          and turn it into a clean clip.
        </p>
        <p className="text-slate-500">00:18.2 - 00:43.4 selected</p>
      </div>
    </div>
  );
}

function ViralScoreBadgeMock({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn("rounded-full border border-emerald-300/20 bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100 shadow-lg shadow-emerald-950/20", className)}>
      {score} viral score
    </span>
  );
}

function CaptionPreviewMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs font-semibold text-violet-100">Caption styles</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {["Bold", "Karaoke", "Clean", "Podcast"].map((label) => (
          <span key={label} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-200">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExportQueueMock() {
  return (
    <div className="space-y-4 border-t border-white/10 bg-white/[0.035] p-5 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">AI clips</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">7 found</h2>
        </div>
        <Badge className="border-emerald-300/20 bg-emerald-400/10 text-emerald-100">Ready</Badge>
      </div>
      {[
        ["Hook-first story", "High boundary confidence", 94],
        ["Contrarian insight", "Strong first 3 seconds", 89],
        ["Educational breakdown", "Clean transcript window", 84],
      ].map(([title, subtitle, score]) => (
        <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            </div>
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-100">
              {score}
            </span>
          </div>
        </div>
      ))}
      <div className="rounded-2xl border border-violet-300/20 bg-violet-400/10 p-4">
        <p className="text-sm font-semibold text-violet-100">Quality diagnostics</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Word" value="Timing" />
          <Metric label="High" value="Boundary" />
          <Metric label="9:16" value="Layout" />
        </div>
      </div>
    </div>
  );
}

function PlatformIconBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm shadow-black/10", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
      {label}
    </span>
  );
}

function GlowCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative border border-white/10 bg-slate-950/78 shadow-2xl shadow-black/45 backdrop-blur before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(135deg,rgba(34,211,238,0.18),transparent_34%,rgba(139,92,246,0.14))] before:opacity-80", className)}>
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionBadge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Badge className={cn("rounded-full border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-cyan-100 shadow-lg shadow-cyan-950/20", className)}>
      {children}
    </Badge>
  );
}

function GradientText({ children }: { children: ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-cyan-200 via-blue-400 to-violet-400 bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function FloatingCard({
  icon: Icon,
  title,
  value,
  className,
}: {
  icon: typeof Sparkles;
  title: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("absolute hidden items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/85 p-3 shadow-xl shadow-black/30 backdrop-blur md:flex", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-100">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-xs text-slate-400">{title}</span>
        <span className="block text-sm font-semibold text-white">{value}</span>
      </span>
    </div>
  );
}

function SectionShell({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={cn("relative px-6 py-20 lg:px-8", className)}
      variants={revealVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </motion.section>
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
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-5xl">
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-300 sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/25 px-2 py-2">
      <p className="font-semibold text-white">{label}</p>
      <p className="text-slate-400">{value}</p>
    </div>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_8%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_82%_4%,rgba(139,92,246,0.11),transparent_28%),linear-gradient(180deg,#030611_0%,#070b14_58%,#030611_100%)]" />
      <div className="absolute left-1/2 top-24 -z-10 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-cyan-400/[0.06] blur-3xl" />
    </>
  );
}
