import React from "react";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const gradients = {
  brand: ["#5B8CFF", "#22E1FF"],
  base: ["rgba(16,24,40,0.95)", "rgba(2,6,23,0.95)"]
};

const titleMap: Record<string, { title: string; subtitle: string }> = {
  landing: {
    title: "Create viral-ready clips in minutes",
    subtitle: "AI hooks · captions · templates · exports"
  },
  pricing: {
    title: "Flexible plans for modern content teams",
    subtitle: "Free, Pro, Agency, and Enterprise tiers"
  },
  templates: {
    title: "Template gallery for every platform",
    subtitle: "Shorts · Reels · TikTok · LinkedIn · X"
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "landing";
  const payload = titleMap[path] ?? {
    title: "Clippers",
    subtitle: "Hooksmith × RepurposeOS"
  };

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: `linear-gradient(135deg, ${gradients.base[0]} 0%, ${gradients.base[1]} 60%, ${gradients.brand[0]} 100%)`,
          color: "white",
          fontFamily: "Inter, sans-serif"
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${gradients.brand[0]}, ${gradients.brand[1]})`
              }}
            />
            <span style={{ fontWeight: 600 }}>Clippers</span>
          </div>
          <span style={{ fontSize: 20, color: "rgba(255,255,255,0.7)" }}>Hooksmith × RepurposeOS</span>
        </header>
        <main style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{payload.title}</h1>
          <p style={{ fontSize: 28, color: "rgba(226,232,240,0.85)" }}>{payload.subtitle}</p>
        </main>
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: gradients.brand[0]
              }}
            />
            <span style={{ color: "rgba(226,232,240,0.75)" }}>AI hooks · Captions · Templates · Exports</span>
          </div>
          <span style={{ color: "rgba(226,232,240,0.75)" }}>clippers.app</span>
        </footer>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
