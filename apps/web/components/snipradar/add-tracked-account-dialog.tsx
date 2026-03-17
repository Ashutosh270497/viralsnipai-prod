"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2, CheckCircle } from "lucide-react";
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
import { SnipRadarBillingGateCard } from "@/components/snipradar/billing-gate-card";
import {
  getSnipRadarBillingGateDetails,
} from "@/lib/snipradar/billing-gates";
import {
  parseSnipRadarApiError,
  toSnipRadarApiError,
} from "@/lib/snipradar/client-errors";

interface AddTrackedAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddTrackedAccountDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddTrackedAccountDialogProps) {
  const [username, setUsername] = useState("");
  const [niche, setNiche] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: { username: string; niche?: string }) => {
      const res = await fetch("/api/snipradar/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to add account");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const name = data.account?.trackedDisplayName ?? username;
      setSuccess(`Now tracking @${data.account?.trackedUsername ?? username}`);
      setUsername("");
      setNiche("");
      setError(null);
      onSuccess();
      setTimeout(() => {
        setSuccess(null);
        onOpenChange(false);
      }, 1500);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });
  const gateDetails = getSnipRadarBillingGateDetails(
    mutation.error ? toSnipRadarApiError(mutation.error, "Failed to add account") : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track an Account</DialogTitle>
          <DialogDescription>
            Add an X account to track for viral content and patterns.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate({
              username: username.replace("@", ""),
              niche: niche || undefined,
            });
          }}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="username">X Username</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                placeholder="@username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9"
                disabled={mutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="niche">Niche (optional)</Label>
            <Input
              id="niche"
              placeholder="e.g., Tech, AI, Marketing"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          {gateDetails ? (
            <SnipRadarBillingGateCard details={gateDetails} compact />
          ) : null}

          {error && !gateDetails && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!username.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Looking up...
              </>
            ) : (
              "Track Account"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
