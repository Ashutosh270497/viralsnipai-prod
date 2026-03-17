"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingStep1Schema, type OnboardingStep1Input } from "@/lib/validations";

interface OnboardingStep1Props {
  data: OnboardingStep1Input;
  onChange: (data: OnboardingStep1Input) => void;
  onNext: () => void;
}

const inputClass =
  "w-full rounded-lg border border-border/50 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

const selectClass =
  "w-full rounded-lg border border-border/50 bg-background/60 px-4 py-3 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors";

export default function OnboardingStep1({ data, onChange, onNext }: OnboardingStep1Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<OnboardingStep1Input>({
    resolver: zodResolver(onboardingStep1Schema),
    defaultValues: data,
  });

  const formValues = watch();
  useEffect(() => { onChange(formValues); }, [formValues, onChange]);

  const onSubmit = () => onNext();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Tell us about yourself
        </h2>
        <p className="text-sm text-muted-foreground/60">
          Help us personalise your experience
        </p>
      </div>

      <div className="space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Full name <span className="text-red-400/70 normal-case tracking-normal">*</span>
          </label>
          <input id="name" type="text" placeholder="Enter your name" {...register("name")} className={inputClass} />
          {errors.name && (
            <p className="text-xs text-red-400/80">{errors.name.message}</p>
          )}
        </div>

        {/* YouTube Channel URL */}
        <div className="space-y-2">
          <label htmlFor="youtubeChannelUrl" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            YouTube Channel URL{" "}
            <span className="normal-case tracking-normal font-normal text-muted-foreground/40">(optional)</span>
          </label>
          <input
            id="youtubeChannelUrl"
            type="text"
            placeholder="https://youtube.com/@yourchannel"
            {...register("youtubeChannelUrl")}
            className={inputClass}
          />
          {errors.youtubeChannelUrl && (
            <p className="text-xs text-red-400/80">{errors.youtubeChannelUrl.message}</p>
          )}
          <p className="text-xs text-muted-foreground/40">
            Paste your channel URL to unlock richer personalisation
          </p>
        </div>

        {/* Subscriber Count */}
        <div className="space-y-2">
          <label htmlFor="subscriberCount" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">
            Subscriber count <span className="text-red-400/70 normal-case tracking-normal">*</span>
          </label>
          <select id="subscriberCount" {...register("subscriberCount")} className={selectClass}>
            <option value="">Select subscriber range</option>
            <option value="0-1k">Just starting (0–1K)</option>
            <option value="1k-10k">Growing (1K–10K)</option>
            <option value="10k-100k">Established (10K–100K)</option>
            <option value="100k-1m">Large channel (100K–1M)</option>
            <option value="1m+">Major creator (1M+)</option>
          </select>
          {errors.subscriberCount && (
            <p className="text-xs text-red-400/80">{errors.subscriberCount.message}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
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
    </form>
  );
}
