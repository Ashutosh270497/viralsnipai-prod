"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OnboardingStep1 from "@/components/onboarding/onboarding-step-1";
import OnboardingStep2 from "@/components/onboarding/onboarding-step-2";
import OnboardingStep3 from "@/components/onboarding/onboarding-step-3";
import { useToast } from "@/components/ui/use-toast";
import type { OnboardingStep1Input } from "@/lib/validations";

const STORAGE_KEY = "youtube_creator_onboarding_progress";

interface OnboardingData {
  step1: OnboardingStep1Input;
  step2: { goalSelection: string };
  step3: { nicheInterests: string[] };
}

const initialData: OnboardingData = {
  step1: { name: "", youtubeChannelUrl: "", subscriberCount: "0-1k" },
  step2: { goalSelection: "" },
  step3: { nicheInterests: [] },
};

const STEP_LABELS = ["Your profile", "Your goal", "Your niche"];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(parsed.formData || initialData);
        setCurrentStep(parsed.currentStep || 1);
      } catch (error) {
        console.error("Error loading saved progress:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ formData, currentStep }));
  }, [formData, currentStep]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.onboardingCompleted) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  const handleStep1Change = (data: OnboardingData["step1"]) =>
    setFormData({ ...formData, step1: data });
  const handleStep2Change = (data: OnboardingData["step2"]) =>
    setFormData({ ...formData, step2: data });
  const handleStep3Change = (data: OnboardingData["step3"]) =>
    setFormData({ ...formData, step3: data });

  const handleNext = () => { if (currentStep < 3) setCurrentStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.step1.name,
          youtubeChannelUrl: formData.step1.youtubeChannelUrl || null,
          subscriberCount: formData.step1.subscriberCount,
          goalSelection: formData.step2.goalSelection,
          nicheInterests: formData.step3.nicheInterests,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: "Error", description: data.error || "Failed to complete onboarding", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      localStorage.removeItem(STORAGE_KEY);
      toast({ title: "Welcome!", description: "Your account has been set up successfully" });
      await update();
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/signin");
    return null;
  }

  const progressPct = Math.round((currentStep / 3) * 100);

  return (
    <div className="w-full max-w-xl space-y-6 animate-enter">

      {/* ── Step indicators ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Step pills */}
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const step = i + 1;
            const isDone = step < currentStep;
            const isActive = step === currentStep;
            return (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className={
                      isActive
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
                        : isDone
                        ? "flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400"
                        : "flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-muted-foreground/40"
                    }
                  >
                    {isDone ? "✓" : step}
                  </div>
                  <span
                    className={
                      isActive
                        ? "text-xs font-semibold text-foreground"
                        : isDone
                        ? "text-xs font-medium text-emerald-400"
                        : "text-xs font-medium text-muted-foreground/40"
                    }
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="flex-1 h-px w-8 bg-border/30" />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #10b981, #34d399)",
              boxShadow: "0 0 8px hsl(263 72% 56% / 0.5)",
            }}
          />
        </div>
      </div>

      {/* ── Step card ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/50 bg-card p-8">
        {currentStep === 1 && (
          <OnboardingStep1 data={formData.step1} onChange={handleStep1Change} onNext={handleNext} />
        )}
        {currentStep === 2 && (
          <OnboardingStep2 data={formData.step2} onChange={handleStep2Change} onNext={handleNext} />
        )}
        {currentStep === 3 && (
          <OnboardingStep3
            data={formData.step3}
            onChange={handleStep3Change}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* ── Back navigation ─────────────────────────────────────────────────── */}
      {currentStep > 1 && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}
    </div>
  );
}
