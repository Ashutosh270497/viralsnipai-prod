"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SafeThumbnailAspect = "video" | "square" | "portrait";

type SafeThumbnailImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  aspect?: SafeThumbnailAspect;
  fallbackIcon?: ReactNode;
  children?: ReactNode;
};

export function normalizeThumbnailSrc(src?: string | null) {
  const value = src?.trim();
  if (!value) return null;

  if (value.startsWith("uploads/")) {
    return `/${value}`;
  }

  if (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  return null;
}

export function SafeThumbnailImage({
  src,
  alt,
  className,
  imageClassName,
  aspect = "video",
  fallbackIcon,
  children,
}: SafeThumbnailImageProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const safeSrc = useMemo(() => normalizeThumbnailSrc(src), [src]);
  const shouldRenderImage = Boolean(safeSrc) && !hasImageError;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-black/40",
        aspect === "square" ? "aspect-square" : aspect === "portrait" ? "aspect-[9/16]" : "aspect-video",
        className
      )}
    >
      {shouldRenderImage ? (
        <Image
          src={safeSrc!}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 320px"
          className={cn("object-cover", imageClassName)}
          unoptimized
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/35">
          {fallbackIcon ?? (
            <div className="flex flex-col items-center gap-2 text-xs">
              <Film className="h-7 w-7 text-muted-foreground/25" />
              <span>No preview</span>
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
