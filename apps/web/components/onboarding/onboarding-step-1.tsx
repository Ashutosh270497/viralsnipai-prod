"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  v1OnboardingStep1Schema,
  type V1OnboardingStep1Input,
} from "@/lib/validations";
import { CREATOR_TYPE_OPTIONS } from "@/lib/onboarding-options";

interface OnboardingStep1Props {
  data: V1OnboardingStep1Input;
  onChange: (data: V1OnboardingStep1Input) => void;
  onNext: () => void;
}

const inputClass =
  "w-full rounded-lg border border-border/50 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

export default function OnboardingStep1({ data, onChange, onNext }: OnboardingStep1Props) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<V1OnboardingStep1Input>({
    resolver: zodResolver(v1OnboardingStep1Schema),
    defaultValues: data,
  });

  const formValues = watch();
  const selectedCreatorType = formValues.creatorType;

  useEffect(() => {
    onChange(formValues);
  }, [formValues, onChange]);

  return (
    <form onSubmit={handleSubmit(() => onNext())} className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome — tell us who you are
        </h2>
        <p className="text-sm text-muted-foreground/60">
          This helps us tailor clip suggestions to your voice and audience.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50"
          >
            Your name <span className="text-red-400/70 normal-case tracking-normal">*</span>
          </label>
          <input
            id="name"
            type="text"
            placeholder="Alex Rivera"
            {...register("name")}
            className={inputClass}
          />
          {errors.name && <p className="text-xs text-red-400/80">{errors.name.message}</p>}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            What best describes you?{" "}
            <span className="text-red-400/70 normal-case tracking-normal">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CREATOR_TYPE_OPTIONS.map((option) => {
              const isSelected = selectedCreatorType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setValue("creatorType", option.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className={`rounded-xl border p-3 text-left transition-all ${
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
          {errors.creatorType && (
            <p className="text-xs text-red-400/80">{errors.creatorType.message}</p>
          )}
        </div>
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
