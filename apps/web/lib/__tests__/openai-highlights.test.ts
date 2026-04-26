/** @jest-environment node */

import "openai/shims/node";

import { parseOpenRouterHighlightsContent } from "@/lib/openai";

describe("parseOpenRouterHighlightsContent", () => {
  it("parses valid highlight JSON", () => {
    const result = parseOpenRouterHighlightsContent(
      JSON.stringify({
        highlights: [
          {
            title: "Agent workflow shift",
            hook: "AI agents are moving directly into the tools your team already uses.",
            start_percent: 4,
            end_percent: 8,
            call_to_action: "Try this workflow today",
          },
        ],
      })
    );

    expect(result).toEqual({
      repaired: false,
      highlights: [
        {
          title: "Agent workflow shift",
          hook: "AI agents are moving directly into the tools your team already uses.",
          startPercent: 4,
          endPercent: 8,
          callToAction: "Try this workflow today",
        },
      ],
    });
  });

  it("recovers complete objects from truncated highlight JSON", () => {
    const result = parseOpenRouterHighlightsContent(`{
      "highlights": [
        {
          "title": "ChatGPT killed chatbots",
          "hook": "ChatGPT put useful agents directly inside your workplace.",
          "start_percent": 0,
          "end_percent": 6,
          "call_to_action": "Build an agent today"
        }`);

    expect(result.repaired).toBe(true);
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0]).toMatchObject({
      title: "ChatGPT killed chatbots",
      startPercent: 0,
      endPercent: 6,
    });
  });

  it("throws when no usable highlight can be parsed", () => {
    expect(() => parseOpenRouterHighlightsContent("not json")).toThrow(
      "OpenRouter highlight response did not contain a JSON object"
    );
  });
});
