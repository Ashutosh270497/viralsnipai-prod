"use client";

import { useState, useEffect } from "react";
import { Target, TrendingUp, DollarSign, Sparkles } from "lucide-react";

interface OnboardingStep2Props {
  data: { goalSelection: string };
  onChange: (data: { goalSelection: string }) => void;
  onNext: () => void;
}

const goals = [
  {
    id: "start_channel",
    title: "Start a new YouTube channel",
    description: "Just getting started and want to learn the basics",
    icon: Sparkles,
    accent: "text-primary",
    ring: "ring-primary/30",
    bg: "bg-primary/[0.08]",
  },
  {
    id: "grow_channel",
    title: "Grow my existing channel",
    description: "Have a channel and want to increase my subscriber base",
    icon: TrendingUp,
    accent: "text-emerald-400",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/[0.08]",
  },
  {
    id: "monetization",
    title: "Scale to monetisation",
    description: "Want to reach 1,000 subscribers and 4,000 watch hours",
    icon: DollarSign,
    accent: "text-amber-400",
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/[0.08]",
  },
  {
    id: "professional",
    title: "Create professional content",
    description: "Want to produce high-quality, engaging videos at scale",
    icon: Target,
    accent: "text-sky-400",
    ring: "ring-sky-500/30",
    bg: "bg-sky-500/[0.08]",
  },
];

export default function OnboardingStep2({ data, onChange, onNext }: OnboardingStep2Props) {
  const [selectedGoal, setSelectedGoal] = useState(data.goalSelection || "");
  const [error, setError] = useState("");

  useEffect(() => { onChange({ goalSelection: selectedGoal }); }, [selectedGoal, onChange]);

  const handleSelect = (goalId: string) => { setSelectedGoal(goalId); setError(""); };

  const handleNext = () => {
    if (!selectedGoal) { setError("Please select your primary goal"); return; }
    onNext();
  };

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          What&apos;s your primary goal?
        </h2>
        <p className="text-sm text-muted-foreground/60">
          Choose the option that best describes what you want to achieve
        </p>
      </div>

      <div className="space-y-3">
        {goals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedGoal === goal.id;

          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => handleSelect(goal.id)}
              className={
                `w-full rounded-xl border p-4 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-primary/50 bg-primary/[0.06]"
                    : "border-border/40 bg-white/[0.02] hover:border-border/70 hover:bg-white/[0.04]"
                }`
              }
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${goal.ring} ${goal.bg}`}>
                  <Icon className={`h-5 w-5 ${goal.accent}`} />
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
                    {isSelected && (
                      <div
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        style={{ boxShadow: "0 0 6px hsl(263 72% 56% / 0.8)" }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60">{goal.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-400/80">{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
          boxShadow: "0 0 14px hsl(263 72% 56% / 0.4), 0 2px 8px rgba(0,0,0,0.3)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 24px hsl(263 72% 56% / 0.6), 0 4px 12px rgba(0,0,0,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 14px hsl(263 72% 56% / 0.4), 0 2px 8px rgba(0,0,0,0.3)";
        }}
      >
        Continue →
      </button>
    </div>
  );
}
