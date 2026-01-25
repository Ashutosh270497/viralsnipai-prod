"use client";

import { useState, useEffect } from "react";
import { Sparkles, Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AgentJobCard } from "./agent-job-card";
import { ClipSelector } from "./clip-selector";
import { ActiveJobMonitor } from "./active-job-monitor";
import { ActivityFeed } from "./activity-feed";
import { DebugInfo } from "./debug-info";

interface ProjectSummary {
  id: string;
  title: string;
  clipCount: number;
}

interface Clip {
  id: string;
  title: string | null;
  summary: string | null;
  startMs: number;
  endMs: number;
  thumbnail: string | null;
}

interface AgentJob {
  id: string;
  status: string;
  currentAgent: string | null;
  progress: any;
  resultPath: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface StyleProfile {
  id: string;
  name: string;
  isDefault: boolean;
}

export function AgentEditorWorkspace({
  projects,
  initialProjectId,
  initialClipId
}: {
  projects: ProjectSummary[];
  initialProjectId?: string;
  initialClipId?: string;
}) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");
  const [selectedClipId, setSelectedClipId] = useState<string | undefined>(initialClipId);
  const [clips, setClips] = useState<Clip[]>([]);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [styleProfiles, setStyleProfiles] = useState<StyleProfile[]>([]);
  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string | undefined>();
  const [isLaunching, setIsLaunching] = useState(false);
  const [isLoadingClips, setIsLoadingClips] = useState(false);

  // Load style profiles on mount
  useEffect(() => {
    const loadStyleProfiles = async () => {
      try {
        const response = await fetch("/api/agent-editor/style-profiles");
        if (response.ok) {
          const data = await response.json();
          setStyleProfiles(data.profiles ?? []);

          // Auto-select default profile
          const defaultProfile = data.profiles?.find((p: StyleProfile) => p.isDefault);
          if (defaultProfile) {
            setSelectedStyleProfileId(defaultProfile.id);
          }
        }
      } catch (error) {
        console.error("Failed to load style profiles", error);
      }
    };

    loadStyleProfiles();
  }, []);

  // Load clips when project changes
  useEffect(() => {
    if (!projectId) return;

    const loadClips = async () => {
      setIsLoadingClips(true);
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setClips(data.project?.clips ?? []);
        }
      } catch (error) {
        console.error("Failed to load clips", error);
      } finally {
        setIsLoadingClips(false);
      }
    };

    loadClips();
  }, [projectId]);

  // Load jobs when project changes
  useEffect(() => {
    if (!projectId) return;

    const loadJobs = async () => {
      try {
        const response = await fetch(`/api/agent-editor/jobs?projectId=${projectId}`);
        if (response.ok) {
          const data = await response.json();
          setJobs(data.jobs ?? []);
        }
      } catch (error) {
        console.error("Failed to load jobs", error);
      }
    };

    loadJobs();

    // OPTIMIZED: Only poll when there are active jobs (processing or queued)
    // This prevents unnecessary database queries when all jobs are completed
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some(
        (job) => job.status === "processing" || job.status === "queued"
      );

      if (hasActiveJobs) {
        loadJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projectId, jobs]);

  const handleLaunchAgents = async () => {
    if (!selectedClipId) {
      toast({
        variant: "destructive",
        title: "Select a clip",
        description: "Choose a clip to enhance with AI agents."
      });
      return;
    }

    setIsLaunching(true);

    try {
      const response = await fetch("/api/agent-editor/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          clipId: selectedClipId,
          config: {
            styleProfileId: selectedStyleProfileId === "none" ? undefined : selectedStyleProfileId
          }
        })
      });

      if (!response.ok) {
        throw new Error("Failed to launch agents");
      }

      const data = await response.json();

      toast({
        title: "Agents launched",
        description: "Your AI editing squad is processing the clip in the background."
      });

      // Refresh jobs list
      const jobsResponse = await fetch(`/api/agent-editor/jobs?projectId=${projectId}`);
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        setJobs(jobsData.jobs ?? []);
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Failed to launch agents"
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-500/90 via-purple-500/90 to-fuchsia-500/90 p-4 shadow-sm">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Agent Editor
            </h1>
            <p className="text-sm font-medium text-muted-foreground/80">
              AI-powered video enhancement squad
            </p>
          </div>
        </div>
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Project & Clip</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Select a project and clip to enhance with AI agents.
          </CardDescription>
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
                    {project.title} ({project.clipCount} clips)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <ClipSelector
              clips={clips}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              isLoading={isLoadingClips}
            />
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold tracking-tight">Style Profile</Label>
              <Link href="/agent-editor/style-profiles">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Settings className="mr-1 h-3 w-3" />
                  Manage
                </Button>
              </Link>
            </div>
            <Select
              value={selectedStyleProfileId}
              onValueChange={setSelectedStyleProfileId}
            >
              <SelectTrigger className="h-10 rounded-xl border-border/50 bg-background/50 transition-colors focus:border-violet-300 focus:ring-violet-200">
                <SelectValue placeholder="Select style profile (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (use defaults)</SelectItem>
                {styleProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name} {profile.isDefault && "(Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50/60 to-purple-50/40 dark:border-violet-900/30 dark:from-violet-950/30 dark:to-purple-950/20 p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-2">What will happen?</h3>
            <ul className="space-y-2 text-xs text-muted-foreground/80">
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">1.</span>
                <span><strong>Script Analyzer</strong> will identify key moments, emotions, and pacing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">2.</span>
                <span><strong>Asset Curator</strong> will search for relevant b-roll footage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">3.</span>
                <span><strong>Motion Designer</strong> will add transitions, text overlays, and animations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">4.</span>
                <span><strong>Audio Enhancer</strong> will recommend music and sound effects</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">5.</span>
                <span><strong>Style Matcher</strong> will apply color grading and branding</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600 dark:text-violet-400">6.</span>
                <span><strong>Editor</strong> will assemble the final enhanced clip</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleLaunchAgents}
            disabled={isLaunching || !selectedClipId}
            className="w-full h-12 text-sm font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title={!selectedClipId ? "Please select a clip first" : "Launch AI agents to enhance your clip"}
          >
            {isLaunching ? "Launching agents..." : !selectedClipId ? "Select a clip to start" : "Launch AI editing squad"}
          </Button>
        </CardContent>
      </Card>

      {/* Active Job Monitor with Real-time Updates */}
      {jobs.some((job) => job.status === "processing" || job.status === "queued") && (
        <>
          {(() => {
            const activeJob = jobs.find((job) => job.status === "processing" || job.status === "queued")!;
            return (
              <>
                <ActiveJobMonitor jobId={activeJob.id} />
                <ActivityFeed jobId={activeJob.id} />
                <DebugInfo jobId={activeJob.id} />

                {/* Dev mode: Manual processing trigger for queued jobs */}
                {activeJob.status === "queued" && (
                  <Card className="border-amber-200/40 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 rounded-3xl">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold mb-1">Job is waiting to be processed</h3>
                          <p className="text-xs text-muted-foreground mb-3">
                            If you're in development mode and Inngest isn't running, you can manually start processing this job.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/agent-editor/jobs/${activeJob.id}/process`, {
                                  method: "POST"
                                });
                                if (!response.ok) {
                                  throw new Error("Failed to start processing");
                                }
                                toast({
                                  title: "Processing started",
                                  description: "The job is now being processed in the background."
                                });
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "Failed to start processing",
                                  description: "Make sure the server is running correctly."
                                });
                              }
                            }}
                          >
                            Start Processing Now (Dev Mode)
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </>
      )}

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Agent Jobs</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Monitor your AI editing jobs and download results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {jobs.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/40 bg-gradient-to-br from-slate-50/40 to-slate-100/20 dark:from-slate-900/20 dark:to-slate-800/10 p-12 text-center">
              <p className="text-sm font-semibold text-foreground">No jobs yet</p>
              <p className="text-xs text-muted-foreground/80 mt-2">
                Launch your first AI editing job above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <AgentJobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
