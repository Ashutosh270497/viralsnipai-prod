"use client";

import { useEffect, useState } from "react";

import { CONTENT_GOAL_OPTIONS } from "@/lib/onboarding-options";
import type { ContentGoal } from "@/lib/validations";

interface OnboardingStep3Props {
  data: { contentGoal: ContentGoal | "" };
  onChange: (data: { contentGoal: ContentGoal | "" }) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function OnboardingStep3({
  data,
  onChange,
  onSubmit,
  isSubmitting,
}: OnboardingStep3Props) {
  const [selectedGoal, setSelectedGoal] = useState<ContentGoal | "">(data.contentGoal || "");
  const [error, setError] = useState("");

  useEffect(() => {
    onChange({ contentGoal: selectedGoal });
  }, [selectedGoal, onChange]);

  function handleSubmit() {
    if (!selectedGoal) {
      setError("Pick the goal that matters most");
      return;
    }
    onSubmit();
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          What&apos;s your main goal right now?
        </h2>
        <p className="text-sm text-muted-foreground/60">
          We&apos;ll optimise clip selection and captions toward this outcome.
        </p>
      </div>

      <div className="space-y-3">
        {CONTENT_GOAL_OPTIONS.map((option) => {
          const isSelected = selectedGoal === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSelectedGoal(option.value);
                setError("");
              }}
              className={`w-full rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary/60 bg-primary/[0.08]"
                  : "border-border/40 bg-white/[0.02] hover:border-border/70 hover:bg-white/[0.04]"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{option.label}</p>
              {option.description && (
                <p className="mt-0.5 text-xs text-muted-foreground/60">{option.description}</p>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400/80">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
          boxShadow: "0 0 14px hsl(160 84% 39% / 0.4), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {isSubmitting ? "Setting up your workspace…" : "Finish setup →"}
      </button>
    </div>
  );
}
