"use client";

import { useQuery } from "@tanstack/react-query";

import { parseSnipRadarApiError } from "@/lib/snipradar/client-errors";
import type { BillingSubscriptionState } from "@/types/billing";

export function useBillingSubscriptionState() {
  return useQuery<BillingSubscriptionState>({
    queryKey: ["billing-subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) {
        throw await parseSnipRadarApiError(res, "Failed to load billing state");
      }
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
