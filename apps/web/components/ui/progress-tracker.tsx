"use client";

import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type OperationStatus = "pending" | "processing" | "completed" | "failed";

export interface TrackedOperation {
  id: string;
  type: "caption" | "export" | "highlight" | "upload" | "other";
  name: string;
  status: OperationStatus;
  progress?: number;
  message?: string;
  createdAt?: Date;
}

interface ProgressTrackerProps {
  operations: TrackedOperation[];
  className?: string;
  compact?: boolean;
  maxVisible?: number;
}

export function ProgressTracker({ operations, className, compact = false, maxVisible = 5 }: ProgressTrackerProps) {
  const activeOperations = useMemo(
    () => operations.filter((op) => op.status === "processing" || op.status === "pending"),
    [operations]
  );

  const completedOperations = useMemo(
    () => operations.filter((op) => op.status === "completed"),
    [operations]
  );

  const failedOperations = useMemo(
    () => operations.filter((op) => op.status === "failed"),
    [operations]
  );

  const visibleOperations = useMemo(() => {
    const sorted = [...activeOperations, ...failedOperations, ...completedOperations];
    return sorted.slice(0, maxVisible);
  }, [activeOperations, failedOperations, completedOperations, maxVisible]);

  if (visibleOperations.length === 0) {
    return null;
  }

  function getStatusIcon(status: OperationStatus) {
    switch (status) {
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  }

  function getStatusBadgeVariant(status: OperationStatus): "default" | "secondary" | "destructive" | "outline" {
    switch (status) {
      case "processing":
        return "default";
      case "completed":
        return "secondary";
      case "failed":
        return "destructive";
      case "pending":
        return "outline";
    }
  }

  function getTypeLabel(type: TrackedOperation["type"]): string {
    switch (type) {
      case "caption":
        return "Caption";
      case "export":
        return "Export";
      case "highlight":
        return "Highlight";
      case "upload":
        return "Upload";
      default:
        return "Task";
    }
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm", className)}>
        <div className="flex items-center gap-2">
          {activeOperations.length > 0 && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {activeOperations.length} operation{activeOperations.length > 1 ? "s" : ""} in progress
              </span>
            </div>
          )}
          {completedOperations.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedOperations.length} completed
            </Badge>
          )}
          {failedOperations.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {failedOperations.length} failed
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Active Operations</CardTitle>
          <div className="flex items-center gap-2">
            {activeOperations.length > 0 && (
              <Badge variant="default" className="text-xs">
                {activeOperations.length} active
              </Badge>
            )}
            {failedOperations.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {failedOperations.length} failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleOperations.map((operation) => (
          <div
            key={operation.id}
            className={cn(
              "flex items-start gap-3 rounded-md border border-border/40 bg-background/50 p-3 transition-all",
              operation.status === "completed" && "opacity-60"
            )}
          >
            <div className="flex-shrink-0 mt-0.5">{getStatusIcon(operation.status)}</div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{getTypeLabel(operation.type)}</span>
                  <Badge variant={getStatusBadgeVariant(operation.status)} className="text-xs capitalize">
                    {operation.status}
                  </Badge>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{operation.name}</p>
              {operation.message && (
                <p className="text-xs text-muted-foreground line-clamp-2">{operation.message}</p>
              )}
              {operation.status === "processing" && operation.progress !== undefined && (
                <div className="space-y-1">
                  <Progress value={operation.progress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{operation.progress}% complete</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {operations.length > maxVisible && (
          <p className="text-xs text-center text-muted-foreground pt-1">
            +{operations.length - maxVisible} more operation{operations.length - maxVisible > 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
