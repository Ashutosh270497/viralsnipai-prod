"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

import { HookList } from "@/components/hooksmith/hook-list";
import { ScriptEditor } from "@/components/hooksmith/script-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface HooksmithWorkspaceProps {
  projects: Array<{ id: string; title: string }>;
  initialProjectId?: string;
}

export function HooksmithWorkspace({ projects, initialProjectId }: HooksmithWorkspaceProps) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [audience, setAudience] = useState("growth marketers");
  const [tone, setTone] = useState("energetic");
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string | undefined>();
  const [scriptBody, setScriptBody] = useState("");
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hookProgress, setHookProgress] = useState(0);
  const [scriptProgress, setScriptProgress] = useState(0);
  const hookResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scriptResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialProjectId) return;
    const exists = projects.some((project) => project.id === initialProjectId);
    if (exists) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId, projects]);

  async function generateHooks() {
    const trimmedTopic = topic.trim();
    const trimmedSource = sourceUrl.trim();

    if (!trimmedTopic && !trimmedSource) {
      toast({
        variant: "destructive",
        title: "Add a topic or URL",
        description: "We need a bit of direction to ideate hooks."
      });
      return;
    }

    if (isGeneratingHooks) {
      return;
    }

    if (hookResetTimeoutRef.current) {
      clearTimeout(hookResetTimeoutRef.current);
      hookResetTimeoutRef.current = null;
    }

    setHookProgress(10);
    setIsGeneratingHooks(true);

    let succeeded = false;

    try {
      const response = await fetch("/api/hooksmith/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmedTopic,
          sourceUrl: trimmedSource,
          audience: audience.trim(),
          tone: tone.trim(),
          projectId: projectId.trim() || undefined
        }),
        cache: "no-store",
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error("Failed to generate hooks");
      }
      const data = await response.json();
      setHooks(data.hooks ?? []);
      toast({ title: "Hooks ready", description: "Select one to shape your script." });
      succeeded = true;
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Unable to generate hooks" });
      if (hookResetTimeoutRef.current) {
        clearTimeout(hookResetTimeoutRef.current);
        hookResetTimeoutRef.current = null;
      }
      setHookProgress(0);
    } finally {
      if (succeeded) {
        setHookProgress(100);
        hookResetTimeoutRef.current = setTimeout(() => {
          setHookProgress(0);
          hookResetTimeoutRef.current = null;
        }, 800);
      }
      setIsGeneratingHooks(false);
    }
  }

  async function generateScript(hookOverride?: string) {
    if (isGeneratingScript) {
      return;
    }

    const hook = hookOverride ?? selectedHook;
    if (!hook) {
      toast({
        variant: "destructive",
        title: "Select a hook",
        description: "Pick a hook to spin into a script."
      });
      return;
    }

    if (!projectId) {
      toast({
        variant: "destructive",
        title: "Select a project",
        description: "Scripts attach to a project."
      });
      return;
    }

    setIsGeneratingScript(true);
    if (scriptResetTimeoutRef.current) {
      clearTimeout(scriptResetTimeoutRef.current);
      scriptResetTimeoutRef.current = null;
    }
    setScriptProgress(10);
    let succeeded = false;
    try {
      const response = await fetch("/api/hooksmith/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook, audience, tone, projectId, durationSec: 120 }),
        cache: "no-store",
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error("Failed to generate script");
      }
      const data = await response.json();
      setScriptBody(data.script?.body ?? "");
      toast({ title: "Script drafted", description: "Review, tweak, and save to your project." });
      succeeded = true;
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Unable to generate script" });
      if (scriptResetTimeoutRef.current) {
        clearTimeout(scriptResetTimeoutRef.current);
        scriptResetTimeoutRef.current = null;
      }
      setScriptProgress(0);
    } finally {
      if (succeeded) {
        setScriptProgress(100);
        scriptResetTimeoutRef.current = setTimeout(() => {
          setScriptProgress(0);
          scriptResetTimeoutRef.current = null;
        }, 800);
      }
      setIsGeneratingScript(false);
    }
  }

  async function saveScript() {
    if (!projectId) {
      toast({ variant: "destructive", title: "Select a project first" });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/script`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hooks, body: scriptBody, tone }),
        cache: "no-store",
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      toast({ title: "Script saved" });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Could not save script" });
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!isGeneratingHooks) {
      return;
    }

    const interval = setInterval(() => {
      setHookProgress((prev) => {
        const baseline = prev <= 10 ? 10 : prev;
        const next = baseline + Math.random() * 12 + 6;
        return Math.min(next, 95);
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isGeneratingHooks]);

  useEffect(() => {
    if (!isGeneratingScript) {
      return;
    }

    const interval = setInterval(() => {
      setScriptProgress((prev) => {
        const baseline = prev <= 10 ? 10 : prev;
        const next = baseline + Math.random() * 10 + 5;
        return Math.min(next, 95);
      });
    }, 400);

    return () => clearInterval(interval);
  }, [isGeneratingScript]);

  useEffect(() => {
    return () => {
      if (hookResetTimeoutRef.current) {
        clearTimeout(hookResetTimeoutRef.current);
      }
      if (scriptResetTimeoutRef.current) {
        clearTimeout(scriptResetTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6 pb-16 animate-enter">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
            boxShadow: "0 0 14px hsl(263 72% 56% / 0.5)",
          }}
        >
          <Zap className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Hooksmith</h1>
          <p className="text-sm text-muted-foreground/70">AI-powered hook and script generation</p>
        </div>
      </div>

      {/* ── Main 2-col grid ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">

        {/* ── LEFT: Context panel ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Context</h2>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Set the topic, audience, tone, and target project.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Project
            </Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/60 text-sm">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Topic
            </Label>
            <Input
              id="topic"
              value={topic}
              placeholder="Repurposing keynote speeches"
              onChange={(event) => setTopic(event.target.value)}
              className="h-9 rounded-lg border-border/50 bg-background/60 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl" optional className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
              Source URL
            </Label>
            <Textarea
              id="sourceUrl"
              value={sourceUrl}
              placeholder="https://youtu.be/example"
              onChange={(event) => setSourceUrl(event.target.value)}
              rows={2}
              className="rounded-lg border-border/50 bg-background/60 text-sm resize-none"
            />
          </div>

          {/* Audience + Tone block */}
          <div className="rounded-lg border border-border/30 bg-white/[0.02] p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Audience
              </Label>
              <Input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Marketing leads"
                className="h-8 rounded-md border-border/40 bg-background/60 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Tone
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-8 rounded-md border-border/40 bg-background/60 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="energetic">Energetic</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="empathetic">Empathetic</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Button
                variant="glow"
                onClick={generateHooks}
                disabled={isGeneratingHooks}
                className="w-full"
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {isGeneratingHooks || hookProgress > 0
                  ? `Generating… ${Math.round(Math.min(hookProgress, 100))}%`
                  : "Generate Hooks"}
              </Button>
              {(isGeneratingHooks || hookProgress > 0) && (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-3 space-y-1.5">
                  <Progress value={hookProgress} className="h-1" />
                  <p className="text-right text-[10px] font-semibold text-primary/80">
                    {Math.round(Math.min(hookProgress, 100))}%
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => generateScript()}
                disabled={isGeneratingScript}
                className="w-full"
              >
                {isGeneratingScript || scriptProgress > 0
                  ? `Drafting script… ${Math.round(Math.min(scriptProgress, 100))}%`
                  : "Generate Script"}
              </Button>
              {(isGeneratingScript || scriptProgress > 0) && (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.05] p-3 space-y-1.5">
                  <Progress value={scriptProgress} className="h-1" />
                  <p className="text-right text-[10px] font-semibold text-primary/80">
                    {Math.round(Math.min(scriptProgress, 100))}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Output panels ─────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Hooks */}
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Hooks</h2>
            <p className="text-xs text-muted-foreground/60 mt-0.5 mb-4">
              Pick a hook to expand into a 3-beat script.
            </p>
            <HookList
              hooks={hooks}
              selectedHook={selectedHook}
              onSelect={(hook) => {
                setSelectedHook(hook);
                void generateScript(hook);
              }}
            />
          </div>

          {/* Script */}
          <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Script</h2>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                Edit before saving to your project.
              </p>
            </div>
            <ScriptEditor value={scriptBody} onChange={setScriptBody} />
            <Button
              variant="glow"
              onClick={saveScript}
              disabled={isSaving}
              size="sm"
            >
              {isSaving ? "Saving…" : "Save Script"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
