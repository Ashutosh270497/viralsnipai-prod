"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  v1OnboardingStep2Schema,
  type V1OnboardingStep2Input,
} from "@/lib/validations";
import { PRIMARY_PLATFORM_OPTIONS } from "@/lib/onboarding-options";

interface OnboardingStep2Props {
  data: V1OnboardingStep2Input;
  onChange: (data: V1OnboardingStep2Input) => void;
  onNext: () => void;
}

const inputClass =
  "w-full rounded-lg border border-border/50 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

export default function OnboardingStep2({ data, onChange, onNext }: OnboardingStep2Props) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<V1OnboardingStep2Input>({
    resolver: zodResolver(v1OnboardingStep2Schema),
    defaultValues: data,
  });

  const formValues = watch();
  const selectedPlatform = formValues.primaryPlatform;

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  return (
    <form onSubmit={handleSubmit(() => onNext())} className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Where do your clips go?
        </h2>
        <p className="text-sm text-muted-foreground/60">
          Pick the platform you post to most. We&apos;ll tune aspect ratios and captions to fit.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
          Primary platform <span className="text-red-400/70 normal-case tracking-normal">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRIMARY_PLATFORM_OPTIONS.map((option) => {
            const isSelected = selectedPlatform === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setValue("primaryPlatform", option.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold transition-all ${
                  isSelected
                    ? "border-primary/60 bg-primary/[0.08] text-foreground"
                    : "border-border/40 bg-white/[0.02] text-foreground/80 hover:border-border/70 hover:bg-white/[0.04]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {errors.primaryPlatform && (
          <p className="text-xs text-red-400/80">{errors.primaryPlatform.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="contentNiche"
          className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50"
        >
          Your content niche <span className="text-red-400/70 normal-case tracking-normal">*</span>
        </label>
        <input
          id="contentNiche"
          type="text"
          placeholder="SaaS marketing, fitness coaching, personal finance…"
          {...register("contentNiche")}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground/40">
          One short phrase is perfect. You can refine this later.
        </p>
        {errors.contentNiche && (
          <p className="text-xs text-red-400/80">{errors.contentNiche.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
          boxShadow: "0 0 14px hsl(160 84% 39% / 0.4), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        Continue →
      </button>
    </form>
  );
}
