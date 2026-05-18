"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        signOut({
          callbackUrl: "/"
        })
      }
    >
      Sign out
    </Button>
  );
}

export function SignOutAllDevicesButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { toast } = useToast();

  async function handleSignOutEverywhere() {
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout-all-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Could not sign out on all devices.");
      }
      await signOut({ callbackUrl: "/" });
    } catch {
      setIsSigningOut(false);
      toast({
        title: "Sign out failed",
        description: "Please try again or contact support if this continues.",
        variant: "destructive",
      });
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSignOutEverywhere}
      disabled={isSigningOut}
    >
      {isSigningOut ? "Signing out..." : "Sign out on all devices"}
    </Button>
  );
}
