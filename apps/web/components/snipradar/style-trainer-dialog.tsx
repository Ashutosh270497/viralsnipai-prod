"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Fingerprint,
  Loader2,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StyleProfileData {
  id: string;
  tone: string | null;
  vocabulary: string[] | null;
  avgLength: number | null;
  emojiUsage: string | null;
  hashtagStyle: string | null;
  sentencePattern: string | null;
  trainedAt: string | null;
}

export function StyleTrainerCard() {
  const [postsInput, setPostsInput] = useState("");
  const [showInput, setShowInput] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ profile: StyleProfileData | null }>({
    queryKey: ["snipradar-style"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/style");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
  });

  const trainMutation = useMutation({
    mutationFn: async (posts: string[]) => {
      const res = await fetch("/api/snipradar/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to train");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowInput(false);
      setPostsInput("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-style"] });
    },
  });

  const handleTrain = () => {
    const posts = postsInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (posts.length < 10) return;
    trainMutation.mutate(posts);
  };

  const profile = data?.profile;
  const postLines = postsInput
    .split("\n")
    .filter((l) => l.trim().length > 0).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-violet-500" />
            <span className="text-sm font-medium">Writing Style</span>
          </div>
          {profile?.trainedAt && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInput(true)}
              className="h-7 text-xs gap-1 text-muted-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Retrain
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : profile?.trainedAt && !showInput ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <StyleTag label="Tone" value={profile.tone} />
              <StyleTag label="Emoji" value={profile.emojiUsage} />
              <StyleTag label="Hashtags" value={profile.hashtagStyle} />
              <StyleTag label="Sentences" value={profile.sentencePattern} />
            </div>
            {profile.avgLength && (
              <p className="text-[11px] text-muted-foreground">
                Avg. length: {profile.avgLength} chars
              </p>
            )}
            {profile.vocabulary && (profile.vocabulary as string[]).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(profile.vocabulary as string[]).slice(0, 8).map((word) => (
                  <span
                    key={word}
                    className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-600 dark:text-violet-400"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Trained {new Date(profile.trainedAt).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Paste your past tweets (one per line, min 10) to train your writing style profile.
            </p>
            <Textarea
              value={postsInput}
              onChange={(e) => setPostsInput(e.target.value)}
              placeholder={"Tweet 1\nTweet 2\nTweet 3\n..."}
              className="min-h-[120px] text-xs font-mono"
            />
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs",
                  postLines >= 10
                    ? "text-emerald-600"
                    : "text-muted-foreground"
                )}
              >
                {postLines} / 10 min posts
                {postLines >= 10 && <Check className="inline h-3 w-3 ml-1" />}
              </span>
              <div className="flex gap-2">
                {profile?.trainedAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowInput(false);
                      setPostsInput("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleTrain}
                  disabled={postLines < 10 || trainMutation.isPending}
                  className="gap-1.5"
                >
                  {trainMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Fingerprint className="h-3.5 w-3.5" />
                  )}
                  Train Style
                </Button>
              </div>
            </div>
            {trainMutation.error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {(trainMutation.error as Error).message}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StyleTag({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-border/50 px-2 py-1">
      <span className="text-[10px] text-muted-foreground block">{label}</span>
      <span className="text-xs font-medium capitalize">{value}</span>
    </div>
  );
}
