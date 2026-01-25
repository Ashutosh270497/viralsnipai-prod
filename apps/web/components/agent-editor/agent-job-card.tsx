"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  XCircle,
  Sparkles,
  FileText
} from "lucide-react";
import { JobLogsDialog } from "./job-logs-dialog";
import { ExportDropdown } from "./export-dropdown";

interface AgentJob {
  id: string;
  status: string;
  currentAgent: string | null;
  progress: any;
  resultPath: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export function AgentJobCard({ job }: { job: AgentJob }) {
  const [showLogs, setShowLogs] = useState(false);

  const statusIcon = {
    queued: <Clock className="h-4 w-4" />,
    processing: <Loader2 className="h-4 w-4 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4" />,
    failed: <XCircle className="h-4 w-4" />
  }[job.status] ?? <Clock className="h-4 w-4" />;

  const statusColor = {
    queued: "text-amber-600 dark:text-amber-400",
    processing: "text-violet-600 dark:text-violet-400",
    completed: "text-green-600 dark:text-green-400",
    failed: "text-red-600 dark:text-red-400"
  }[job.status] ?? "text-muted-foreground";

  const progressPercent =
    job.status === "completed"
      ? 100
      : job.status === "failed"
      ? 0
      : job.progress?.completedAgents && job.progress?.totalAgents
      ? Math.round(
          (job.progress.completedAgents / job.progress.totalAgents) * 100
        )
      : 0;

  const agentNames: Record<string, string> = {
    ScriptAnalyzerAgent: "Script Analyzer",
    AssetCuratorAgent: "Asset Curator",
    MotionDesignerAgent: "Motion Designer",
    AudioEnhancerAgent: "Audio Enhancer",
    StyleMatcherAgent: "Style Matcher",
    EditorAgent: "Editor"
  };

  const currentAgentName =
    job.currentAgent && agentNames[job.currentAgent]
      ? agentNames[job.currentAgent]
      : job.currentAgent;

  const createdDate = new Date(job.createdAt);
  const timeAgo = getRelativeTime(createdDate);

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className={`${statusColor}`}>{statusIcon}</div>
              <span className={`text-sm font-semibold ${statusColor}`}>
                {job.status === "queued" && "Queued"}
                {job.status === "processing" && "Processing"}
                {job.status === "completed" && "Completed"}
                {job.status === "failed" && "Failed"}
              </span>
              <span className="text-xs text-muted-foreground/70">•</span>
              <span className="text-xs text-muted-foreground/70">
                {timeAgo}
              </span>
            </div>

            {job.status === "processing" && currentAgentName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                <span>
                  <strong className="text-foreground">{currentAgentName}</strong> is working
                </span>
              </div>
            )}

            {job.status === "processing" && (
              <div className="space-y-1.5">
                <Progress value={progressPercent} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {job.progress?.completedAgents ?? 0} of{" "}
                    {job.progress?.totalAgents ?? 6} agents completed
                  </span>
                  <span className="font-medium text-violet-600 dark:text-violet-400">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            )}

            {job.status === "failed" && job.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {job.errorMessage}
              </p>
            )}

            {job.status === "completed" && job.resultPath && (
              <div className="flex items-center gap-3">
                <Button
                  asChild
                  size="sm"
                  className="h-8 rounded-lg bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
                >
                  <a href={job.resultPath} download>
                    <Download className="h-3 w-3 mr-1.5" />
                    Download
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
                >
                  <a href={job.resultPath} target="_blank" rel="noopener noreferrer">
                    Preview
                  </a>
                </Button>
                <ExportDropdown jobId={job.id} />
              </div>
            )}

            {/* View Logs Button */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg text-xs"
              onClick={() => setShowLogs(true)}
            >
              <FileText className="h-3 w-3 mr-1.5" />
              View Logs
            </Button>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-mono text-muted-foreground/50">
              {job.id.slice(0, 8)}
            </span>
          </div>
        </div>
      </CardContent>

      <JobLogsDialog jobId={job.id} open={showLogs} onOpenChange={setShowLogs} />
    </Card>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}
