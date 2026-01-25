"use client";

import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm shadow-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-background",
        destructive: "border-destructive/50 text-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = ({ className, variant, ...props }: AlertProps) => (
  <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
);

export const AlertTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn("text-sm font-semibold leading-none tracking-tight", className)} {...props} />
);

export const AlertDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("mt-2 text-sm text-muted-foreground", className)} {...props} />
);
