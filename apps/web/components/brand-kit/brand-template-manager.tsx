"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { Copy, Loader2, Palette, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import type { BrandTemplateRecord } from "@/lib/repurpose/brand-templates";
import { cn } from "@/lib/utils";

export function BrandTemplateManager() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<BrandTemplateRecord[]>([]);
  const [builtIns, setBuiltIns] = useState<BrandTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("My Brand Template");
  const [description, setDescription] = useState("");
  const [defaultCTA, setDefaultCTA] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/brand-templates", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load templates");
      const body = await response.json();
      setTemplates(body.templates ?? []);
      setBuiltIns(body.builtIns ?? []);
      setSelectedId((current) => current ?? body.templates?.[0]?.id ?? null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Brand templates unavailable",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description ?? "");
    setDefaultCTA(selected.defaultCTA ?? "");
    setIsDefault(selected.isDefault);
  }, [selected]);

  async function saveTemplate() {
    setSaving(true);
    try {
      const response = await fetch(selected ? `/api/brand-templates/${selected.id}` : "/api/brand-templates", {
        method: selected ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          defaultCTA,
          isDefault,
          captionStyle: selected?.captionStyle,
          layoutConfig: selected?.layoutConfig,
          overlayStyle: selected?.overlayStyle,
          watermarkConfig: selected?.watermarkConfig ?? { enabled: true },
          defaultPlatformPresets: selected?.defaultPlatformPresets,
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to save template");
      const body = await response.json();
      toast({ title: selected ? "Template updated" : "Template created" });
      await loadTemplates();
      setSelectedId(body.template?.id ?? selectedId);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Template not saved",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(id: string) {
    try {
      const response = await fetch(`/api/brand-templates/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to duplicate template");
      const body = await response.json();
      toast({ title: "Template copied" });
      await loadTemplates();
      setSelectedId(body.template?.id ?? null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Template copy failed",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this brand template? Existing clips keep their current styling.")) return;
    try {
      const response = await fetch(`/api/brand-templates/${id}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to delete template");
      toast({ title: "Template deleted" });
      setSelectedId(null);
      await loadTemplates();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Template delete failed",
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  function startNew() {
    setSelectedId(null);
    setName("My Brand Template");
    setDescription("");
    setDefaultCTA("");
    setIsDefault(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-3xl border border-border/70 bg-card/90 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Brand templates</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Save caption, layout, overlay, CTA, watermark, and export defaults for one-click styling.
            </p>
          </div>
          <Button type="button" onClick={startNew} size="sm" className="rounded-full">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                active={selectedId === template.id}
                onSelect={() => setSelectedId(template.id)}
                onDuplicate={() => duplicateTemplate(template.id)}
                onDelete={() => deleteTemplate(template.id)}
              />
            ))}
            {templates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
                No saved templates yet. Copy a built-in or create your own.
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground/55">
            Built-in starters
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {builtIns.map((template) => (
              <div key={template.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{template.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => duplicateTemplate(template.id)}>
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/90 p-5">
        <p className="text-sm font-semibold">{selected ? "Edit template" : "Create template"}</p>
        <div className="mt-4 space-y-4">
          <Field label="Template name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Default CTA">
            <Input value={defaultCTA} onChange={(event) => setDefaultCTA(event.target.value)} />
          </Field>
          <label className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            <span>
              <span className="block font-medium">Default for new clips</span>
              <span className="text-xs text-muted-foreground">Auto-apply during auto-highlights.</span>
            </span>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(event) => setIsDefault(event.target.checked)}
              className="h-4 w-4"
            />
          </label>
          <TemplatePreview template={selected} name={name} defaultCTA={defaultCTA} />
          <Button type="button" onClick={saveTemplate} disabled={saving || !name.trim()} className="w-full rounded-full">
            {saving ? "Saving..." : selected ? "Save template" : "Create template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  active,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  template: BrandTemplateRecord;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/20 hover:bg-muted/35",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {template.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
            {template.name}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {template.description || "Reusable brand styling preset."}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
            className="grid h-8 w-8 place-items-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="grid h-8 w-8 place-items-center rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}

function TemplatePreview({
  template,
  name,
  defaultCTA,
}: {
  template: BrandTemplateRecord | null;
  name: string;
  defaultCTA: string;
}) {
  const captionStyle = template?.captionStyle;
  const primary = captionStyle?.emphasisColor ?? "#34D399";
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-slate-950">
      <div className="relative aspect-[9/16]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_20%,rgba(20,184,166,0.25),transparent_34%),linear-gradient(180deg,#111827,#020617)]" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
            {name || "Template"}
          </span>
          <Palette className="h-4 w-4 text-white/50" />
        </div>
        <div
          className="absolute left-5 right-5 rounded-2xl bg-black/60 p-3 text-center text-lg font-extrabold leading-tight text-white"
          style={{
            bottom: captionStyle?.position === "top" ? undefined : "2rem",
            top: captionStyle?.position === "top" ? "4.5rem" : captionStyle?.position === "middle" ? "45%" : undefined,
            fontFamily: captionStyle?.fontFamily ?? "Inter",
          }}
        >
          Every clip stays <span style={{ color: primary }}>on brand</span>
        </div>
        {defaultCTA && (
          <div className="absolute bottom-3 left-4 right-4 rounded-full bg-white/10 px-3 py-1 text-center text-[10px] font-semibold text-white/75">
            {defaultCTA}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
