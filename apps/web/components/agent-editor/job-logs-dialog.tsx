"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// ScrollArea removed - using div with overflow instead
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface Log {
  id: string;
  agentName: string;
  status: string;
  input?: any;
  output?: any;
  durationMs?: number | null;
  error?: string | null;
  createdAt: string;
}

export function JobLogsDialog({
  jobId,
  open,
  onOpenChange
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || !jobId) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/agent-editor/jobs/${jobId}`);
        if (response.ok) {
          const data = await response.json();
          setLogs(data.job?.logs ?? []);
        }
      } catch (error) {
        console.error("Failed to fetch logs", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [jobId, open]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "started":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
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

  const formatAgentName = (name: string) => {
    return name.replace("Agent", "").replace(/([A-Z])/g, " $1").trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Execution Logs</DialogTitle>
          <DialogDescription>
            Detailed logs from each agent execution
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No logs available yet</p>
          </div>
        ) : (
          <div className="h-[500px] overflow-y-auto pr-4">
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border/40 bg-card/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      <span className="font-semibold text-sm">
                        {formatAgentName(log.agentName)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(log.status)}`}
                      >
                        {log.status}
                      </Badge>
                      {log.durationMs && (
                        <Badge variant="outline" className="text-xs">
                          {(log.durationMs / 1000).toFixed(2)}s
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>

                  {log.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-1">
                            Error
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300">
                            {log.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {log.output && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                        View output
                      </summary>
                      <div className="mt-2 rounded-md bg-muted/50 p-3">
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
