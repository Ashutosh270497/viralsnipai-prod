"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Sparkles, AlertCircle, XCircle } from "lucide-react";
import { useJobStream } from "./use-job-stream";
import { useToast } from "@/components/ui/use-toast";

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  ScriptAnalyzerAgent: "Script Analyzer",
  AssetCuratorAgent: "Asset Curator",
  MotionDesignerAgent: "Motion Designer",
  AudioEnhancerAgent: "Audio Enhancer",
  StyleMatcherAgent: "Style Matcher",
  EditorAgent: "Editor"
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  ScriptAnalyzerAgent: "Analyzing transcript for key moments, emotions, and pacing",
  AssetCuratorAgent: "Searching for relevant b-roll footage from Pexels",
  MotionDesignerAgent: "Designing transitions, animations, and text overlays",
  AudioEnhancerAgent: "Optimizing audio and recommending music",
  StyleMatcherAgent: "Applying color grading and branding",
  EditorAgent: "Assembling final enhanced clip"
};

export function ActiveJobMonitor({ jobId }: { jobId: string }) {
  const { job, isConnected } = useJobStream(jobId);
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this job? This action cannot be undone.")) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/agent-editor/jobs/${jobId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Failed to cancel job");
      }

      toast({
        title: "Job cancelled",
        description: "The AI editing job has been cancelled."
      });
    } catch (error) {
      console.error("Failed to cancel job", error);
      toast({
        variant: "destructive",
        title: "Failed to cancel job",
        description: "An error occurred while cancelling the job."
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (!job) {
    return null;
  }

  if (job.status !== "processing" && job.status !== "queued") {
    return null;
  }

  const progressPercent =
    job.progress?.completedAgents && job.progress?.totalAgents
      ? Math.round((job.progress.completedAgents / job.progress.totalAgents) * 100)
      : job.status === "queued"
      ? 0
      : 5;

  const currentAgentName = job.currentAgent
    ? AGENT_DISPLAY_NAMES[job.currentAgent] || job.currentAgent
    : null;

  const currentAgentDescription = job.currentAgent
    ? AGENT_DESCRIPTIONS[job.currentAgent]
    : null;

  return (
    <Card className="border-violet-200/40 bg-gradient-to-br from-violet-50/80 to-purple-50/60 dark:border-violet-900/30 dark:from-violet-950/40 dark:to-purple-950/30 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            <span>AI Editing in Progress</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {isConnected && (
              <Badge
                variant="outline"
                className="text-xs border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/30"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Live
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {job.status === "queued" ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Waiting to start...</span>
          </div>
        ) : (
          <>
            {currentAgentName && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span className="text-sm font-semibold text-foreground">
                    {currentAgentName}
                  </span>
                </div>
                {currentAgentDescription && (
                  <p className="text-xs text-muted-foreground ml-6">
                    {currentAgentDescription}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium text-violet-600 dark:text-violet-400">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {job.progress?.completedAgents ?? 0} of{" "}
                  {job.progress?.totalAgents ?? 6} agents completed
                </span>
              </div>
            </div>

            {job.progress?.lastCompletedAgent && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                <span>
                  {AGENT_DISPLAY_NAMES[job.progress.lastCompletedAgent] ||
                    job.progress.lastCompletedAgent}{" "}
                  completed
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
