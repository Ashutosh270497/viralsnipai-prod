"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Wand2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Hooksmith",
    description:
      "Feed a topic or URL and let AI craft 10 punchy hooks plus a ready-to-record 120 second script.",
    icon: Sparkles
  },
  {
    title: "RepurposeOS",
    description:
      "Drop a long-form recording and instantly surface the shareable clips—with burnt-in captions and brand-safe presets.",
    icon: Wand2
  },
  {
    title: "Brand Kit",
    description:
      "Keep every export on-brand with reusable color, logo, font, and watermark rules applied on render.",
    icon: Play
  }
];

const stats = [
  { label: "Clips rendered", value: "2.4M+" },
  { label: "Avg. time saved per project", value: "3.4h" },
  { label: "Teams onboarded", value: "180+" }
];

export function LegacyMarketingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 pb-24 pt-28 text-center sm:px-10">
          <Badge variant="secondary" className="glass text-primary hover:bg-secondary">
            Meet Clippers 1.0 — now in open beta
          </Badge>
          <h1 className="max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Repurpose long-form videos into scroll-stopping clips in minutes.
          </h1>
          <p className="max-w-3xl text-balance text-lg text-muted-foreground sm:text-xl">
            Clippers combines AI-powered ideation with automated video editing. Generate hooks, draft
            scripts, auto-detect highlights, burn captions, and ship exports sized for every network.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="gap-2 text-base"
              onClick={() => signIn("demo", { demo: "true", callbackUrl: "/dashboard" })}
            >
              Try the demo
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base" asChild>
              <Link href="/hooksmith">
                Generate hooks
                <Sparkles className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur">
            <div className="aspect-video w-[min(960px,85vw)] rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-left shadow-lg">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-white/60">Workflow Preview</p>
                  <h2 className="mt-4 max-w-xl text-3xl font-semibold text-white">
                    Upload → Auto clips → Burn captions → Export
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                  <Button variant="ghost" className="text-white/90 hover:bg-white/10" asChild>
                    <Link href="/repurpose">
                      <Play className="mr-2 h-5 w-5" />
                      Watch how it works
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 sm:px-10">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="relative overflow-hidden">
              <motion.div
                className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary/10"
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              />
              <CardHeader>
                <feature.icon className="h-8 w-8 text-primary" />
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 rounded-2xl bg-secondary/70 p-10 backdrop-blur sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-start gap-2">
              <span className="text-sm uppercase tracking-widest text-muted-foreground">{stat.label}</span>
              <span className="text-3xl font-semibold">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-primary/5 via-transparent to-transparent py-24">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 text-center sm:px-10">
          <h2 className="text-3xl font-semibold sm:text-4xl">Create once, publish everywhere.</h2>
          <p className="text-lg text-muted-foreground">
            Clippers syncs your Brand Kit across hooks, scripts, captions, and exports. Default to the local
            mock transcription engine for dev, or plug in OpenAI Whisper when you are production ready.
          </p>
          <Button size="lg" className="gap-2 text-base" asChild>
            <Link href="/api/auth/signin">
              Sign in securely
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
