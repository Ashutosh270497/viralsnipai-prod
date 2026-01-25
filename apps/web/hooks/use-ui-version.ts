"use client";

import { useMemo } from "react";

import { isUiV2Enabled } from "@/lib/feature-flags";

export function useUiVersion() {
  return useMemo(() => ({ uiV2Enabled: isUiV2Enabled() }), []);
}
