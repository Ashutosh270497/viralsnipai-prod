"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Upload, DollarSign } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TEMPLATE_CATEGORIES = ["All", "Podcasts", "Educators", "News", "Coaches", "Gaming", "Finance"];

const highlightedTemplates = [
  {
    id: "talking-head",
    title: "Talking Head Coach Pack",
    creator: "Anna Castillo",
    price: 39,
    installs: 1280,
    category: "Coaches"
  },
  {
    id: "dynamic-recap",
    title: "Dynamic News Recap",
    creator: "Signal Studio",
    price: 42,
    installs: 970,
    category: "News"
  },
  {
    id: "podcast-split",
    title: "Podcast Split Screen",
    creator: "Mike & Jess",
    price: 29,
    installs: 1540,
    category: "Podcasts"
  }
];

const marketplaceFeatures = [
  {
    icon: Upload,
    title: "Creator submissions",
    description: "Upload templates with safe zone validation, caption tracks, and motion presets. Collaborate with teammates to publish shared packs."
  },
  {
    icon: Search,
    title: "Search & discovery",
    description: "Filter by aspect ratio, runtime, niche, or platform. Preview templates on sample clips before importing them into your workspace."
  },
  {
    icon: DollarSign,
    title: "Revenue share",
    description: "Creators keep 70% of every sale with automatic monthly payouts. Track performance analytics and run promotions."
  }
];

const submissionsTimeline = [
  { step: "Submit", detail: "Upload project files, safe-zone overlay, and caption style." },
  { step: "Review", detail: "Our marketplace team checks branding, audio levels, and platform compliance." },
  { step: "Publish", detail: "Set your price, choose bundles, and go live. Update versions anytime." }
];

const exampleTemplates = [
  {
    id: "fintech-carousel",
    title: "Fintech carousel set",
    price: 34,
    installs: 650,
    rating: 4.8
  },
  {
    id: "clip-reactor",
    title: "Clip Reactor transitions",
    price: 27,
    installs: 720,
    rating: 4.9
  },
  {
    id: "coaching-cta",
    title: "Coaching CTA overlays",
    price: 19,
    installs: 580,
    rating: 4.7
  },
  {
    id: "gaming-velocity",
    title: "Gaming velocity pack",
    price: 29,
    installs: 810,
    rating: 4.6
  }
];

export function TemplateMarketplacePage() {
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    return exampleTemplates.filter((template) => {
      const matchesCategory = category === "All" || template.title.toLowerCase().includes(category.toLowerCase());
      const matchesQuery = query.trim().length === 0 || template.title.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <div className="space-y-16">
      <Hero />
      <FeatureHighlights />
      <SubmissionWorkflow />
      <RevenueCallout />
      <TemplateBrowser
        category={category}
        onCategoryChange={setCategory}
        query={query}
        onQueryChange={setQuery}
        templates={filteredTemplates}
      />
      <CreatorCTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="border border-border/60 bg-background px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex w/full max-w-4xl flex-col items-center gap-6">
        <Badge className="bg-[#F3F6FF] text-[#4C8EFF]">Template Marketplace</Badge>
        <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">Share your templates. Inspire new clips.</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Submit and monetize ViralSnipAI templates, or browse designs trusted by top agencies. Safe zones, caption styles, and transitions included.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full bg-gradient-to-r from-[#4C8EFF] to-[#9777FF] text-white shadow-lg">
            <Link href="/templates/browse">Browse templates</Link>
          </Button>
          <Button variant="outline" asChild className="rounded-full">
            <Link href="/templates/submit">Submit your template</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureHighlights() {
  return (
    <section className="grid gap-6 lg:grid-cols-3">
      {marketplaceFeatures.map((feature) => (
        <Card key={feature.title} className="rounded-3xl border border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-3">
            <feature.icon className="h-6 w-6 text-[#4C8EFF]" aria-hidden />
            <CardTitle className="text-xl text-foreground">{feature.title}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </section>
  );
}

function SubmissionWorkflow() {
  return (
    <section className="rounded-3xl border border-border/70 bg-card/80 p-8 shadow-sm">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Submission workflow</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Publish a polished template in three steps. Our review ensures every template aligns with platform best practices.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/templates/submit">View submission guidelines</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {submissionsTimeline.map((step) => (
          <div key={step.step} className="rounded-2xl border border-border/70 bg-background/80 p-5 text-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-[#4C8EFF]">{step.step}</div>
            <p className="mt-2 text-muted-foreground">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RevenueCallout() {
  return (
    <section className="rounded-3xl border border-dashed border-border/70 bg-secondary/40 p-8 text-left">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <div className="flex-1 space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">Revenue share built for creators</h2>
          <p className="text-sm text-muted-foreground">
            Keep 70% of every sale. Manage team splits, coupon codes, and insights on installs and conversions. Payouts arrive monthly with transparent reporting.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">70% creator share</Badge>
            <Badge variant="secondary">Monthly payouts</Badge>
            <Badge variant="secondary">Team revenue splits</Badge>
          </div>
        </div>
        <Card className="w/full max-w-sm border border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Top templates this month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {highlightedTemplates.map((template) => (
              <div key={template.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                <div>
                  <p className="font-medium text-foreground">{template.title}</p>
                  <p className="text-xs text-muted-foreground">{template.creator}</p>
                </div>
                <div className="text-right text-xs">
                  <p>{template.installs.toLocaleString()} installs</p>
                  <p>{formatPrice(template.price)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

interface TemplateBrowserProps {
  category: string;
  onCategoryChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  templates: Array<{ id: string; title: string; price: number; installs: number; rating: number }>;
}

function TemplateBrowser({ category, onCategoryChange, query, onQueryChange, templates }: TemplateBrowserProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Browse community templates</h2>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search templates..."
              className="border-none bg-transparent px-0 text-sm focus-visible:ring-0"
            />
          </div>
          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-full rounded-full border-border/70 bg-background/80 text-sm shadow-sm sm:w-[200px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_CATEGORIES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="border border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg text-foreground">{template.title}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {template.installs.toLocaleString()} installs · {formatPrice(template.price)} · {template.rating} ★
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <Button variant="outline" asChild>
                  <Link href={`/templates/${template.id}`}>Preview</Link>
                </Button>
                <Button asChild>
                  <Link href={`/templates/${template.id}/buy`}>Buy now</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CreatorCTA() {
  return (
    <section className="rounded-3xl bg-gradient-to-r from-[#4C8EFF] to-[#9777FF] px-6 py-12 text-center text-white">
      <h2 className="text-2xl font-semibold">Ready to launch your template pack?</h2>
      <p className="mt-2 text-sm text-white/80">
        Submit a template, set your price, and get paid when the community installs your work.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="rounded-full bg-white text-[#4C8EFF] shadow-md" variant="secondary">
          <Link href="/templates/submit">Submit template</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-white text-white hover:bg-white/10">
          <Link href="/templates/revenue">Revenue share details</Link>
        </Button>
      </div>
    </section>
  );
}

function formatPrice(price: number) {
  return `$${price}`;
}
