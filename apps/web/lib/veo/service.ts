import { createSign } from "crypto";
import { readFileSync } from "fs";
import os from "os";
import path from "path";

import type { VeoRequest, VeoVideo } from "./types";

type ServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
  projectId?: string;
};

type VeoConfig = {
  model: string;
  location: string;
  publisher: string;
  projectId: string;
  outputUri?: string;
  apiEndpoint: string;
  defaultParameters: VeoDefaultParameters;
  extraParameters: Record<string, unknown>;
  serviceAccount: ServiceAccountCredentials;
  maxPollAttempts: number;
  pollIntervalMs: number;
  tokenUri: string;
};

type VeoDefaultParameters = {
  sampleCount: number;
  addWatermark: boolean;
  includeRaiReason: boolean;
  generateAudio: boolean;
  personGeneration: string | null;
  resolution: string | null;
};

type VertexOperation = {
  name: string;
  done?: boolean;
  error?: { message?: string };
  response?: Record<string, unknown>;
};

type CachedToken = {
  token: string;
  expiresAt: number;
};

const SERVICE_ACCOUNT_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let tokenCache: CachedToken | null = null;

export class VeoService {
  constructor(private readonly config: VeoConfig) {}

  async generate(request: VeoRequest): Promise<VeoVideo> {
    const payload = this.buildPayload(request);
    const startResponse = await this.startOperation(payload);
    const operationName = typeof startResponse.name === "string" ? startResponse.name : null;
    if (!operationName) {
      throw new Error("Veo response missing operation name.");
    }

    const final = await this.pollOperation(operationName);
    if (!final.response) {
      throw new Error("Veo operation completed without a response payload.");
    }

    const video = this.extractVideo(final.response, request);
    if (!video) {
      throw new Error("Veo response missing generated video asset.");
    }

    return video;
  }

  private async startOperation(payload: Record<string, unknown>): Promise<VertexOperation> {
    const url = this.vertexModelUrl();
    const response = await this.fetchWithAuth(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Veo generation failed (${response.status}) at ${url}: ${errorText.slice(0, 400)}`
      );
    }

    return (await response.json()) as VertexOperation;
  }

  private async pollOperation(operationName: string): Promise<VertexOperation> {
    let attempts = 0;
    let operation = await this.fetchOperation(operationName);

    while (!operation.done && attempts < this.config.maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
      attempts += 1;
      operation = await this.fetchOperation(operationName);
    }

    if (!operation.done) {
      throw new Error("Veo operation timed out before completion.");
    }

    if (operation.error) {
      throw new Error(operation.error.message ?? "Veo generation returned an error.");
    }

    return operation;
  }

  private async fetchOperation(operationName: string): Promise<VertexOperation> {
    const candidates = this.buildOperationUrls(operationName);
    const attempts: string[] = [];

    for (const url of candidates) {
      const response = await this.fetchWithAuth(url);
      if (response.ok) {
        return (await response.json()) as VertexOperation;
      }

      const body = await response.text();
      attempts.push(
        `${response.status} @ ${url} :: ${body.replace(/\s+/g, " ").slice(0, 220)}`
      );

      if (![400, 404].includes(response.status)) {
        break;
      }
    }

    const detail = attempts.length > 0 ? attempts.join(" | ") : "no endpoints attempted";
    throw new Error(`Veo poll failed. Attempts: ${detail}`);
  }

  private vertexModelUrl(): string {
    const modelId = this.config.model.replace(/^models\//, "");
    return `${this.vertexBaseUrl()}projects/${this.config.projectId}/locations/${this.config.location}/publishers/${this.config.publisher}/models/${modelId}:predictLongRunning`;
  }

  private buildOperationUrls(operationName: string): string[] {
    const urls = new Set<string>();
    if (!operationName) {
      return [];
    }

    if (operationName.startsWith("http://") || operationName.startsWith("https://")) {
      urls.add(operationName);
    }

    const normalized = normalizeOperationPath(operationName);
    if (!normalized) {
      return Array.from(urls);
    }

    const hosts = [this.vertexBaseUrl(), this.vertexGlobalBaseUrl()];
    for (const variant of buildOperationPathVariants(normalized)) {
      for (const host of hosts) {
        urls.add(`${host}${variant}`);
      }
    }

    return Array.from(urls);
  }

  private vertexBaseUrl(): string {
    return `https://${this.config.apiEndpoint}/v1/`;
  }

  private vertexGlobalBaseUrl(): string {
    return "https://aiplatform.googleapis.com/v1/";
  }

  private buildPayload(request: VeoRequest): Record<string, unknown> {
    const parameters: Record<string, unknown> = {
      ...this.config.extraParameters,
      sampleCount: this.resolveSampleCount(request.sampleCount),
      addWatermark: request.addWatermark ?? this.config.defaultParameters.addWatermark,
      includeRaiReason: request.includeRaiReason ?? this.config.defaultParameters.includeRaiReason,
      generateAudio: request.generateAudio ?? this.config.defaultParameters.generateAudio
    };

    if (this.config.outputUri) {
      parameters.outputStorageUri = this.config.outputUri;
    }

    const resolution = request.resolution ?? this.config.defaultParameters.resolution;
    if (resolution) {
      parameters.resolution = resolution;
    }

    const personGeneration =
      request.personGeneration ?? this.config.defaultParameters.personGeneration;
    if (personGeneration) {
      parameters.personGeneration = personGeneration;
    }

    if (request.aspectRatio) {
      parameters.aspectRatio = request.aspectRatio;
    }
    if (request.durationSeconds) {
      parameters.durationSeconds = String(clamp(request.durationSeconds, 4, 60));
    }
    if (request.stylePreset) {
      parameters.stylePreset = request.stylePreset;
    }
    if (request.negativePrompt) {
      parameters.negativePrompt = request.negativePrompt;
    }

    return {
      instances: [
        {
          prompt: request.prompt.trim()
        }
      ],
      parameters
    };
  }

  private resolveSampleCount(sampleCount?: number): number {
    if (typeof sampleCount === "number" && Number.isFinite(sampleCount)) {
      return clamp(Math.floor(sampleCount), 1, 8);
    }
    return clamp(this.config.defaultParameters.sampleCount, 1, 8);
  }

  private extractVideo(
    response: Record<string, unknown>,
    request: VeoRequest
  ): VeoVideo | null {
    const generated =
      response.generatedVideos?.[0] ??
      response.videos?.[0] ??
      response.video ??
      response.predictions?.[0] ??
      response.result ??
      null;

    if (!generated || typeof generated !== "object") {
      return null;
    }

    const videoUri =
      getString(generated, "videoStorageUri") ??
      getString(generated, "videoUri") ??
      getString(generated, "video") ??
      getString(generated, "outputUri") ??
      getString(generated, "uri") ??
      getString(generated, "url");

    if (!videoUri) {
      return null;
    }

    const thumbnailUri =
      getString(generated, "thumbnailStorageUri") ??
      getString(generated, "thumbnailUri") ??
      getString(generated, "thumbnail") ??
      getString(generated, "previewUri") ??
      `https://images.placeholders.dev/?width=640&height=360&text=${encodeURIComponent(
        request.prompt.slice(0, 80) || "veo"
      )}`;

    return {
      id: getString(generated, "id") ?? getString(generated, "name") ?? generateId(),
      prompt: request.prompt,
      videoUrl: videoUri,
      thumbnailUrl: thumbnailUri,
      providerMetadata: generated as Record<string, unknown>
    };
  }

  private async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache && tokenCache.expiresAt - 60 > now) {
      return tokenCache.token;
    }

    const assertion = createJwtAssertion(this.config.serviceAccount, this.config.tokenUri);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    });

    const response = await fetch(this.config.tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Failed to obtain Veo access token (${response.status}). ${text.slice(0, 400)}`
      );
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error("Service account token response missing access_token");
    }

    const expiresAt = now + Math.min(Math.max(data.expires_in ?? 3600, 60), 3600);
    tokenCache = { token: data.access_token, expiresAt };
    return data.access_token;
  }
}

function normalizeOperationPath(operationName: string): string {
  if (!operationName) {
    return "";
  }

  return operationName
    .replace(/^https?:\/\/[^/]+\/v1\//, "")
    .replace(/^\//, "");
}

function buildOperationPathVariants(operationPath: string): string[] {
  const variants = new Set<string>();
  if (!operationPath) {
    return [];
  }

  variants.add(operationPath);

  const match =
    operationPath.match(
      /^(projects\/[^/]+\/locations\/[^/]+)(\/publishers\/[^/]+)?(\/models\/[^/]+)?\/operations\/([^/?#]+)$/
    ) ?? null;

  if (!match) {
    return Array.from(variants);
  }

  const [, projectLocation, publisherSegment = "", modelSegment = "", operationId] = match;

  if (publisherSegment && modelSegment) {
    variants.add(
      `${projectLocation}${publisherSegment}/operations/${operationId}`
    );
  }

  variants.add(`${projectLocation}/operations/${operationId}`);
  variants.add(`operations/${operationId}`);

  return Array.from(variants);
}

export function createVeoService(config: VeoConfig = loadConfig()): VeoService {
  return new VeoService(config);
}

export function loadConfig(): VeoConfig {
  const rawModel = process.env.GOOGLE_VEO_MODEL?.trim() || "veo-3.1-generate-preview";
  const location = process.env.GOOGLE_VEO_LOCATION?.trim() || "us-central1";
  let publisher = process.env.GOOGLE_VEO_PUBLISHER?.trim() || "google";
  let model = rawModel;

  const publisherMatch = rawModel.match(/^publishers\/([^/]+)\/models\/(.+)$/);
  if (publisherMatch) {
    publisher = publisherMatch[1];
    model = publisherMatch[2];
  } else if (rawModel.startsWith("models/")) {
    model = rawModel.replace(/^models\//, "");
  }

  const outputUri = process.env.GOOGLE_VEO_OUTPUT_URI?.trim();

  const serviceAccount = loadServiceAccountCredentials();
  const projectId = process.env.GOOGLE_VEO_PROJECT_ID?.trim() ?? serviceAccount.projectId;
  if (!projectId) {
    throw new Error(
      "Unable to determine project id. Set GOOGLE_VEO_PROJECT_ID or ensure the service account JSON includes project_id."
    );
  }

  const apiEndpoint =
    process.env.GOOGLE_VEO_API_ENDPOINT?.trim() ??
    process.env.API_ENDPOINT?.trim() ??
    `${location}-aiplatform.googleapis.com`;

  const defaultParameters: VeoDefaultParameters = {
    sampleCount: parseIntegerEnv("GOOGLE_VEO_SAMPLE_COUNT", 4, 1, 8),
    addWatermark: parseBooleanEnv("GOOGLE_VEO_ADD_WATERMARK", true),
    includeRaiReason: parseBooleanEnv("GOOGLE_VEO_INCLUDE_RAI_REASON", true),
    generateAudio: parseBooleanEnv("GOOGLE_VEO_GENERATE_AUDIO", true),
    personGeneration: readOptionalStringEnv("GOOGLE_VEO_PERSON_GENERATION") ?? "allow_all",
    resolution: readOptionalStringEnv("GOOGLE_VEO_RESOLUTION") ?? "720p"
  };

  const maxPollAttempts = Number.parseInt(process.env.GOOGLE_VEO_MAX_POLLS ?? "30", 10);
  const pollIntervalMs = Number.parseInt(process.env.GOOGLE_VEO_POLL_INTERVAL_MS ?? "5000", 10);
  const extraParameters = parseExtraParameters();

  return {
    model,
    location,
    publisher,
    projectId,
    outputUri,
    apiEndpoint,
    defaultParameters,
    serviceAccount,
    maxPollAttempts,
    pollIntervalMs,
    tokenUri: serviceAccount.tokenUri ?? "https://oauth2.googleapis.com/token",
    extraParameters
  };
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (typeof raw === "string") {
    const value = raw.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(value)) {
      return true;
    }
    if (["false", "0", "no", "n", "off"].includes(value)) {
      return false;
    }
  }
  return fallback;
}

function parseIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      return clamp(parsed, min, max);
    }
  }
  return clamp(fallback, min, max);
}

function readOptionalStringEnv(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function loadServiceAccountCredentials(): ServiceAccountCredentials {
  const inline = process.env.GOOGLE_VEO_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    return parseServiceAccount(inline);
  }

  const filePath = process.env.GOOGLE_VEO_SERVICE_ACCOUNT_KEY_PATH?.trim();
  if (filePath) {
    const resolved = resolveKeyPath(filePath);
    const raw = readFileSync(resolved, "utf8");
    return parseServiceAccount(raw);
  }

  throw new Error(
    "Set GOOGLE_VEO_SERVICE_ACCOUNT_JSON or GOOGLE_VEO_SERVICE_ACCOUNT_KEY_PATH so we can authenticate to Vertex AI."
  );
}

function parseServiceAccount(payload: string): ServiceAccountCredentials {
  const json = decodeMaybeBase64(payload);
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`Failed to parse service account JSON: ${String(error)}`);
  }

  if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    throw new Error("Service account JSON must include client_email and private_key.");
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
    tokenUri: typeof parsed.token_uri === "string" ? parsed.token_uri : "https://oauth2.googleapis.com/token",
    projectId: typeof parsed.project_id === "string" ? parsed.project_id : undefined
  };
}

function parseExtraParameters(): Record<string, unknown> {
  const raw = process.env.GOOGLE_VEO_PARAMETERS;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("[Veo] Failed to parse GOOGLE_VEO_PARAMETERS JSON", error);
  }
  return {};
}

function parseAdditionalParameters(): Record<string, unknown> {
  const raw = process.env.GOOGLE_VEO_PARAMETERS;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("[Veo] Failed to parse GOOGLE_VEO_PARAMETERS JSON", error);
  }
  return {};
}

function createJwtAssertion(credentials: ServiceAccountCredentials, tokenUri: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: SERVICE_ACCOUNT_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${payload}`;
  const signature = base64UrlEncode(sign(unsigned, credentials.privateKey));
  return `${unsigned}.${signature}`;
}

function sign(unsigned: string, privateKey: string): Buffer {
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return signer.sign(privateKey);
}

function resolveKeyPath(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.resolve(os.homedir(), filePath.slice(1));
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function decodeMaybeBase64(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    return trimmed;
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getString(source: any, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function generateId(): string {
  return `veo_${Math.random().toString(36).slice(2, 10)}`;
}
