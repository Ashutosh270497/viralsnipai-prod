"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { BANNER_EVENT, type BannerPayload, type BannerVariant } from "@/lib/snipradar/banner-events";
import { cn } from "@/lib/utils";

const DISMISS_MS = 5000;

const variantStyles: Record<BannerVariant, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const variantIcons: Record<BannerVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

export function ActionBanner() {
  const [banner, setBanner] = useState<BannerPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<BannerPayload>).detail;
      // Clear any running dismiss timer so the new banner gets a fresh 5s window
      if (timerRef.current) clearTimeout(timerRef.current);
      setBanner(payload);
      setVisible(true);
    };
    window.addEventListener(BANNER_EVENT, handler);
    return () => window.removeEventListener(BANNER_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, banner]);

  if (!banner || !visible) return null;

  const variant = banner.variant ?? "success";
  const Icon = variantIcons[variant];

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b px-4 py-2.5 shadow-md",
        "animate-in slide-in-from-top duration-300",
        variantStyles[variant],
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{banner.message}</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
