"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingState({ message, size = "md", className }: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-8", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {message && (
        <p className={cn("text-center text-muted-foreground", textSizeClasses[size])}>
          {message}
        </p>
      )}
    </div>
  );
}

interface FullPageLoadingProps {
  message?: string;
}

export function FullPageLoading({ message = "Loading..." }: FullPageLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoadingState message={message} size="lg" />
    </div>
  );
}

interface InlineLoadingProps {
  message?: string;
  className?: string;
}

export function InlineLoading({ message, className }: InlineLoadingProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}

interface ButtonLoadingProps {
  children: React.ReactNode;
  isLoading: boolean;
}

export function ButtonLoading({ children, isLoading }: ButtonLoadingProps) {
  return (
    <>
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </>
  );
}
