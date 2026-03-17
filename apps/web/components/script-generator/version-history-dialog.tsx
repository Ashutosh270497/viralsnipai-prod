"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { History, RotateCcw, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  versionNumber: number;
  title: string;
  changeDescription?: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
}

interface VersionHistoryDialogProps {
  scriptId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVersionRestored?: () => void;
}

export function VersionHistoryDialog({
  scriptId,
  open,
  onOpenChange,
  onVersionRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open, scriptId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      const data = await res.json();
      setVersions(data.versions);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load version history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    setRestoring(versionId);
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/versions/${versionId}/restore`,
        {
          method: "POST",
        }
      );

      if (!res.ok) throw new Error("Failed to restore version");

      toast({
        title: "Version Restored",
        description: "Script has been restored to this version",
      });

      onVersionRestored?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Failed to restore version. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            View and restore previous versions of your script
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No version history yet</p>
            <p className="text-sm text-muted-foreground">
              Versions are created when you make significant changes
            </p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto pr-4">
            <div className="space-y-3">
              {versions.map((version, index) => (
                <Card key={version.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          Version {version.versionNumber}
                        </Badge>
                        {index === 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Current
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm mb-1">
                        {version.title}
                      </h4>
                      {version.changeDescription && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {version.changeDescription}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                        <span>•</span>
                        <span>by {version.user.name || version.user.email}</span>
                      </div>
                    </div>
                    {index !== 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreVersion(version.id)}
                        disabled={restoring === version.id}
                      >
                        {restoring === version.id ? (
                          <span className="flex items-center gap-1">
                            <RotateCcw className="h-3 w-3 animate-spin" />
                            Restoring...
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
