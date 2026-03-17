"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Loader2,
  MessageCircleMore,
  Play,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { BillingSubscriptionState } from "@/types/billing";

type AutoDmDashboard = {
  account: {
    id: string;
    xUsername: string;
    xDisplayName: string;
    requiresReconnectForDm: boolean;
  } | null;
  limits: {
    safeDailyCap: number;
    sentToday: number;
    remainingToday: number;
  };
  triggerDrafts: Array<{
    draftId: string;
    postedTweetId: string;
    text: string;
    postedAt: string | null;
  }>;
  automations: Array<{
    id: string;
    name: string | null;
    triggerTweetId: string;
    triggerTweetUrl: string | null;
    triggerTweetText: string | null;
    keyword: string | null;
    dmTemplate: string;
    dailyCap: number;
    isActive: boolean;
    lastCheckedAt: string | null;
    lastTriggeredAt: string | null;
    lastMatchedReplyAt: string | null;
    lastError: string | null;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    updatedAt: string;
    recentDeliveries: Array<{
      id: string;
      sourceReplyTweetId: string;
      recipientXUserId: string;
      recipientUsername: string | null;
      recipientName: string | null;
      replyText: string | null;
      matchedKeyword: string | null;
      status: string;
      errorMessage: string | null;
      sentAt: string | null;
      createdAt: string;
    }>;
  }>;
};

const DEFAULT_TEMPLATE =
  "Hey {firstName}, thanks for replying. Here’s the resource I promised: {tweetId}";

function formatRelativeTime(isoDate?: string | null) {
  if (!isoDate) return "Never";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function deliveryBadgeClass(status: string) {
  switch (status) {
    case "sent":
      return "border-emerald-500/40 text-emerald-400";
    case "rate_limited":
      return "border-amber-500/40 text-amber-300";
    case "oauth_required":
      return "border-red-500/40 text-red-400";
    default:
      return "border-border/60 text-muted-foreground";
  }
}

export function AutoDmPanel({
  billingState,
}: {
  billingState: BillingSubscriptionState | undefined;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [customTweetRef, setCustomTweetRef] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dailyCap, setDailyCap] = useState("50");
  const [name, setName] = useState("");
  const [dmTemplate, setDmTemplate] = useState(DEFAULT_TEMPLATE);

  const automationsQuery = useQuery<AutoDmDashboard>({
    queryKey: ["snipradar-auto-dm-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/automations/dm");
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to load Auto-DM automations");
      }
      return res.json();
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["snipradar-auto-dm-dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["snipradar-summary"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/automations/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postedDraftId: selectedDraftId || undefined,
          triggerTweetRef: customTweetRef.trim() || undefined,
          keyword: keyword.trim() || undefined,
          dmTemplate,
          dailyCap: Number(dailyCap),
          name: name.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to create Auto-DM automation");
      }
      return res.json();
    },
    onSuccess: async () => {
      await invalidateAll();
      setSelectedDraftId("");
      setCustomTweetRef("");
      setKeyword("");
      setDailyCap("50");
      setName("");
      setDmTemplate(DEFAULT_TEMPLATE);
      toast({
        title: "Auto-DM automation created",
        description: "Replies can now trigger a direct-message send on your selected tweet.",
      });
    },
    onError: (error) => {
      toast({
        title: "Could not create automation",
        description: error instanceof Error ? error.message : "Please review the configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/snipradar/automations/dm/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to update automation");
      }
      return res.json();
    },
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snipradar/automations/dm/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to delete automation");
      }
      return res.json();
    },
    onSuccess: async () => {
      await invalidateAll();
      toast({
        title: "Automation removed",
        description: "This Auto-DM trigger has been deleted.",
      });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/automations/dm/process", {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to run Auto-DM checks");
      }
      return res.json() as Promise<{
        sent: number;
        failed: number;
        matchedReplies: number;
        automationsProcessed: number;
        needsReconnect: boolean;
      }>;
    },
    onSuccess: async (result) => {
      await invalidateAll();
      toast({
        title: result.sent > 0 ? "Auto-DM run complete" : "Auto-DM checked",
        description: result.sent > 0
          ? `${result.sent} DM${result.sent === 1 ? "" : "s"} sent across ${result.automationsProcessed} automation${result.automationsProcessed === 1 ? "" : "s"}.`
          : result.needsReconnect
            ? "Reconnect X to grant DM permissions before the automation can send messages."
            : "No new matching replies were found in this run.",
      });
    },
  });

  const automationGate = useMemo(() => {
    if (!billingState) return null;
    if (billingState.plan.id === "free") {
      return {
        kind: "upgrade_required" as const,
        feature: "scheduling" as const,
        currentPlan: billingState.plan.id,
        requiredPlan: "plus" as const,
        upgradePlan: "plus" as const,
      };
    }
    return null;
  }, [billingState]);

  const draftOptions = automationsQuery.data?.triggerDrafts ?? [];
  const automations = automationsQuery.data?.automations ?? [];
  const connected = Boolean(automationsQuery.data?.account);

  if (automationGate) {
    return <SnipRadarBillingGateCard details={automationGate} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircleMore className="h-4.5 w-4.5 text-fuchsia-400" />
              Auto-DM
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Send a templated DM when someone replies to a selected tweet. This MVP watches public replies, applies an optional keyword filter, and logs every send attempt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {automationsQuery.data?.limits.sentToday ?? 0}/{automationsQuery.data?.limits.safeDailyCap ?? 250} sent today
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending || automations.length === 0}
            >
              {processMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Run checks now
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!connected ? (
            <SnipRadarEmptyState
              icon={MessageCircleMore}
              eyebrow="Automations"
              title="Connect X before you automate DMs"
              description="Auto-DM requires an active X account because replies are monitored and DMs are sent from your connected identity."
            />
          ) : (
            <>
              {automationsQuery.data?.account?.requiresReconnectForDm ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div>
                      <p className="font-medium">Reconnect X before first DM send</p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                        Auto-DM now requires X DM scopes. Older connections may need a reconnect before messages can be delivered.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Trigger tweet
                      </label>
                      <Select value={selectedDraftId} onValueChange={setSelectedDraftId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a posted SnipRadar tweet" />
                        </SelectTrigger>
                        <SelectContent>
                          {draftOptions.map((draft) => (
                            <SelectItem key={draft.draftId} value={draft.draftId}>
                              {(draft.text || "").slice(0, 70)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Or paste a public X tweet URL / tweet ID below for a manual trigger.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Custom tweet URL or ID
                      </label>
                      <Input
                        value={customTweetRef}
                        onChange={(event) => setCustomTweetRef(event.target.value)}
                        placeholder="https://x.com/.../status/123 or 1234567890"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Keyword filter
                      </label>
                      <Input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="Optional. Example: guide"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Daily cap
                      </label>
                      <Input
                        value={dailyCap}
                        onChange={(event) => setDailyCap(event.target.value.replace(/[^\d]/g, ""))}
                        placeholder="50"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Automation label
                    </label>
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Free guide on replies"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      DM template
                    </label>
                    <Textarea
                      value={dmTemplate}
                      onChange={(event) => setDmTemplate(event.target.value)}
                      rows={5}
                      placeholder="Hey {firstName}, thanks for replying..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Supported placeholders: <code>{`{firstName}`}</code>, <code>{`{displayName}`}</code>, <code>{`{username}`}</code>, <code>{`{replyText}`}</code>, <code>{`{tweetId}`}</code>
                    </p>
                  </div>

                  <Button
                    className="gap-2"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create automation
                  </Button>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/35 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    How this MVP works
                  </p>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>1. Pick the tweet that invites replies.</p>
                    <p>2. Optionally require a keyword match before a DM sends.</p>
                    <p>3. Replies are checked automatically and can also be processed manually from this tab.</p>
                    <p>4. Each replier receives one DM per automation to avoid duplicate sends.</p>
                    <p>5. Daily caps stay under the conservative X DM safety envelope.</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {automationsQuery.error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(automationsQuery.error as Error).message}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {automations.length === 0 ? (
        <SnipRadarEmptyState
          icon={MessageCircleMore}
          eyebrow="Auto-DM"
          title="No reply-to-DM workflows yet"
          description="Create your first automation to capture replies on a launch tweet, free guide CTA, or waitlist post."
          hint="Best results come from tweets that explicitly ask people to reply for a resource or next step."
        />
      ) : (
        <div className="space-y-4">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-base">
                    {automation.name ?? `Auto-DM for tweet ${automation.triggerTweetId.slice(0, 10)}...`}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={automation.isActive ? "default" : "secondary"}>
                      {automation.isActive ? "Active" : "Paused"}
                    </Badge>
                    {automation.keyword ? <Badge variant="outline">Keyword: {automation.keyword}</Badge> : <Badge variant="outline">All replies</Badge>}
                    <Badge variant="outline">Cap {automation.dailyCap}/day</Badge>
                    <Badge variant="outline">{automation.sentCount} sent</Badge>
                    {automation.failedCount > 0 ? <Badge variant="outline">{automation.failedCount} failed</Badge> : null}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{automation.isActive ? "Enabled" : "Disabled"}</span>
                    <Switch
                      checked={automation.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: automation.id, isActive: checked })
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => processMutation.mutate()}
                    disabled={processMutation.isPending || !automation.isActive}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(automation.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Trigger tweet</p>
                    {automation.triggerTweetUrl ? (
                      <a
                        href={automation.triggerTweetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {automation.triggerTweetUrl}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-foreground">{automation.triggerTweetId}</p>
                    )}
                    {automation.triggerTweetText ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {automation.triggerTweetText.slice(0, 220)}
                      </p>
                    ) : null}
                    <div className="rounded-xl border border-border/60 bg-background/35 p-3 text-sm text-muted-foreground">
                      {automation.dmTemplate}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Health</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Last checked</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatRelativeTime(automation.lastCheckedAt)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Last send</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatRelativeTime(automation.lastTriggeredAt)}</p>
                      </div>
                    </div>
                    {automation.lastError ? (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {automation.lastError}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Recent delivery log</p>
                  {automation.recentDeliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No replies have been processed for this automation yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {automation.recentDeliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/30 px-3 py-3 lg:flex-row lg:items-start lg:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={deliveryBadgeClass(delivery.status)}>
                                {delivery.status}
                              </Badge>
                              <span className="text-sm font-medium text-foreground">
                                {delivery.recipientUsername ? `@${delivery.recipientUsername}` : delivery.recipientName ?? delivery.recipientXUserId}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatRelativeTime(delivery.createdAt)}</span>
                            </div>
                            {delivery.replyText ? (
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                Reply: {delivery.replyText.slice(0, 180)}
                              </p>
                            ) : null}
                            {delivery.errorMessage ? (
                              <p className="text-xs text-red-300">{delivery.errorMessage}</p>
                            ) : null}
                          </div>
                          <a
                            href={`https://x.com/i/web/status/${delivery.sourceReplyTweetId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            View reply
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
