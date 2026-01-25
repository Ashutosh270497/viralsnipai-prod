import OpenAI from "openai";
import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Use AGENT_EDITOR_MODEL if set, otherwise fall back to OPENAI_MODEL
const MODEL = process.env.AGENT_EDITOR_MODEL?.trim() ?? process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";

export interface ScriptAnalysis {
  keyMoments: Array<{
    timestamp: number;
    type: "hook" | "value" | "emotion" | "transition" | "cta";
    description: string;
    importance: number; // 1-10
  }>;
  emotions: Array<{
    startMs: number;
    endMs: number;
    emotion: string;
    intensity: number; // 1-10
  }>;
  pacing: {
    overall: "slow" | "medium" | "fast";
    sections: Array<{
      startMs: number;
      endMs: number;
      pace: "slow" | "medium" | "fast";
    }>;
  };
  recommendations: {
    bRollSuggestions: string[];
    transitionPoints: number[];
    emphasizeWords: string[];
    musicMood: string;
  };
}

export class ScriptAnalyzerAgent extends BaseAgent {
  constructor() {
    super("ScriptAnalyzerAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      // If no transcript, use mock analysis
      if (!context.transcript || context.transcript.trim() === "") {
        logger.info("No transcript available, using mock analysis", {
          jobId: context.jobId
        });

        const analysis = this.getMockAnalysis();

        return {
          success: true,
          data: {
            analysis
          }
        };
      }

      const analysis = await this.analyzeScript(
        context.transcript,
        context.clipStartMs,
        context.clipEndMs,
        context.config
      );

      logger.info("Script analysis completed", {
        jobId: context.jobId,
        keyMomentsCount: analysis.keyMoments.length,
        emotionsCount: analysis.emotions.length
      });

      return {
        success: true,
        data: {
          analysis
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Script analysis failed, using mock analysis", {
        jobId: context.jobId,
        error: message
      });

      // Return mock analysis as fallback instead of failing
      return {
        success: true,
        data: {
          analysis: this.getMockAnalysis()
        }
      };
    }
  }

  private async analyzeScript(
    transcript: string,
    clipStartMs?: number,
    clipEndMs?: number,
    config?: Record<string, any>
  ): Promise<ScriptAnalysis> {
    if (!client) {
      // Return mock analysis for development
      return this.getMockAnalysis();
    }

    const systemPrompt = `You are a video editing AI assistant specializing in content analysis. Analyze the provided transcript and identify key moments, emotional beats, pacing, and provide recommendations for video editing.

Your task:
1. Identify key moments (hooks, value delivery, emotional beats, transitions, CTAs)
2. Map emotional arcs throughout the content
3. Analyze pacing and recommend optimal cutting points
4. Suggest b-roll opportunities and transition points
5. Recommend music mood and words to emphasize

Respond ONLY with valid JSON matching this exact structure:
{
  "keyMoments": [{"timestamp": 0, "type": "hook", "description": "...", "importance": 8}],
  "emotions": [{"startMs": 0, "endMs": 5000, "emotion": "excitement", "intensity": 7}],
  "pacing": {
    "overall": "medium",
    "sections": [{"startMs": 0, "endMs": 10000, "pace": "fast"}]
  },
  "recommendations": {
    "bRollSuggestions": ["..."],
    "transitionPoints": [5000, 15000],
    "emphasizeWords": ["..."],
    "musicMood": "energetic"
  }
}`;

    const userPrompt = `Analyze this video transcript:

${transcript}

${
  clipStartMs !== undefined && clipEndMs !== undefined
    ? `\nClip duration: ${clipStartMs}ms to ${clipEndMs}ms (${
        (clipEndMs - clipStartMs) / 1000
      }s)`
    : ""
}

${
  config?.audience
    ? `\nTarget audience: ${config.audience}`
    : ""
}

${
  config?.tone
    ? `\nDesired tone: ${config.tone}`
    : ""
}

Provide a comprehensive analysis for video editing.`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const analysis = JSON.parse(content) as ScriptAnalysis;

      // Validate and normalize the analysis
      return this.validateAnalysis(analysis, clipStartMs, clipEndMs);
    } catch (error) {
      logger.error("OpenAI script analysis failed", { error });
      throw error;
    }
  }

  private validateAnalysis(
    analysis: ScriptAnalysis,
    clipStartMs?: number,
    clipEndMs?: number
  ): ScriptAnalysis {
    // Ensure all arrays exist
    if (!analysis.keyMoments) analysis.keyMoments = [];
    if (!analysis.emotions) analysis.emotions = [];
    if (!analysis.pacing) {
      analysis.pacing = { overall: "medium", sections: [] };
    }
    if (!analysis.recommendations) {
      analysis.recommendations = {
        bRollSuggestions: [],
        transitionPoints: [],
        emphasizeWords: [],
        musicMood: "neutral"
      };
    }

    // Clamp timestamps to clip duration if provided
    if (clipStartMs !== undefined && clipEndMs !== undefined) {
      const duration = clipEndMs - clipStartMs;

      analysis.keyMoments = analysis.keyMoments.map((moment) => ({
        ...moment,
        timestamp: Math.max(0, Math.min(moment.timestamp, duration))
      }));

      analysis.emotions = analysis.emotions.map((emotion) => ({
        ...emotion,
        startMs: Math.max(0, Math.min(emotion.startMs, duration)),
        endMs: Math.max(0, Math.min(emotion.endMs, duration))
      }));
    }

    return analysis;
  }

  private getMockAnalysis(): ScriptAnalysis {
    return {
      keyMoments: [
        {
          timestamp: 0,
          type: "hook",
          description: "Opening statement grabs attention",
          importance: 9
        },
        {
          timestamp: 5000,
          type: "value",
          description: "Key insight delivered",
          importance: 8
        },
        {
          timestamp: 15000,
          type: "emotion",
          description: "Emotional peak moment",
          importance: 7
        },
        {
          timestamp: 25000,
          type: "cta",
          description: "Call to action",
          importance: 9
        }
      ],
      emotions: [
        {
          startMs: 0,
          endMs: 10000,
          emotion: "excitement",
          intensity: 7
        },
        {
          startMs: 10000,
          endMs: 20000,
          emotion: "curiosity",
          intensity: 8
        },
        {
          startMs: 20000,
          endMs: 30000,
          emotion: "urgency",
          intensity: 9
        }
      ],
      pacing: {
        overall: "fast",
        sections: [
          { startMs: 0, endMs: 10000, pace: "fast" },
          { startMs: 10000, endMs: 20000, pace: "medium" },
          { startMs: 20000, endMs: 30000, pace: "fast" }
        ]
      },
      recommendations: {
        bRollSuggestions: [
          "Product demonstration footage",
          "Data visualization graphics",
          "Customer testimonial clips"
        ],
        transitionPoints: [5000, 15000, 25000],
        emphasizeWords: [
          "transform",
          "breakthrough",
          "instantly",
          "proven"
        ],
        musicMood: "energetic"
      }
    };
  }
}
