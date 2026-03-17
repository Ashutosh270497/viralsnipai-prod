"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";

interface OnboardingStep3Props {
  data: { nicheInterests: string[] };
  onChange: (data: { nicheInterests: string[] }) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const niches = [
  "Technology & Gadgets",
  "Gaming",
  "Education & Tutorials",
  "Finance & Investing",
  "Health & Fitness",
  "Cooking & Food",
  "Travel & Vlogs",
  "Beauty & Fashion",
  "Business & Entrepreneurship",
  "Entertainment & Comedy",
  "Music & Art",
  "Sports & Outdoors",
  "Parenting & Family",
  "Science & Engineering",
  "Self-improvement",
];

export default function OnboardingStep3({
  data,
  onChange,
  onSubmit,
  isSubmitting,
}: OnboardingStep3Props) {
  const [selectedNiches, setSelectedNiches] = useState<string[]>(data.nicheInterests || []);
  const [error, setError] = useState("");

  useEffect(() => { onChange({ nicheInterests: selectedNiches }); }, [selectedNiches, onChange]);

  const toggleNiche = (niche: string) => {
    setSelectedNiches((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : [...prev, niche]
    );
    setError("");
  };

  const handleSubmit = () => {
    if (selectedNiches.length === 0) { setError("Please select at least one niche"); return; }
    onSubmit();
  };

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Choose your niche interests
        </h2>
        <p className="text-sm text-muted-foreground/60">
          Select one or more topics you&apos;re interested in creating content about
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {niches.map((niche) => {
            const isSelected = selectedNiches.includes(niche);
            const isDisabled = !isSelected && selectedNiches.length >= 10;

            return (
              <button
                key={niche}
                type="button"
                onClick={() => toggleNiche(niche)}
                disabled={isDisabled}
                className={
                  `relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? "border-primary/50 bg-primary/[0.08]"
                      : "border-border/40 bg-white/[0.02] hover:border-border/70"
                  }`
                }
              >
                {/* Checkbox */}
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                    isSelected
                      ? "border-primary bg-primary"
                      : "border-border/50 bg-transparent"
                  }`}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </div>

                <span className={`text-xs font-medium ${isSelected ? "text-foreground" : "text-foreground/70"}`}>
                  {niche}
                </span>

                {/* Glow dot on selected */}
                {isSelected && (
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 6px hsl(263 72% 56% / 0.9)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {selectedNiches.length > 0 && (
          <p className="text-xs text-muted-foreground/50">
            {selectedNiches.length} niche{selectedNiches.length !== 1 ? "s" : ""} selected
            {selectedNiches.length >= 10 && " · maximum reached"}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-400/80">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
          boxShadow: "0 0 14px hsl(263 72% 56% / 0.4), 0 2px 8px rgba(0,0,0,0.3)",
        }}
        onMouseEnter={(e) => {
          if (!isSubmitting)
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 0 24px hsl(263 72% 56% / 0.6), 0 4px 12px rgba(0,0,0,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 14px hsl(263 72% 56% / 0.4), 0 2px 8px rgba(0,0,0,0.3)";
        }}
      >
        {isSubmitting ? "Setting up your account…" : "Complete Setup →"}
      </button>
    </div>
  );
}
