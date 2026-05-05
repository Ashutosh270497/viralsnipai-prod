"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Palette, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import type { BrandTemplateRecord } from "@/lib/repurpose/brand-templates";
import { cn } from "@/lib/utils";

export function BrandTemplateApplyPanel({
  projectId,
  activeClipId,
  selectedClipIds,
  onApplied,
}: {
  projectId: string;
  activeClipId: string;
  selectedClipIds: string[];
  onApplied?: () => void;
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BrandTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/brand-templates", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load brand templates");
        const body = await response.json();
        const loaded = (body.templates ?? []) as BrandTemplateRecord[];
        setTemplates(loaded);
        setSelectedTemplateId(loaded.find((template) => template.isDefault)?.id ?? loaded[0]?.id ?? "");
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Brand templates unavailable",
          description: error instanceof Error ? error.message : "Create a template in Brand Kit first.",
        });
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [toast]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  async function applyTemplate(scope: "current_clip" | "selected_clips" | "project") {
    if (!selectedTemplate) return;
    if (overwrite && !window.confirm("Overwrite existing caption/layout/CTA settings with this template?")) {
      return;
    }

    setApplying(scope);
    try {
      const response = await fetch(`/api/brand-templates/${selectedTemplate.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          clipId: activeClipId,
          clipIds: selectedClipIds,
          projectId,
          overwrite,
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Template apply failed");
      }
      const body = await response.json();
      toast({
        title: "Template applied",
        description: `${selectedTemplate.name} updated ${body.applied ?? 0} clip${body.applied === 1 ? "" : "s"}.`,
      });
      onApplied?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Template not applied",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
            Brand template
          </p>
          <h3 className="mt-1 text-base font-semibold">One-click on-brand styling</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground/60">
            Apply saved caption style, layout, CTA, watermark/logo metadata, overlay style, and export defaults.
          </p>
        </div>
        <a
          href="/brand-kit"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <Palette className="h-3.5 w-3.5" />
          Manage
        </a>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-background/35 p-5 text-sm text-muted-foreground">
          No saved brand templates yet. Copy a built-in starter from Brand Kit first.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-2 md:grid-cols-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  selectedTemplateId === template.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 bg-background/45 hover:bg-muted/35",
                )}
              >
                <p className="text-sm font-semibold">
                  {template.name}
                  {template.isDefault && <span className="ml-2 text-[10px] text-amber-400">Default</span>}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground/60">
                  {template.description || "Reusable clip styling template."}
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
              />
              Overwrite existing settings
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" size="sm" onClick={() => applyTemplate("current_clip")} disabled={Boolean(applying)}>
                {applying === "current_clip" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Current"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => applyTemplate("selected_clips")}
                disabled={Boolean(applying) || selectedClipIds.length === 0}
              >
                Selected
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("project")} disabled={Boolean(applying)}>
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
