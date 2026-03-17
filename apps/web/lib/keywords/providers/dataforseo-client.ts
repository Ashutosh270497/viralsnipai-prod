interface DataForSeoTaskResponse<T> {
  status_code?: number;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    result?: T[];
  }>;
}

export interface DataForSeoContext {
  login: string;
  password: string;
}

function encodeBasicAuth(login: string, password: string): string {
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export async function dataForSeoPost<T>(params: {
  endpoint: string;
  context: DataForSeoContext;
  payload: unknown[];
}): Promise<DataForSeoTaskResponse<T> | null> {
  const { endpoint, context, payload } = params;
  const url = `https://api.dataforseo.com${endpoint}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasicAuth(context.login, context.password)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`DATAFORSEO_HTTP_${response.status}:${text}`);
  }

  const json = (await response.json()) as DataForSeoTaskResponse<T>;
  return json;
}

export function resolveDataForSeoContext(): DataForSeoContext | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return { login, password };
}

export function mapCountryToLocationCode(country: string): number {
  const normalized = country.toUpperCase();
  if (normalized === "IN") return 2356;
  if (normalized === "US") return 2840;
  if (normalized === "GB") return 2826;
  return 2840;
}

export function mapLanguageToCode(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized === "hi") return "hi";
  if (normalized === "en") return "en";
  return "en";
}

