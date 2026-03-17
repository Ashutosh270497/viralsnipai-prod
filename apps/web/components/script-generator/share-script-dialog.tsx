"use client";

import { useState } from "react";
import { Share2, Copy, Check, Link, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ShareScriptDialogProps {
  scriptId: string;
  scriptTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareScriptDialog({
  scriptId,
  scriptTitle,
  open,
  onOpenChange,
}: ShareScriptDialogProps) {
  const [accessLevel, setAccessLevel] = useState<"view" | "edit">("view");
  const [sharedWith, setSharedWith] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { toast } = useToast();

  const handleCreateShare = async () => {
    setSharing(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedWith: sharedWith || undefined,
          accessLevel,
        }),
      });

      if (!res.ok) throw new Error("Failed to create share");

      const data = await res.json();
      setShareUrl(data.shareUrl);

      toast({
        title: "Share Link Created",
        description: sharedWith
          ? `Shared with ${sharedWith}`
          : "Anyone with the link can access",
      });
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard",
    });
  };

  const handleReset = () => {
    setShareUrl("");
    setSharedWith("");
    setAccessLevel("view");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Script
          </DialogTitle>
          <DialogDescription>
            Share &quot;{scriptTitle}&quot; with others
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4">
            {/* Email (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="email">Share with (Optional)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={sharedWith}
                    onChange={(e) => setSharedWith(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to create a shareable link for anyone
              </p>
            </div>

            {/* Access Level */}
            <div className="space-y-2">
              <Label htmlFor="access">Access Level</Label>
              <Select
                value={accessLevel}
                onValueChange={(value: "view" | "edit") => setAccessLevel(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View Only</SelectItem>
                  <SelectItem value="edit">Can Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Info Card */}
            <Card className="bg-secondary/20 p-3">
              <p className="text-sm text-muted-foreground">
                {accessLevel === "view"
                  ? "Recipients can view the script but cannot make changes"
                  : "Recipients can view and edit the script"}
              </p>
            </Card>

            {/* Create Button */}
            <Button
              onClick={handleCreateShare}
              disabled={sharing}
              className="w-full"
            >
              {sharing ? (
                "Creating Share Link..."
              ) : (
                <>
                  <Link className="mr-2 h-4 w-4" />
                  Create Share Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Share URL */}
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Success Info */}
            <Card className="bg-green-500/10 border-green-500/20 p-3">
              <p className="text-sm text-green-600 dark:text-green-400">
                ✓ Share link created successfully
              </p>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                Create Another
              </Button>
              <Button onClick={() => onOpenChange(false)} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
