/** @jest-environment node */

const mockLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

const okResponse = (content: string) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );

const errorResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function loadClient() {
  jest.resetModules();
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  process.env.OPENROUTER_ENABLED = 'true';
  process.env.OPENROUTER_MODEL_FALLBACKS_ENABLED = 'true';
  process.env.OPENROUTER_VIDEO_INGEST_MODEL = 'google/gemini-2.5-flash';
  process.env.OPENROUTER_VIDEO_INGEST_FALLBACK_MODELS = 'openai/gpt-4o-mini,qwen/qwen3.6-plus';
  return import('@/lib/openrouter-client');
}

describe('routedChatCompletion OpenRouter fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENROUTER_MODEL_TIMEOUT_MS;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('falls back when the first model returns 500 and the second succeeds', async () => {
    const { routedChatCompletion } = await loadClient();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        errorResponse(500, {
          error: {
            code: 500,
            message: 'Internal Server Error',
            metadata: { provider_name: 'google' },
          },
        })
      )
      .mockResolvedValueOnce(okResponse('{"ok":true}'));

    const content = await routedChatCompletion(null, 'videoIngest', '', [{ role: 'user', content: 'hi' }]);

    expect(content).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({
      model: 'google/gemini-2.5-flash',
      provider: { allow_fallbacks: true },
      stream: false,
    });
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({
      model: 'openai/gpt-4o-mini',
    });
  });

  it('throws a compact upstream error after all fallback models fail', async () => {
    const { routedChatCompletion, OpenRouterUpstreamError, getOpenRouterFailureSummary } = await loadClient();
    (global.fetch as jest.Mock).mockResolvedValue(
      errorResponse(502, {
        error: { code: 502, message: 'Provider unavailable', metadata: { provider_name: 'test-provider' } },
      })
    );

    try {
      await routedChatCompletion(null, 'videoIngest', '', [{ role: 'user', content: 'hi' }]);
      throw new Error('Expected routedChatCompletion to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(OpenRouterUpstreamError);
      const summary = getOpenRouterFailureSummary(error);
      expect(summary).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            model: 'google/gemini-2.5-flash',
            status: 502,
            code: 502,
            message: 'Provider unavailable',
            provider: 'test-provider',
          }),
        ])
      );
    }
  });

  it('falls back when the first model times out and the second succeeds', async () => {
    process.env.OPENROUTER_MODEL_TIMEOUT_MS = '5';
    const { routedChatCompletion } = await loadClient();
    (global.fetch as jest.Mock)
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      })
      .mockResolvedValueOnce(okResponse('{"ok":true}'));

    const content = await routedChatCompletion(null, 'videoIngest', '', [{ role: 'user', content: 'hi' }]);

    expect(content).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back when a model returns empty content', async () => {
    const { routedChatCompletion } = await loadClient();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okResponse('   '))
      .mockResolvedValueOnce(okResponse('{"ok":true}'));

    const content = await routedChatCompletion(null, 'videoIngest', '', [{ role: 'user', content: 'hi' }]);

    expect(content).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('falls back when an OpenRouter response body cannot be parsed', async () => {
    const { routedChatCompletion } = await loadClient();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response('not-json', { status: 500 }))
      .mockResolvedValueOnce(okResponse('{"ok":true}'));

    const content = await routedChatCompletion(null, 'videoIngest', '', [{ role: 'user', content: 'hi' }]);

    expect(content).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
