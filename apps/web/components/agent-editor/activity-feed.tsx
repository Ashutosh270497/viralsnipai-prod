"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";

interface ActivityLog {
  id: string;
  agentName: string;
  status: string;
  createdAt: string;
  durationMs?: number;
  error?: string;
}

interface ActivityFeedProps {
  jobId: string;
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  ScriptAnalyzerAgent: "Analyzing transcript for key moments and emotions",
  AssetCuratorAgent: "Searching for relevant b-roll footage and assets",
  MotionDesignerAgent: "Designing transitions, animations, and text overlays",
  AudioEnhancerAgent: "Optimizing audio and recommending music",
  StyleMatcherAgent: "Applying color grading and branding",
  EditorAgent: "Composing final video with all enhancements"
};

export function ActivityFeed({ jobId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/agent-editor/jobs/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setActivities(data.job?.logs ?? []);
        }
      } catch (error) {
        console.error("Failed to fetch activities", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchActivities();

    // Poll every 2 seconds for updates
    const interval = setInterval(fetchActivities, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "started":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "started":
        return "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30";
      case "completed":
        return "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/30";
      case "failed":
        return "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30";
      default:
        return "border-border bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
        <CardHeader>
          <CardTitle className="tracking-tight">Activity Feed</CardTitle>
          <CardDescription className="text-muted-foreground/80">
            Real-time progress of AI agent execution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
      <CardHeader>
        <CardTitle className="tracking-tight">Activity Feed</CardTitle>
        <CardDescription className="text-muted-foreground/80">
          Real-time progress of AI agent execution
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Waiting for agents to start...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const isLatest = index === activities.length - 1;
              const description = AGENT_DESCRIPTIONS[activity.agentName] || "Processing...";

              return (
                <div
                  key={activity.id}
                  className={`relative pl-6 pb-4 ${
                    index !== activities.length - 1 ? "border-l-2 border-border" : ""
                  }`}
                >
                  <div
                    className={`absolute left-0 -translate-x-1/2 ${
                      isLatest && activity.status === "started"
                        ? "animate-pulse"
                        : ""
                    }`}
                  >
                    <div className="rounded-full bg-background p-1 border-2 border-border">
                      {getStatusIcon(activity.status)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold">
                          {activity.agentName.replace(/([A-Z])/g, " $1").trim()}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(activity.status)}`}
                      >
                        {activity.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(activity.createdAt).toLocaleTimeString()}
                      </span>
                      {activity.durationMs && (
                        <>
                          <span>•</span>
                          <span>{(activity.durationMs / 1000).toFixed(1)}s</span>
                        </>
                      )}
                    </div>

                    {activity.error && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-2">
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {activity.error}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
