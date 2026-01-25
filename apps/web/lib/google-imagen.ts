import { randomUUID } from "crypto";
import sharp from "sharp";

import { generateWatermarkOverlayBuffer, type WatermarkStyle } from "@/lib/watermark";

type ImagenQuality = "standard" | "premium";
type ImagenAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
type EndpointKind = "generateImages" | "generateContent";

export type ImagenRequest = {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: ImagenAspectRatio;
  quality?: ImagenQuality;
  count?: number;
  stylePreset?: string;
  seed?: number;
  referenceImage?: {
    mimeType: string;
    base64: string;
    filename?: string;
  };
  referenceImages?: Array<{
    mimeType: string;
    base64: string;
    filename?: string;
  }>;
};

export type ImagenImage = {
  id: string;
  mimeType: string;
  /**
   * base64 encoded bytes (without the prefix). Consumers can create a data URL using mimeType.
   */
  base64: string;
  prompt: string;
  alt?: string;
  width?: number;
  height?: number;
  providerMetadata?: Record<string, unknown>;
};

type ModelConfig = {
  name: string;
  endpoint: EndpointKind;
};

const MODEL_CONFIG = resolveModelConfig();
const DEFAULT_MODEL = MODEL_CONFIG.name;
const ENDPOINT_KIND = MODEL_CONFIG.endpoint;
const DEFAULT_ENDPOINT = resolveEndpoint(DEFAULT_MODEL, ENDPOINT_KIND);
const SUPPORTS_MULTI_CANDIDATE = !MODEL_CONFIG.name.toLowerCase().includes("gemini");
const MAX_REFERENCE_IMAGES = 5;

function resolveModelConfig(): ModelConfig {
  const configured = process.env.GOOGLE_IMAGEN_MODEL?.trim();
  const modelName = extractModelName(configured) ?? "imagen-4.0-generate-1";
  return {
    name: modelName,
    endpoint: inferEndpointKind(modelName)
  };
}

function extractModelName(value: string | undefined | null) {
  if (!value) return null;
  if (!value.includes("/")) {
    return value;
  }
  const segments = value.split("/").filter(Boolean);
  return segments.pop() ?? value;
}

function inferEndpointKind(model: string): EndpointKind {
  const normalized = model.toLowerCase();
  if (normalized.includes("gemini") && !normalized.includes("imagen")) {
    return "generateContent";
  }
  if (normalized.includes("img-to-img") || normalized.includes("imagegeneration")) {
    return "generateImages";
  }
  return normalized.startsWith("imagen") ? "generateImages" : "generateContent";
}

function buildEndpointFromModel(model: string, kind: EndpointKind) {
  const route = kind === "generateImages" ? "generateImages" : "generateContent";
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${route}`;
}

function resolveEndpoint(model: string, kind: EndpointKind) {
  const configured = process.env.GOOGLE_NANO_BANANA_ENDPOINT?.trim();
  if (!configured) {
    return buildEndpointFromModel(model, kind);
  }
  try {
    return new URL(configured).toString();
  } catch (error) {
    console.warn("Invalid GOOGLE_NANO_BANANA_ENDPOINT value, falling back to default:", error);
    return buildEndpointFromModel(model, kind);
  }
}

const apiKey = process.env.GOOGLE_NANO_BANANA_API_KEY;
const hasApiKey = Boolean(apiKey);

function createMockImages(request: ImagenRequest): ImagenImage[] {
  const samples = request.count && request.count > 0 ? Math.min(request.count, 4) : 2;
  return Array.from({ length: samples }).map((_, index) => {
    const hue = (index * 127 + request.prompt.length * 13) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="grad-${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue},70%,60%);stop-opacity:1" />
      <stop offset="100%" style="stop-color:hsl(${(hue + 90) % 360},70%,45%);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#grad-${index})" rx="32" />
  <text x="512" y="512" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="48" fill="white" text-anchor="middle">
    ${escapeXml(request.prompt.slice(0, 32) || "Imagen prompt")}
  </text>
  <text x="512" y="580" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="rgba(255,255,255,0.7)" text-anchor="middle">
    nano banana mock · ${index + 1}
  </text>
</svg>`;
    return {
      id: `mock-${index}`,
      mimeType: "image/svg+xml",
      base64: Buffer.from(svg).toString("base64"),
      prompt: request.prompt,
      alt: `Placeholder image for "${request.prompt}"`,
      providerMetadata: { mock: true }
    };
  });
}

function escapeXml(value: string) {
  return value.replace(/["'<&>]/g, (character) => {
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

function buildRequestBody(request: ImagenRequest, kind: EndpointKind) {
  const {
    prompt,
    negativePrompt,
    aspectRatio = "1:1",
    quality = "standard",
    count = 2,
    stylePreset,
    seed,
    referenceImage,
    referenceImages
  } = request;

  const references = (
    referenceImages && referenceImages.length > 0
      ? referenceImages
      : referenceImage
        ? [referenceImage]
        : []
  ).slice(0, MAX_REFERENCE_IMAGES);

  if (kind === "generateContent") {
    const referenceParts = references.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64
      }
    }));

    const promptParts = [
      ...referenceParts,
      { text: prompt },
      ...(stylePreset ? [{ text: `Style hint: ${stylePreset}` }] : []),
      ...(quality !== "standard" ? [{ text: `Preferred quality: ${quality}` }] : []),
      ...(aspectRatio ? [{ text: `Desired aspect ratio: ${aspectRatio}` }] : []),
      ...(negativePrompt ? [{ text: `Avoid: ${negativePrompt}` }] : [])
    ];
    const candidateCount = SUPPORTS_MULTI_CANDIDATE ? Math.min(Math.max(count, 1), 4) : 1;
    const generationConfig: Record<string, unknown> = {
      candidateCount
    };
    if (typeof seed === "number" && Number.isFinite(seed)) {
      generationConfig.seed = seed;
    }

    return {
      contents: [
        {
          role: "user",
          parts: promptParts
        }
      ],
      generationConfig
    };
  }

  return {
    instances: [
      {
        prompt: { text: prompt },
        ...(negativePrompt ? { negativePrompt: { text: negativePrompt } } : {})
      }
    ],
    parameters: {
      sampleCount: Math.min(Math.max(count, 1), 4),
      aspectRatio,
      quality,
      ...(stylePreset ? { style: stylePreset } : {}),
      ...(typeof seed === "number" ? { seed } : {}),
      ...(references.length > 0
        ? {
            referenceImage: {
              mimeType: references[0].mimeType,
              imageBytes: references[0].base64
            }
          }
        : {})
    }
  };
}

function normalizeResponseImages(responseBody: any, request: ImagenRequest, kind: EndpointKind): ImagenImage[] {
  if (!responseBody) {
    return [];
  }

  if (kind === "generateContent") {
    const candidates: any[] = responseBody.candidates ?? [];
    return candidates
      .flatMap((candidate: any, candidateIndex: number) => {
        const parts: any[] = candidate.content?.parts ?? candidate.parts ?? [];
        return parts.map((part: any, partIndex: number) => {
          const inline = part.inlineData ?? part.image ?? {};
          const base64 =
            inline.data ??
            inline.base64 ??
            inline.bytes ??
            inline.imageBytes ??
            null;
          if (typeof base64 !== "string" || base64.length === 0) {
            return null;
          }
          const mimeType = inline.mimeType ?? "image/png";
          return {
            id: candidate.id ?? part.id ?? `gemini-${candidateIndex}-${partIndex}-${randomUUID()}`,
            mimeType,
            base64,
            prompt: request.prompt,
            alt: candidate.prompt ?? candidate.description ?? request.prompt,
            providerMetadata: candidate
          } satisfies ImagenImage;
        });
      })
      .filter((image): image is ImagenImage => Boolean(image));
  }

  const candidates: any[] =
    responseBody.images ??
    responseBody.candidates ??
    responseBody.generatedImages ??
    responseBody.outputs ??
    [];

  return candidates
    .map((candidate: any, index: number) => {
      const inlineData = candidate.image ?? candidate.inlineData ?? candidate.data ?? {};
      const base64 =
        candidate.base64 ??
        inlineData.base64 ??
        inlineData.data ??
        candidate.imageBytes ??
        candidate.bytes ??
        null;
      if (typeof base64 !== "string" || base64.length === 0) {
        return null;
      }

      const mimeType =
        candidate.mimeType ??
        inlineData.mimeType ??
        candidate.mediaType ??
        "image/png";

      const dimensions =
        candidate.dimensions ??
        candidate.size ??
        candidate.imageSize ??
        undefined;

      return {
        id: candidate.id ?? candidate.generatedImageId ?? randomUUID(),
        mimeType,
        base64,
        prompt: request.prompt,
        alt: candidate.prompt ?? candidate.description,
        width: typeof dimensions?.width === "number" ? dimensions.width : undefined,
        height: typeof dimensions?.height === "number" ? dimensions.height : undefined,
        providerMetadata: candidate
      } satisfies ImagenImage;
    })
    .filter((image): image is ImagenImage => Boolean(image));
}

export class ImagenRequestError extends Error {
  public status?: number;
  public details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "ImagenRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function generateImagenImages(
  request: ImagenRequest,
  options?: { watermarkStyle?: WatermarkStyle }
): Promise<ImagenImage[]> {
  if (!hasApiKey) {
    const mock = createMockImages(request);
    return maybeApplyWatermark(mock, options?.watermarkStyle);
  }

  const attempts: Array<{ model: string; endpoint: string; kind: EndpointKind }> = [
    { model: DEFAULT_MODEL, endpoint: DEFAULT_ENDPOINT, kind: ENDPOINT_KIND }
  ];

  if (!attempts.some((attempt) => attempt.model === "gemini-2.5-flash-image")) {
    attempts.push({
      model: "gemini-2.5-flash-image",
      endpoint: resolveEndpoint("gemini-2.5-flash-image", inferEndpointKind("gemini-2.5-flash-image")),
      kind: inferEndpointKind("gemini-2.5-flash-image")
    });
  }

  const errors: ImagenRequestError[] = [];

  for (const attempt of attempts) {
    const images = await tryGenerateWithAttempt(request, attempt).catch((error) => {
      if (error instanceof ImagenRequestError) {
        errors.push(error);
      } else {
        errors.push(new ImagenRequestError("Unexpected error", undefined, error));
      }
      return null;
    });

    if (images && images.length > 0) {
      return maybeApplyWatermark(images, options?.watermarkStyle);
    }
  }

  const finalError =
    errors.find((error) => error.status && error.status !== 404) ??
    errors[0] ??
    new ImagenRequestError("Google Imagen rejected the request. Check model name, endpoint, and quota.");

  throw finalError;
}

async function tryGenerateWithAttempt(
  request: ImagenRequest,
  attempt: { model: string; endpoint: string; kind: EndpointKind }
): Promise<ImagenImage[]> {
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(attempt.endpoint);
  } catch (error) {
    console.error("Failed to construct Imagen endpoint URL, skipping attempt:", attempt.endpoint, error);
    throw new ImagenRequestError("Invalid Imagen endpoint configuration.", undefined, error);
  }
  endpointUrl.searchParams.set("key", apiKey);

  const response = await fetch(endpointUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildRequestBody(request, attempt.kind))
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = errorText;
    }
    console.error(`Imagen API error for model ${attempt.model}`, response.status, parsed);
    throw new ImagenRequestError(
      `Google Imagen rejected the request for model "${attempt.model}".`,
      response.status,
      parsed
    );
  }

  const payload = await response.json();
  const images = normalizeResponseImages(payload, request, attempt.kind);

  if (images.length === 0) {
    throw new ImagenRequestError(`Google Imagen returned no images for model "${attempt.model}".`);
  }

  return images;
}

async function maybeApplyWatermark(images: ImagenImage[], style?: WatermarkStyle | null) {
  if (!style || !style.enabled || images.length === 0) {
    return images;
  }
  return Promise.all(images.map((image) => applyWatermarkToImage(image, style)));
}

async function applyWatermarkToImage(image: ImagenImage, style: WatermarkStyle): Promise<ImagenImage> {
  if (!style.enabled) {
    return image;
  }

  try {
    const baseBuffer = Buffer.from(image.base64, "base64");
    const metadata = await sharp(baseBuffer).metadata();
    const minDimension = Math.max(512, Math.min(metadata.width ?? 1024, metadata.height ?? 1024));
    const fontSize = Math.max(40, Math.round(minDimension * 0.045));
    const overlayBuffer = await generateWatermarkOverlayBuffer(style, { fontSize });

    const composite = sharp(baseBuffer).composite([
      {
        input: overlayBuffer,
        gravity: "southeast"
      }
    ]);

    switch (metadata.format) {
      case "jpeg":
      case "jpg":
        composite.jpeg({ quality: metadata.quality ?? 92 });
        break;
      case "png":
        composite.png();
        break;
      case "webp":
        composite.webp({ quality: 92 });
        break;
      case "avif":
        composite.avif({ quality: 90 });
        break;
      default:
        composite.png();
        break;
    }

    const outputBuffer = await composite.toBuffer();
    const updatedMeta = await sharp(outputBuffer).metadata();

    return {
      ...image,
      base64: outputBuffer.toString("base64"),
      width: updatedMeta.width ?? image.width,
      height: updatedMeta.height ?? image.height
    };
  } catch (error) {
    console.error("Failed to apply watermark to generated image", error);
    return image;
  }
}
