import { assertSameOriginRequest } from "@/lib/security/origin";

describe("assertSameOriginRequest", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousResponse = globalThis.Response;

  beforeAll(() => {
    globalThis.Response = class MockResponse {
      status: number;

      constructor(_body?: BodyInit | null, init?: ResponseInit) {
        this.status = init?.status ?? 200;
      }

      static json(body?: unknown, init?: ResponseInit) {
        return new MockResponse(JSON.stringify(body), init);
      }
    } as unknown as typeof Response;
  });

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: previousNodeEnv, configurable: true });
    process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
  });

  afterAll(() => {
    globalThis.Response = previousResponse;
  });

  it("rejects unknown production origins for mutating requests", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    process.env.NEXT_PUBLIC_APP_URL = "https://app.viralsnipai.com";

    const response = assertSameOriginRequest({
      method: "POST",
      headers: new Headers({ Origin: "https://evil.example" }),
    } as Request);

    expect(response?.status).toBe(403);
  });

  it("allows configured production origin", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    process.env.NEXT_PUBLIC_APP_URL = "https://app.viralsnipai.com";

    const response = assertSameOriginRequest({
      method: "POST",
      headers: new Headers({ Origin: "https://app.viralsnipai.com" }),
    } as Request);

    expect(response).toBeNull();
  });
});
