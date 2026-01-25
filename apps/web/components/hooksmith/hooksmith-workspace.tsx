"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";

import { HookList } from "@/components/hooksmith/hook-list";
import { ScriptEditor } from "@/components/hooksmith/script-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Hooksmith</h1>
            <p className="text-sm font-medium text-muted-foreground/80">AI-powered content strategy</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Context</CardTitle>
            <CardDescription className="text-muted-foreground/80">Set the topic, audience, tone, and target project.</CardDescription>
          </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            <Label className="text-sm font-semibold tracking-tight">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200">
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
          <div className="space-y-2.5">
            <Label htmlFor="topic" className="text-sm font-semibold tracking-tight">Topic</Label>
            <Input
              id="topic"
              value={topic}
              placeholder="Repurposing keynote speeches"
              onChange={(event) => setTopic(event.target.value)}
              className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="sourceUrl" optional className="text-sm font-semibold tracking-tight">
              Source URL
            </Label>
            <Textarea
              id="sourceUrl"
              value={sourceUrl}
              placeholder="https://youtu.be/example"
              onChange={(event) => setSourceUrl(event.target.value)}
              rows={2}
              className="rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200"
            />
          </div>
          <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/30 dark:to-slate-800/20 p-4 shadow-sm space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">Audience</Label>
              <Input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Marketing leads"
                className="h-9 rounded-lg border-border/50 bg-background/80 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-9 rounded-lg border-border/50 bg-background/80 text-sm">
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
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Button
                onClick={generateHooks}
                disabled={isGeneratingHooks}
                className="w-full h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
              >
                {isGeneratingHooks || hookProgress > 0
                  ? `Generating... ${Math.round(Math.min(hookProgress, 100))}%`
                  : "Generate hooks"}
              </Button>
              {(isGeneratingHooks || hookProgress > 0) && (
                <div className="space-y-1 rounded-xl border border-violet-200/40 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/30 p-3 shadow-sm">
                  <Progress value={hookProgress} className="h-1.5" />
                  <div className="text-right text-xs font-medium text-violet-700 dark:text-violet-300">
                    {Math.round(Math.min(hookProgress, 100))}%
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => generateScript()}
                disabled={isGeneratingScript}
                className="w-full h-10 text-sm font-semibold rounded-xl border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950/50"
              >
                {isGeneratingScript || scriptProgress > 0
                  ? `Drafting script... ${Math.round(Math.min(scriptProgress, 100))}%`
                  : "Generate script"}
              </Button>
              {(isGeneratingScript || scriptProgress > 0) && (
                <div className="space-y-1 rounded-xl border border-violet-200/40 bg-violet-50/60 dark:border-violet-800/40 dark:bg-violet-950/30 p-3 shadow-sm">
                  <Progress value={scriptProgress} className="h-1.5" />
                  <div className="text-right text-xs font-medium text-violet-700 dark:text-violet-300">
                    {Math.round(Math.min(scriptProgress, 100))}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-6">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Hooks</CardTitle>
            <CardDescription className="text-muted-foreground/80">Pick a hook to expand into a 3-beat script.</CardDescription>
          </CardHeader>
          <CardContent>
            <HookList
              hooks={hooks}
              selectedHook={selectedHook}
              onSelect={(hook) => {
                setSelectedHook(hook);
                void generateScript(hook);
              }}
            />
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Script</CardTitle>
            <CardDescription className="text-muted-foreground/80">Edit before saving to your project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScriptEditor value={scriptBody} onChange={setScriptBody} />
            <Button
              onClick={saveScript}
              disabled={isSaving}
              className="h-10 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all"
            >
              {isSaving ? "Saving..." : "Save script"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  );
}
