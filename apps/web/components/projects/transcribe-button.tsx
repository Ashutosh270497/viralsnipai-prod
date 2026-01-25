"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function TranscribeButton({ assetId }: { assetId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
        cache: "no-store",
        next: { revalidate: 0 }
      });
      if (!response.ok) {
        throw new Error("Failed to transcribe");
      }
      toast({ title: "Transcript ready" });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Could not transcribe asset" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Transcribing..." : "Transcribe"}
    </Button>
  );
}
