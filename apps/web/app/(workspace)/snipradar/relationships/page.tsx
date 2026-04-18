"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Star,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import { SnipRadarEmptyState } from "@/components/snipradar/snipradar-empty-state";
import { useFeatureFlags } from "@/components/providers/feature-flag-provider";
import { parseSnipRadarApiError } from "@/lib/snipradar/client-errors";
import { getSnipRadarBillingGateDetails } from "@/lib/snipradar/billing-gates";
import { RELATIONSHIP_LEAD_STAGES, type RelationshipLeadStage } from "@/lib/snipradar/relationships";

type RelationshipLead = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  stage: string;
  source: string;
  personaTags: string[];
  notes: string | null;
  nextAction: string | null;
  followUpAt: string | null;
  priorityScore: number;
  savedOpportunityCount: number;
  replyCount: number;
  inboxCaptureCount: number;
  trackedAt: string | null;
  lastInteractionAt: string | null;
  lastReplyAt: string | null;
  createdAt: string;
  updatedAt: string;
  trackedAccount: {
    id: string;
    trackedUsername: string;
    trackedDisplayName: string;
    followerCount: number;
    niche: string | null;
  } | null;
  interactions: Array<{
    id: string;
    type: string;
    summary: string;
    content: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
};

type RelationshipsPayload = {
  summary: {
    totalLeads: number;
    dueFollowUps: number;
    priorityLeads: number;
    repliesThisWeek: number;
    stageCounts: Record<string, number>;
  };
  leads: RelationshipLead[];
};

const STAGE_LABELS: Record<RelationshipLeadStage, string> = {
  new: "New",
  engaged: "Engaged",
  priority: "Priority",
  follow_up: "Follow-up",
  closed: "Closed",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString();
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Never";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function stageBadgeVariant(stage: string): "outline" | "success" | "warning" | "default" {
  if (stage === "priority") return "warning";
  if (stage === "follow_up") return "default";
  if (stage === "closed") return "outline";
  if (stage === "engaged") return "success";
  return "outline";
}

function RelationshipLeadCard({
  lead,
  onUpdated,
}: {
  lead: RelationshipLead;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [stage, setStage] = useState<RelationshipLeadStage>(lead.stage as RelationshipLeadStage);
  const [tagsInput, setTagsInput] = useState(lead.personaTags.join(", "));
  const [nextAction, setNextAction] = useState(lead.nextAction ?? "");
  const [followUpAt, setFollowUpAt] = useState(toDatetimeLocalValue(lead.followUpAt));
  const [notes, setNotes] = useState(lead.notes ?? "");

  useEffect(() => {
    setStage(lead.stage as RelationshipLeadStage);
    setTagsInput(lead.personaTags.join(", "));
    setNextAction(lead.nextAction ?? "");
    setFollowUpAt(toDatetimeLocalValue(lead.followUpAt));
    setNotes(lead.notes ?? "");
  }, [lead]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/snipradar/relationships/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          personaTags: tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          nextAction: nextAction.trim() || null,
          followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw await parseSnipRadarApiError(res, "Failed to update relationship");
      return res.json();
    },
    onSuccess: () => {
      onUpdated();
      toast({
        title: "Relationship updated",
        description: `Saved changes for @${lead.username}.`,
      });
    },
  });

  const initials = (lead.displayName ?? lead.username)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const due =
    lead.followUpAt && new Date(lead.followUpAt).getTime() <= Date.now() && lead.stage !== "closed";

  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={lead.avatarUrl ?? undefined} alt={lead.displayName ?? lead.username} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{lead.displayName ?? lead.username}</p>
                <a
                  href={`https://x.com/${lead.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  @{lead.username}
                </a>
                <Badge variant={stageBadgeVariant(lead.stage)}>{STAGE_LABELS[lead.stage as RelationshipLeadStage] ?? lead.stage}</Badge>
                <Badge variant="outline">Priority {lead.priorityScore}</Badge>
                {due ? <Badge variant="warning">Follow-up due</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {lead.followerCount ? <span>{lead.followerCount.toLocaleString()} followers</span> : null}
                <span>{lead.savedOpportunityCount} saves</span>
                <span>{lead.replyCount} replies</span>
                <span>{lead.inboxCaptureCount} inbox captures</span>
                <span>Last active {formatRelativeTime(lead.lastInteractionAt)}</span>
              </div>
              {lead.personaTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {lead.personaTags.map((tag) => (
                    <Badge key={`${lead.id}-${tag}`} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {lead.nextAction ? (
              <div className="max-w-sm rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Next:</span> {lead.nextAction}
              </div>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setExpanded((current) => !current)}>
              {expanded ? "Collapse" : "Manage"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Follow-up
            </p>
            <p className="mt-2 text-sm">{lead.followUpAt ? formatDateTime(lead.followUpAt) : "No follow-up scheduled"}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tracked account
            </p>
            <p className="mt-2 text-sm">
              {lead.trackedAccount ? `@${lead.trackedAccount.trackedUsername}` : "Not linked to tracked accounts yet"}
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Last reply
            </p>
            <p className="mt-2 text-sm">{lead.lastReplyAt ? formatDateTime(lead.lastReplyAt) : "No reply history yet"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium">Recent interactions</p>
          </div>
          {lead.interactions.length > 0 ? (
            <div className="space-y-2">
              {lead.interactions.map((interaction) => (
                <div key={interaction.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">{interaction.summary}</p>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(interaction.createdAt)}</span>
                  </div>
                  {interaction.content ? (
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{interaction.content}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No interaction history yet for this relationship.</p>
          )}
        </div>

        {expanded ? (
          <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/35 p-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={stage} onValueChange={(value) => setStage(value as RelationshipLeadStage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_LEAD_STAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STAGE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="founder, creator, warm lead"
                />
              </div>
              <div className="space-y-2">
                <Label>Next action</Label>
                <Input
                  value={nextAction}
                  onChange={(event) => setNextAction(event.target.value)}
                  placeholder="Reply to their next product launch post"
                />
              </div>
              <div className="space-y-2">
                <Label>Follow-up at</Label>
                <Input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(event) => setFollowUpAt(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What matters about this relationship, what they care about, and what to do next."
                  className="min-h-[180px]"
                />
              </div>
              <div className="flex justify-end">
                <Button className="gap-1.5" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                  {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Save relationship
                </Button>
              </div>
              {mutation.error ? (
                (() => {
                  const billingGate = getSnipRadarBillingGateDetails(mutation.error);
                  return billingGate ? (
                    <SnipRadarBillingGateCard details={billingGate} compact />
                  ) : (
                    <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
                  );
                })()
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SnipRadarRelationshipsPage() {
  const router = useRouter();
  const flags = useFeatureFlags();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (!flags.relationshipsCrmEnabled) {
      router.replace("/snipradar/overview");
    }
  }, [flags.relationshipsCrmEnabled, router]);

  const relationshipsQuery = useQuery<RelationshipsPayload>({
    queryKey: ["snipradar-relationships", stage, dueOnly, deferredSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stage !== "all") params.set("stage", stage);
      if (dueOnly) params.set("due", "true");
      if (deferredSearch.trim()) params.set("q", deferredSearch.trim());
      const res = await fetch(`/api/snipradar/relationships?${params.toString()}`);
      if (!res.ok) throw await parseSnipRadarApiError(res, "Failed to load relationship graph");
      return res.json();
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const summaryCards = useMemo(() => {
    const summary = relationshipsQuery.data?.summary;
    if (!summary) return [];
    return [
      {
        label: "Total leads",
        value: summary.totalLeads,
        icon: Users,
      },
      {
        label: "Priority queue",
        value: summary.priorityLeads,
        icon: Star,
      },
      {
        label: "Due follow-ups",
        value: summary.dueFollowUps,
        icon: Clock3,
      },
      {
        label: "Replies this week",
        value: summary.repliesThisWeek,
        icon: MessageSquare,
      },
    ];
  }, [relationshipsQuery.data?.summary]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Lead CRM
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Relationship Graph</h1>
          <p className="text-sm text-muted-foreground">
            Turn saved opportunities, tracked authors, and reply activity into an active follow-up system.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => relationshipsQuery.refetch()}
          disabled={relationshipsQuery.isFetching}
        >
          {relationshipsQuery.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {summaryCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="border-border/70 bg-card/80">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_0.4fr_auto]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by handle, display name, notes, or tag"
          />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {RELATIONSHIP_LEAD_STAGES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STAGE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={dueOnly ? "default" : "outline"}
            onClick={() => setDueOnly((current) => !current)}
          >
            {dueOnly ? "Showing due only" : "Due follow-ups"}
          </Button>
        </CardContent>
      </Card>

      {relationshipsQuery.isLoading ? (
        <Card className="border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading relationship graph...</CardContent>
        </Card>
      ) : relationshipsQuery.error ? (
        (() => {
          const billingGate = getSnipRadarBillingGateDetails(relationshipsQuery.error);
          return billingGate ? (
            <SnipRadarBillingGateCard details={billingGate} />
          ) : (
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 text-sm text-destructive">
                {(relationshipsQuery.error as Error).message}
              </CardContent>
            </Card>
          );
        })()
      ) : relationshipsQuery.data?.leads.length ? (
        <div className="space-y-4">
          {relationshipsQuery.data.leads.map((lead) => (
            <RelationshipLeadCard
              key={lead.id}
              lead={lead}
              onUpdated={() =>
                queryClient.invalidateQueries({ queryKey: ["snipradar-relationships"] })
              }
            />
          ))}
        </div>
      ) : (
        <SnipRadarEmptyState
          icon={Users}
          eyebrow="Relationships"
          title="No relationship graph yet"
          description="Save engagement opportunities, generate reply assists, or track authors from the extension. SnipRadar will turn those actions into a follow-up queue."
          primaryAction={{ label: "Open Engagement", href: "/snipradar/discover/engagement" }}
          secondaryAction={{ label: "Open Inbox", href: "/snipradar/inbox" }}
        />
      )}
    </div>
  );
}
