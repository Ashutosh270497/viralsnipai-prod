"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import OnboardingStep1 from "@/components/onboarding/onboarding-step-1";
import OnboardingStep2 from "@/components/onboarding/onboarding-step-2";
import OnboardingStep3 from "@/components/onboarding/onboarding-step-3";
import { useToast } from "@/components/ui/use-toast";
import type {
  V1OnboardingStep1Input,
  V1OnboardingStep2Input,
  ContentGoal,
} from "@/lib/validations";

const STORAGE_KEY = "viralsnipai_v1_onboarding_progress";

interface OnboardingData {
  step1: V1OnboardingStep1Input;
  step2: V1OnboardingStep2Input;
  step3: { contentGoal: ContentGoal | "" };
}

const initialData: OnboardingData = {
  step1: { name: "", creatorType: "founder" },
  step2: { primaryPlatform: "youtube_shorts", contentNiche: "" },
  step3: { contentGoal: "" },
};

const STEP_LABELS = ["About you", "Platform & niche", "Main goal"];

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
    setFormData((prev) => ({ ...prev, step1: data }));
  const handleStep2Change = (data: OnboardingData["step2"]) =>
    setFormData((prev) => ({ ...prev, step2: data }));
  const handleStep3Change = (data: OnboardingData["step3"]) =>
    setFormData((prev) => ({ ...prev, step3: data }));

  const handleNext = () => setCurrentStep((step) => Math.min(step + 1, 3));
  const handleBack = () => setCurrentStep((step) => Math.max(step - 1, 1));

  async function handleSubmit() {
    if (!formData.step3.contentGoal) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.step1.name,
          creatorType: formData.step1.creatorType,
          primaryPlatform: formData.step2.primaryPlatform,
          contentNiche: formData.step2.contentNiche,
          contentGoal: formData.step3.contentGoal,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        toast({
          title: "We couldn't save that",
          description: data.error || "Please try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "You're in!",
        description: "Your workspace is ready. Let's create your first clip.",
      });
      await update();
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
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
      <div className="space-y-3">
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
                {i < STEP_LABELS.length - 1 && <div className="h-px w-8 flex-1 bg-border/30" />}
              </div>
            );
          })}
        </div>

        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #10b981, #34d399)",
              boxShadow: "0 0 8px hsl(160 84% 39% / 0.5)",
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-8">
        {currentStep === 1 && (
          <OnboardingStep1
            data={formData.step1}
            onChange={handleStep1Change}
            onNext={handleNext}
          />
        )}
        {currentStep === 2 && (
          <OnboardingStep2
            data={formData.step2}
            onChange={handleStep2Change}
            onNext={handleNext}
          />
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
