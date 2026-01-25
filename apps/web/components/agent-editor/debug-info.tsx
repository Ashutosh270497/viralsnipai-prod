"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bug, ChevronDown, ChevronUp } from "lucide-react";

export function DebugInfo({ jobId }: { jobId?: string }) {
  const [debugData, setDebugData] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDebugInfo = async () => {
    setIsLoading(true);
    try {
      const url = jobId
        ? `/api/agent-editor/debug?jobId=${jobId}`
        : `/api/agent-editor/debug`;

      const response = await fetch(url);
      const data = await response.json();
      setDebugData(data);
      setIsOpen(true);
    } catch (error) {
      console.error("Failed to fetch debug info", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={fetchDebugInfo}
        disabled={isLoading}
        className="h-8 text-xs"
      >
        <Bug className="h-3 w-3 mr-1" />
        {isLoading ? "Loading..." : "Show Debug Info"}
      </Button>

      {debugData && isOpen && (
        <Card className="border-amber-200/40 bg-amber-50/20 dark:border-amber-900/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug Information
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Job Status:</span>
                <Badge variant={
                  debugData.debug?.status === "completed" ? "default" :
                  debugData.debug?.status === "failed" ? "destructive" :
                  "secondary"
                }>
                  {debugData.debug?.status || "unknown"}
                </Badge>
              </div>

              {debugData.debug?.errorMessage && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Error:</span>
                  <div className="p-2 rounded bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-300 text-xs font-mono">
                    {debugData.debug.errorMessage}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Has Transcript:</span>
                  <Badge variant={debugData.debug?.hasTranscript ? "default" : "secondary"}>
                    {debugData.debug?.hasTranscript ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Has Assets:</span>
                  <Badge variant={debugData.debug?.hasAssets ? "default" : "secondary"}>
                    {debugData.debug?.hasAssets ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Has Clips:</span>
                  <Badge variant={debugData.debug?.hasClips ? "default" : "secondary"}>
                    {debugData.debug?.hasClips ? "Yes" : "No"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Logs Count:</span>
                  <Badge variant="secondary">
                    {debugData.debug?.logsCount || 0}
                  </Badge>
                </div>
              </div>

              {debugData.job?.project?.assets && debugData.job.project.assets.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Assets:</span>
                  <div className="space-y-1">
                    {debugData.job.project.assets.map((asset: any) => (
                      <div key={asset.id} className="p-2 rounded bg-muted/50 text-xs">
                        <div className="font-mono text-xs">{asset.id.slice(0, 8)}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{asset.type}</Badge>
                          {asset.transcript && (
                            <Badge variant="default" className="text-xs">Has Transcript</Badge>
                          )}
                        </div>
                        {asset.storagePath && (
                          <div className="text-muted-foreground mt-1">
                            Path: {asset.storagePath.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugData.job?.logs && debugData.job.logs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground">Recent Logs:</span>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {debugData.job.logs.map((log: any) => (
                      <div key={log.id} className="p-2 rounded bg-muted/50 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{log.agentName}</span>
                          <Badge variant={
                            log.status === "completed" ? "default" :
                            log.status === "failed" ? "destructive" :
                            "secondary"
                          } className="text-xs">
                            {log.status}
                          </Badge>
                        </div>
                        {log.error && (
                          <div className="text-red-600 dark:text-red-400 mt-1">
                            Error: {log.error}
                          </div>
                        )}
                        {log.durationMs && (
                          <div className="text-muted-foreground mt-1">
                            Duration: {(log.durationMs / 1000).toFixed(2)}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
