"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Plus, RefreshCcw, Trash2, Webhook } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type ScopeCatalogItem = { id: string; label: string };
type EventCatalogItem = { id: string; label: string };

type ApiKeyRecord = {
  id: string;
  name: string;
  keyPreview: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type WebhookRecord = {
  id: string;
  name: string;
  url: string;
  signingSecretPreview: string;
  events: string[];
  isActive: boolean;
  lastDeliveredAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  createdAt: string;
  recentDeliveries: Array<{
    id: string;
    status: string;
    responseStatus: number | null;
    errorMessage: string | null;
    createdAt: string;
    deliveredAt: string | null;
  }>;
};

type KeysPayload = {
  apiKeys: ApiKeyRecord[];
  scopeCatalog: ScopeCatalogItem[];
};

type WebhooksPayload = {
  subscriptions: WebhookRecord[];
  eventCatalog: EventCatalogItem[];
};

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function ApiWebhooksPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "drafts:read",
    "drafts:write",
    "publish:write",
    "metrics:read",
    "scheduler:read",
    "research:write",
    "winners:read",
    "audit:read",
  ]);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "draft.posted",
    "draft.publish_failed",
    "winner.detected",
  ]);
  const [createdSigningSecret, setCreatedSigningSecret] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const keysQuery = useQuery<KeysPayload>({
    queryKey: ["snipradar-developer-keys"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/developer/keys");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load API keys");
      return payload;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const webhooksQuery = useQuery<WebhooksPayload>({
    queryKey: ["snipradar-developer-webhooks"],
    queryFn: async () => {
      const res = await fetch("/api/snipradar/developer/webhooks");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load webhooks");
      return payload;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/developer/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName,
          scopes: selectedScopes,
          expiresAt: keyExpiresAt ? new Date(keyExpiresAt).toISOString() : null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create API key");
      return payload as { apiKey: ApiKeyRecord; token: string };
    },
    onSuccess: (payload) => {
      setCreatedToken(payload.token);
      setKeyName("");
      setKeyExpiresAt("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-developer-keys"] });
      toast({
        title: "API key created",
        description: "Copy the token now. It will only be shown once.",
      });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snipradar/developer/keys/${id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to revoke API key");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-developer-keys"] });
      toast({
        title: "API key revoked",
        description: "The key is now inactive for all future requests.",
      });
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/snipradar/developer/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: webhookName,
          url: webhookUrl,
          events: selectedEvents,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to create webhook");
      return payload as { subscription: WebhookRecord; signingSecret: string };
    },
    onSuccess: (payload) => {
      setCreatedSigningSecret(payload.signingSecret);
      setWebhookName("");
      setWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["snipradar-developer-webhooks"] });
      toast({
        title: "Webhook created",
        description: "Copy the signing secret now. It will only be shown once.",
      });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const res = await fetch(`/api/snipradar/developer/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to update webhook");
      return payload as { subscription: WebhookRecord; signingSecret?: string };
    },
    onSuccess: (payload) => {
      if (payload.signingSecret) {
        setCreatedSigningSecret(payload.signingSecret);
      }
      queryClient.invalidateQueries({ queryKey: ["snipradar-developer-webhooks"] });
    },
  });

  const disableWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/snipradar/developer/webhooks/${id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Failed to disable webhook");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snipradar-developer-webhooks"] });
      toast({
        title: "Webhook disabled",
        description: "No more events will be delivered to this endpoint.",
      });
    },
  });

  const baseUrl = origin || "";
  const primaryToken = createdToken ?? "YOUR_SNIPRADAR_API_KEY";
  const sampleCurl = [
    `curl -s ${baseUrl}/api/snipradar/public/v1/drafts \\`,
    `  -H "Authorization: Bearer ${primaryToken}"`,
  ].join("\n");

  const sampleWebhookVerification = [
    "Signature header format:",
    "x-snipradar-signature: v1=<hex_hmac_sha256>",
    "",
    "Signed string:",
    '`${timestamp}.${rawBody}`',
  ].join("\n");

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4.5 w-4.5 text-primary" />
              Public API + Webhooks
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Generate API keys, ingest research, publish drafts, and subscribe to signed SnipRadar events.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              keysQuery.refetch();
              webhooksQuery.refetch();
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-sm font-medium">Base URL</p>
            <code className="block rounded-lg border border-border/70 bg-card/60 px-3 py-2 text-xs">
              {baseUrl ? `${baseUrl}/api/snipradar/public/v1` : "/api/snipradar/public/v1"}
            </code>
            <div className="flex flex-wrap gap-2">
              {[
                "GET /drafts",
                "POST /drafts",
                "POST /drafts/:id/publish",
                "GET /metrics",
                "GET /scheduled/runs",
                "POST /inbox",
                "GET /winners",
                "GET /profile-audit",
              ].map((endpoint) => (
                <Badge key={endpoint} variant="outline">
                  {endpoint}
                </Badge>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Sample cURL</Label>
              <Textarea readOnly value={sampleCurl} className="min-h-[110px] font-mono text-xs" />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
            <p className="text-sm font-medium">Webhook signing</p>
            <p className="text-sm text-muted-foreground">
              Every webhook includes a timestamp and HMAC signature. Verify it with your subscription secret.
            </p>
            <Textarea readOnly value={sampleWebhookVerification} className="min-h-[110px] font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4.5 w-4.5 text-primary" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="snipradar-api-key-name">Key name</Label>
                  <Input
                    id="snipradar-api-key-name"
                    placeholder="Agency automation"
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snipradar-api-key-expiry" optional>
                    Expiry
                  </Label>
                  <Input
                    id="snipradar-api-key-expiry"
                    type="datetime-local"
                    value={keyExpiresAt}
                    onChange={(event) => setKeyExpiresAt(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scopes</Label>
                  <div className="flex flex-wrap gap-2">
                    {(keysQuery.data?.scopeCatalog ?? []).map((scope) => {
                      const active = selectedScopes.includes(scope.id);
                      return (
                        <Button
                          key={scope.id}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() =>
                            setSelectedScopes((current) =>
                              active
                                ? current.filter((item) => item !== scope.id)
                                : [...current, scope.id]
                            )
                          }
                        >
                          {scope.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Button
                className="gap-1.5"
                disabled={createKeyMutation.isPending || !keyName.trim() || selectedScopes.length === 0}
                onClick={() => createKeyMutation.mutate()}
              >
                {createKeyMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create API key
              </Button>
            </div>

            {createdToken ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Copy this token now</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={async () => {
                      await navigator.clipboard.writeText(createdToken);
                      toast({ title: "Copied", description: "API token copied to clipboard." });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <code className="mt-3 block break-all rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-xs">
                  {createdToken}
                </code>
              </div>
            ) : null}

            <div className="space-y-3">
              {(keysQuery.data?.apiKeys ?? []).map((apiKey) => (
                <div key={apiKey.id} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{apiKey.name}</p>
                      <code className="text-xs text-muted-foreground">{apiKey.keyPreview}</code>
                    </div>
                    <Badge variant={apiKey.isActive ? "success" : "outline"}>
                      {apiKey.isActive ? "Active" : "Revoked"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {apiKey.scopes.map((scope) => (
                      <Badge key={`${apiKey.id}-${scope}`} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Created: {formatDateTime(apiKey.createdAt)}</p>
                    <p>Last used: {formatDateTime(apiKey.lastUsedAt)}</p>
                    <p>Expires: {formatDateTime(apiKey.expiresAt)}</p>
                  </div>
                  {apiKey.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 gap-1.5"
                      disabled={revokeKeyMutation.isPending}
                      onClick={() => revokeKeyMutation.mutate(apiKey.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ))}
              {keysQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading API keys...</p>
              ) : null}
              {keysQuery.error ? (
                <p className="text-sm text-destructive">{(keysQuery.error as Error).message}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4.5 w-4.5 text-primary" />
              Webhook Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
              <div className="space-y-2">
                <Label htmlFor="snipradar-webhook-name">Webhook name</Label>
                <Input
                  id="snipradar-webhook-name"
                  placeholder="Zapier sink"
                  value={webhookName}
                  onChange={(event) => setWebhookName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snipradar-webhook-url">Destination URL</Label>
                <Input
                  id="snipradar-webhook-url"
                  placeholder="https://example.com/snipradar"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="flex flex-wrap gap-2">
                  {(webhooksQuery.data?.eventCatalog ?? []).map((eventItem) => {
                    const active = selectedEvents.includes(eventItem.id);
                    return (
                      <Button
                        key={eventItem.id}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          setSelectedEvents((current) =>
                            active
                              ? current.filter((item) => item !== eventItem.id)
                              : [...current, eventItem.id]
                          )
                        }
                      >
                        {eventItem.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Button
                className="gap-1.5"
                disabled={
                  createWebhookMutation.isPending ||
                  !webhookName.trim() ||
                  !webhookUrl.trim() ||
                  selectedEvents.length === 0
                }
                onClick={() => createWebhookMutation.mutate()}
              >
                {createWebhookMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create webhook
              </Button>
            </div>

            {createdSigningSecret ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Copy this signing secret now</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={async () => {
                      await navigator.clipboard.writeText(createdSigningSecret);
                      toast({ title: "Copied", description: "Webhook signing secret copied." });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <code className="mt-3 block break-all rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-xs">
                  {createdSigningSecret}
                </code>
              </div>
            ) : null}

            <div className="space-y-3">
              {(webhooksQuery.data?.subscriptions ?? []).map((subscription) => (
                <div key={subscription.id} className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{subscription.name}</p>
                      <p className="text-xs text-muted-foreground">{subscription.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={subscription.isActive ? "success" : "outline"}>
                        {subscription.isActive ? "Active" : "Disabled"}
                      </Badge>
                      <Switch
                        checked={subscription.isActive}
                        onCheckedChange={(checked) =>
                          updateWebhookMutation.mutate({
                            id: subscription.id,
                            body: { isActive: checked },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {subscription.events.map((eventId) => (
                      <Badge key={`${subscription.id}-${eventId}`} variant="outline">
                        {eventId}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <p>Secret preview: {subscription.signingSecretPreview}</p>
                    <p>Last delivered: {formatDateTime(subscription.lastDeliveredAt)}</p>
                    <p>Last failure: {formatDateTime(subscription.lastFailureAt)}</p>
                    {subscription.lastFailureReason ? (
                      <p className="text-destructive">{subscription.lastFailureReason}</p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateWebhookMutation.mutate({
                          id: subscription.id,
                          body: { rotateSecret: true },
                        })
                      }
                    >
                      Rotate secret
                    </Button>
                    {subscription.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => disableWebhookMutation.mutate(subscription.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Disable
                      </Button>
                    ) : null}
                  </div>

                  {subscription.recentDeliveries.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                        Recent deliveries
                      </p>
                      <div className="space-y-2">
                        {subscription.recentDeliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            className="rounded-xl border border-border/60 bg-card/40 px-3 py-2 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant={delivery.status === "success" ? "success" : "warning"}>
                                  {delivery.status}
                                </Badge>
                                {delivery.responseStatus ? (
                                  <Badge variant="outline">{delivery.responseStatus}</Badge>
                                ) : null}
                              </div>
                              <span className="text-muted-foreground">
                                {formatDateTime(delivery.createdAt)}
                              </span>
                            </div>
                            {delivery.errorMessage ? (
                              <p className="mt-2 text-destructive">{delivery.errorMessage}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {webhooksQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading webhook subscriptions...</p>
              ) : null}
              {webhooksQuery.error ? (
                <p className="text-sm text-destructive">{(webhooksQuery.error as Error).message}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
