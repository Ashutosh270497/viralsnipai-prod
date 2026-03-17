"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookTemplate,
  Search,
  Loader2,
  Wand2,
  Copy,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TemplateItem {
  category: string;
  niche: string | null;
  template: string;
  placeholders: Record<string, string>;
  exampleFilled: string;
  hookType: string;
  format: string;
  emotionalTrigger: string;
  intent: "informational" | "engagement" | "authority" | "conversion";
  difficulty: "easy" | "medium" | "advanced";
  qualityScore: number;
  curated: boolean;
}

interface TemplatesResponse {
  templates: TemplateItem[];
  total: number;
  categories: string[];
  niches: string[];
  intents: Array<TemplateItem["intent"]>;
  difficulties: Array<TemplateItem["difficulty"]>;
  curatedCount: number;
}

export function TemplateLibrary() {
  const [category, setCategory] = useState<string | null>(null);
  const [niche, setNiche] = useState<string | null>(null);
  const [intent, setIntent] = useState<TemplateItem["intent"] | null>(null);
  const [difficulty, setDifficulty] = useState<TemplateItem["difficulty"] | null>(null);
  const [curatedOnly, setCuratedOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [remixNiche, setRemixNiche] = useState("");
  const [remixResults, setRemixResults] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (niche) params.set("niche", niche);
  if (intent) params.set("intent", intent);
  if (difficulty) params.set("difficulty", difficulty);
  if (curatedOnly) params.set("curatedOnly", "true");
  if (search.trim()) params.set("q", search.trim());

  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ["snipradar-templates", category, niche, intent, difficulty, curatedOnly, search],
    queryFn: async () => {
      const res = await fetch(`/api/snipradar/templates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const remixMutation = useMutation({
    mutationFn: async ({
      template,
      nicheVal,
    }: {
      template: string;
      nicheVal: string;
    }) => {
      const res = await fetch("/api/snipradar/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, niche: nicheVal }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remix");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setRemixResults(data.variations ?? []);
    },
  });

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const categories = data?.categories ?? [];
  const niches = data?.niches ?? [];
  const intents = data?.intents ?? [];
  const difficulties = data?.difficulties ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookTemplate className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Viral Templates</h3>
        <Badge variant="secondary" className="text-xs">
          {data?.total ?? 0}
        </Badge>
        <Badge variant="outline" className="text-xs">
          curated {data?.curatedCount ?? 0}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || null)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={niche ?? ""}
          onChange={(e) => setNiche(e.target.value || null)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Niches</option>
          {niches.map((n) => (
            <option key={n} value={n}>
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={intent ?? ""}
          onChange={(e) => setIntent((e.target.value as TemplateItem["intent"]) || null)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Intents</option>
          {intents.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <select
          value={difficulty ?? ""}
          onChange={(e) => setDifficulty((e.target.value as TemplateItem["difficulty"]) || null)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All Difficulty</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Button
          variant={curatedOnly ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setCuratedOnly((prev) => !prev)}
        >
          Curated
        </Button>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates...
        </div>
      ) : !data?.templates.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No templates found. Try adjusting your filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.templates.slice(0, 20).map((t, i) => (
            <Card
              key={i}
              className={cn(
                "cursor-pointer transition-colors hover:border-orange-500/30",
                selectedTemplate === t && "border-orange-500/50 bg-orange-500/5"
              )}
              onClick={() => {
                setSelectedTemplate(selectedTemplate === t ? null : t);
                setRemixResults([]);
                setRemixNiche(t.niche ?? "");
              }}
            >
              <CardContent className="p-3 space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">
                  {t.exampleFilled}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.category}
                  </Badge>
                  {t.niche && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {t.niche}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.hookType}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.emotionalTrigger}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.intent}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {t.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Q{t.qualityScore}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.templates.length > 20 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing 20 of {data.templates.length} templates. Use filters to narrow
          down.
        </p>
      )}

      {/* Remix Panel */}
      {selectedTemplate && (
        <Card className="border-orange-500/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Wand2 className="h-4 w-4 text-orange-500" />
                Remix Template
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplate(null);
                  setRemixResults([]);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Template:</p>
              <p className="text-sm whitespace-pre-wrap">
                {selectedTemplate.template}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={remixNiche}
                onChange={(e) => setRemixNiche(e.target.value)}
                placeholder="Your niche (e.g., AI, fitness, crypto)"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="sm"
                onClick={() =>
                  remixMutation.mutate({
                    template: selectedTemplate.template,
                    nicheVal: remixNiche || "general",
                  })
                }
                disabled={remixMutation.isPending}
                className="gap-1.5 shrink-0"
              >
                {remixMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                Remix
              </Button>
            </div>

            {remixMutation.error && (
              <p className="text-xs text-red-500">
                {(remixMutation.error as Error).message}
              </p>
            )}

            {remixResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Variations:
                </p>
                {remixResults.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-border p-2.5"
                  >
                    <p className="flex-1 text-sm whitespace-pre-wrap">{v}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(v, i)}
                      className="shrink-0 h-7 w-7 p-0"
                    >
                      {copiedIdx === i ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
