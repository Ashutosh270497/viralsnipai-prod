import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Radar,
  Video,
  Waves,
} from "lucide-react";

import type {
  UnifiedActivityData,
  UnifiedActivityDomain,
  UnifiedActivityItem,
  UnifiedActivityStatus,
} from "@/lib/activity-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ActivityCenterPanelProps {
  data: UnifiedActivityData;
  title?: string;
  description?: string;
  maxItems?: number;
  showViewAll?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

function statusLabel(status: UnifiedActivityStatus) {
  if (status === "needs_action") return "Needs action";
  if (status === "processing") return "Processing";
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  return "Succeeded";
}

function statusVariant(status: UnifiedActivityStatus): "secondary" | "success" | "warning" | "outline" {
  if (status === "succeeded") return "success";
  if (status === "processing" || status === "queued") return "secondary";
  if (status === "needs_action") return "warning";
  return "outline";
}

function StatusIcon({ status }: { status: UnifiedActivityStatus }) {
  if (status === "queued") return <Clock3 className="h-4 w-4 text-amber-500" />;
  if (status === "processing") return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === "succeeded") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  return <AlertTriangle className="h-4 w-4 text-rose-500" />;
}

function domainLabel(domain: UnifiedActivityDomain) {
  switch (domain) {
    case "creator_studio":
      return "Creator";
    case "repurpose_os":
      return "RepurposeOS";
    case "transcribe":
      return "Transcribe";
    case "snipradar":
      return "SnipRadar";
    default:
      return "Activity";
  }
}

function DomainIcon({ domain }: { domain: UnifiedActivityDomain }) {
  if (domain === "repurpose_os") return <Video className="h-4 w-4 text-violet-500" />;
  if (domain === "transcribe") return <Waves className="h-4 w-4 text-cyan-500" />;
  if (domain === "snipradar") return <Radar className="h-4 w-4 text-emerald-500" />;
  return <CheckCircle2 className="h-4 w-4 text-primary" />;
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold", accent)}>{value}</p>
    </div>
  );
}

function ActivityRow({ item }: { item: UnifiedActivityItem }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/30 px-2.5 py-1">
              <DomainIcon domain={item.domain} />
              <span className="text-xs font-medium text-muted-foreground">{domainLabel(item.domain)}</span>
            </div>
            <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
            {item.progressPct !== null ? (
              <span className="text-xs text-muted-foreground">{item.progressPct}%</span>
            ) : null}
          </div>

          <div className="mt-3 flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              <StatusIcon status={item.status} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              {item.metadataSummary.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.metadataSummary.join(" • ")}
                </p>
              ) : null}
              {item.error ? (
                <p className="mt-2 text-xs font-medium text-rose-500">{item.error}</p>
              ) : null}
              {item.progressPct !== null && item.status !== "succeeded" ? (
                <div className="mt-3 max-w-md">
                  <Progress value={item.progressPct} className="h-2" />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
          </span>
          {item.nextAction ? (
            <Button asChild variant="outline" size="sm">
              <Link href={item.nextAction.href}>{item.nextAction.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ActivityCenterPanel({
  data,
  title = "Activity Center",
  description = "One place to see queued work, live processing, recent completions, and what needs attention next.",
  maxItems,
  showViewAll = false,
  emptyTitle = "No activity yet",
  emptyDescription = "Your background work, recent completions, and recoverable issues will appear here.",
}: ActivityCenterPanelProps) {
  const visibleItems = typeof maxItems === "number" ? data.items.slice(0, maxItems) : data.items;

  return (
    <Card className="border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">{description}</CardDescription>
          </div>
          {showViewAll ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/activity">Open full center</Link>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryStat label="Queued" value={data.summary.queued} accent="text-amber-500" />
          <SummaryStat label="Processing" value={data.summary.processing} accent="text-blue-500" />
          <SummaryStat label="Succeeded" value={data.summary.succeeded} accent="text-emerald-500" />
          <SummaryStat label="Failed" value={data.summary.failed} accent="text-rose-500" />
          <SummaryStat label="Needs action" value={data.summary.needsAction} accent="text-orange-500" />
        </div>
      </CardHeader>

      <CardContent>
        {visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-secondary/10 px-6 py-10 text-center">
            <p className="text-base font-medium text-foreground">{emptyTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
            {showViewAll && data.items.length > visibleItems.length ? (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/activity">View all activity</Link>
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
