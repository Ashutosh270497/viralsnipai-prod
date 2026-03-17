import path from "path";
import sharp from "sharp";
import type { BrandKit } from "@prisma/client";

export const DEFAULT_WATERMARK_TEXT = "made with ViralSnipAI";

export type WatermarkStyle = {
  enabled: boolean;
  text: string;
  primaryColor: string;
  textColor: string;
  fontFamily: string;
  logoStoragePath?: string | null;
};

export function isPaidPlan(plan?: string | null) {
  if (!plan) {
    return false;
  }
  return plan.toLowerCase() !== "free";
}

export function resolveWatermarkStyle(brandKit?: BrandKit | null, plan?: string | null): WatermarkStyle {
  const sanitizedPrimary = sanitizeHex(brandKit?.primaryHex) ?? "#00A3FF";
  const textColor = pickContrastingTextColor(sanitizedPrimary);
  const paid = isPaidPlan(plan);
  const watermarkEnabled = paid ? brandKit?.watermark !== false : true;

  return {
    enabled: watermarkEnabled,
    text: DEFAULT_WATERMARK_TEXT,
    primaryColor: sanitizedPrimary,
    textColor,
    fontFamily: brandKit?.fontFamily ?? "Inter",
    logoStoragePath: brandKit?.logoStoragePath ?? null
  };
}

export async function generateWatermarkOverlayBuffer(
  style: WatermarkStyle,
  options?: { fontSize?: number }
): Promise<Buffer> {
  if (!style.enabled) {
    throw new Error("Watermark overlay requested while watermark is disabled.");
  }

  const fontSize = Math.max(32, Math.floor(options?.fontSize ?? 54));
  const innerPaddingX = Math.round(fontSize * 0.65);
  const innerPaddingY = Math.round(fontSize * 0.45);
  const outerPadding = Math.round(fontSize * 0.6);
  const spacingBetween = Math.round(fontSize * 0.5);

  const text = escapeXml(style.text || DEFAULT_WATERMARK_TEXT);
  const estimatedTextWidth = Math.max(fontSize * 6, Math.ceil(text.length * fontSize * 0.62));
  const textBoxWidth = estimatedTextWidth + innerPaddingX * 2;
  const textBoxHeight = fontSize + innerPaddingY * 2;

  let logoBuffer: Buffer | null = null;
  let logoWidth = 0;
  let logoHeight = 0;

  if (style.logoStoragePath) {
    try {
      const normalizedPath = path.resolve(style.logoStoragePath);
      const resizedLogo = sharp(normalizedPath)
        .resize({
          height: textBoxHeight - innerPaddingY,
          fit: "inside",
          withoutEnlargement: true
        })
        .png();
      const resizedBuffer = await resizedLogo.toBuffer();
      const { width = 0, height = 0 } = await sharp(resizedBuffer).metadata();
      logoBuffer = resizedBuffer;
      logoWidth = width ?? 0;
      logoHeight = height ?? 0;
    } catch (error) {
      console.warn("Failed to include logo in watermark overlay", error);
      logoBuffer = null;
      logoWidth = 0;
      logoHeight = 0;
    }
  }

  const combinedWidth = logoWidth > 0 ? logoWidth + spacingBetween + textBoxWidth : textBoxWidth;
  const canvasWidth = combinedWidth + outerPadding * 2;
  const canvasHeight = textBoxHeight + outerPadding * 2;
  const rectX = outerPadding;
  const rectY = outerPadding;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">
  <rect x="${rectX}" y="${rectY}" width="${combinedWidth}" height="${textBoxHeight}" rx="${Math.round(
    fontSize * 0.35
  )}" ry="${Math.round(fontSize * 0.35)}" fill="${style.primaryColor}" opacity="0.18" />
  <text x="${rectX + (logoWidth > 0 ? logoWidth + spacingBetween : 0) + innerPaddingX}" y="${
    rectY + textBoxHeight / 2
  }" fill="${style.textColor}" font-size="${fontSize}" font-family="${escapeSvgFontFamily(
    style.fontFamily
  )}, 'Inter', 'Helvetica', 'Arial', sans-serif" font-weight="600" dominant-baseline="middle" text-anchor="start" opacity="0.9">
    ${text}
  </text>
</svg>`;

  let overlayBuffer = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  if (logoBuffer && logoWidth > 0 && logoHeight > 0) {
    const logoTop = outerPadding + Math.max(0, Math.round((textBoxHeight - logoHeight) / 2));
    overlayBuffer = await sharp(overlayBuffer)
      .composite([
        {
          input: logoBuffer,
          left: outerPadding,
          top: logoTop
        }
      ])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }

  return overlayBuffer;
}

export function sanitizeHex(input?: string | null) {
  if (!input) {
    return null;
  }
  const trimmed = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(trimmed)) {
    return null;
  }
  return `#${trimmed.toUpperCase()}`;
}

function pickContrastingTextColor(hex: string) {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? "#0B1620" : "#FFFFFF";
}

function hexToRgb(hex: string) {
  const sanitized = sanitizeHex(hex);
  if (!sanitized) {
    return null;
  }
  const value = sanitized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

function escapeXml(value: string) {
  return value.replace(/["'&<>]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return character;
    }
  });
}

function escapeSvgFontFamily(family: string) {
  return family.replace(/["'<>]/g, "");
}
