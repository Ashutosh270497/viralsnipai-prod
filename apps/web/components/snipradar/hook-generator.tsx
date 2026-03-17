"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";

export function HookGenerator() {
  const [topic, setTopic] = useState("");
  const [hooks, setHooks] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/hooks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count: 12 }),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to generate hooks");
      }
      return res.json() as Promise<{ hooks: string[] }>;
    },
    onSuccess: (data) => setHooks(data.hooks ?? []),
  });
  const gateDetails = getSnipRadarBillingGateDetails(
    mutation.error ? toSnipRadarApiError(mutation.error, "Failed to generate hooks") : null
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hook Generator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter topic (e.g. AI automation for creators)"
          />
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || topic.trim().length < 3}
            className="gap-1.5"
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate
          </Button>
        </div>

        {gateDetails ? (
          <SnipRadarBillingGateCard details={gateDetails} compact />
        ) : null}

        {mutation.error && !gateDetails ? (
          <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
        ) : null}

        {hooks.length > 0 ? (
          <div className="space-y-2">
            {hooks.map((hook, idx) => (
              <div key={`${hook}-${idx}`} className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                {hook}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Generate 10-12 hooks with mixed styles (question, stat, contrarian, story).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
