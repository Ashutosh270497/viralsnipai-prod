"use client";

import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type WorkflowStep = {
  id: string;
  label: string;
  href: string;
  completed: boolean;
  current?: boolean;
};

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  className?: string;
}

export function WorkflowProgress({ steps, className }: WorkflowProgressProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex flex-1 items-center">
              <Link
                href={step.href}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 transition-all",
                  step.current && "bg-primary/10",
                  !step.current && "hover:bg-secondary"
                )}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
                ) : (
                  <Circle
                    className={cn(
                      "h-5 w-5 flex-shrink-0",
                      step.current ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.current && "text-primary",
                    !step.current && step.completed && "text-foreground",
                    !step.current && !step.completed && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </Link>

              {!isLast && (
                <ArrowRight className="mx-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
