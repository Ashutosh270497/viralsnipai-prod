"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "clippers:cookie-consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          We use cookies to personalize Clippers and analyze usage. We never sell your data. See our privacy policy for details.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/privacy" rel="noreferrer">Privacy</a>
          </Button>
          <Button size="sm" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
