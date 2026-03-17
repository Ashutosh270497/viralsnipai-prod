"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  "Technology",
  "Gaming",
  "Education",
  "Entertainment",
  "Music",
  "Sports",
  "Lifestyle",
  "News",
  "Business",
  "Science",
  "Comedy",
  "Other",
];

interface AddCompetitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddCompetitorDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddCompetitorDialogProps) {
  const [channelUrl, setChannelUrl] = useState("");
  const [category, setCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: { channelUrl: string; category?: string }) => {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add competitor");
      return json;
    },
    onSuccess: (data) => {
      const title =
        data.competitor?.channelTitle ?? "Channel";
      setSuccess(
        data.reactivated
          ? `Re-activated tracking for ${title}!`
          : `Now tracking ${title}!`
      );
      setError(null);
      onSuccess();

      // Auto-close after 1.5s
      setTimeout(() => {
        resetAndClose();
      }, 1500);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });

  function resetAndClose() {
    setChannelUrl("");
    setCategory("");
    setError(null);
    setSuccess(null);
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!channelUrl.trim()) {
      setError("Please enter a channel URL or handle.");
      return;
    }
    setError(null);
    setSuccess(null);
    mutation.mutate({
      channelUrl: channelUrl.trim(),
      ...(category && { category }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Competitor</DialogTitle>
          <DialogDescription>
            Enter a YouTube channel URL, handle (@name), or channel ID to start
            tracking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Channel URL Input */}
          <div className="space-y-2">
            <Label htmlFor="channel-url">Channel URL or Handle</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="channel-url"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="@channelname or youtube.com/..."
                className="pl-9"
                disabled={mutation.isPending}
              />
            </div>
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label htmlFor="category">Category (optional)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {success}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !!success}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Competitor"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
