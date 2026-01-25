import OpenAI from "openai";
import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Use AGENT_EDITOR_MODEL if set, otherwise fall back to OPENAI_MODEL
const MODEL = process.env.AGENT_EDITOR_MODEL?.trim() ?? process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";

export interface AudioEnhancement {
  music: {
    genre: string;
    mood: string;
    tempo: "slow" | "medium" | "fast";
    startMs: number;
    endMs: number;
    volumeFade: {
      fadeIn: number;
      fadeOut: number;
    };
    volumeLevel: number; // 0-100, percentage of original volume
    suggestions: string[]; // Suggested track names or search terms
  };
  audioAdjustments: {
    normalizeAudio: boolean;
    noiseReduction: boolean;
    compressorSettings: {
      enabled: boolean;
      threshold: number; // dB
      ratio: number;
    };
    eqSettings: {
      enabled: boolean;
      bassBoost: number; // -12 to +12 dB
      trebleBoost: number; // -12 to +12 dB
    };
  };
  soundEffects: Array<{
    type: "whoosh" | "impact" | "rise" | "drop" | "pop" | "click";
    timestampMs: number;
    volume: number; // 0-100
    description: string;
  }>;
  voiceEnhancement: {
    deEsser: boolean;
    clarity: number; // 1-10
    warmth: number; // 1-10
  };
}

export class AudioEnhancerAgent extends BaseAgent {
  constructor() {
    super("AudioEnhancerAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      // Get script analysis and motion design from previous agents
      const scriptAnalysis = context.previousResults?.["ScriptAnalyzerAgent"];
      const motionDesign = context.previousResults?.["MotionDesignerAgent"];

      const audioEnhancement = await this.generateAudioEnhancement(
        scriptAnalysis?.analysis,
        motionDesign?.motionDesign,
        context.clipStartMs,
        context.clipEndMs,
        context.config
      );

      logger.info("Audio enhancement completed", {
        jobId: context.jobId,
        musicGenre: audioEnhancement.music.genre,
        soundEffectsCount: audioEnhancement.soundEffects.length
      });

      return {
        success: true,
        data: {
          audioEnhancement
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Audio enhancement failed", {
        jobId: context.jobId,
        error: message
      });

      return {
        success: false,
        error: message
      };
    }
  }

  private async generateAudioEnhancement(
    scriptAnalysis: any,
    motionDesign: any,
    clipStartMs?: number,
    clipEndMs?: number,
    config?: Record<string, any>
  ): Promise<AudioEnhancement> {
    if (!client) {
      return this.getMockAudioEnhancement(clipStartMs, clipEndMs);
    }

    const clipDuration = clipEndMs && clipStartMs ? clipEndMs - clipStartMs : 30000;

    const systemPrompt = `You are an audio engineer and music supervisor specializing in social media content. Based on the script analysis and motion design, recommend music, audio adjustments, and sound effects that will enhance the video's impact and professionalism.

Your task:
1. Recommend appropriate music genre and mood
2. Specify audio enhancement settings (normalization, compression, EQ)
3. Suggest sound effects for transitions and key moments
4. Optimize voice clarity and presence

Respond ONLY with valid JSON matching this exact structure:
{
  "music": {
    "genre": "electronic",
    "mood": "energetic",
    "tempo": "fast",
    "startMs": 0,
    "endMs": 30000,
    "volumeFade": {"fadeIn": 1000, "fadeOut": 2000},
    "volumeLevel": 30,
    "suggestions": ["Upbeat Corporate", "Tech Innovation", "Modern Energy"]
  },
  "audioAdjustments": {
    "normalizeAudio": true,
    "noiseReduction": true,
    "compressorSettings": {"enabled": true, "threshold": -18, "ratio": 3},
    "eqSettings": {"enabled": true, "bassBoost": 2, "trebleBoost": 3}
  },
  "soundEffects": [
    {"type": "whoosh", "timestampMs": 5000, "volume": 70, "description": "Transition sweep"}
  ],
  "voiceEnhancement": {
    "deEsser": true,
    "clarity": 7,
    "warmth": 6
  }
}`;

    const userPrompt = `Design audio enhancement for this video:

Clip Duration: ${clipDuration}ms (${(clipDuration / 1000).toFixed(1)}s)

${scriptAnalysis ? `
Mood/Pacing: ${scriptAnalysis.pacing?.overall || "medium"}
Recommended Music Mood: ${scriptAnalysis.recommendations?.musicMood || "neutral"}

Key Moments:
${JSON.stringify(scriptAnalysis.keyMoments?.slice(0, 5) || [], null, 2)}
` : ""}

${motionDesign ? `
Transitions Count: ${motionDesign.transitions?.length || 0}
Animations Count: ${motionDesign.animations?.length || 0}
` : ""}

Create professional audio enhancement that:
- Matches the content's energy and mood
- Adds sound effects for transitions and key moments
- Enhances voice clarity and presence
- Keeps music subtle but impactful (typically 20-30% volume)`;

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

      const audioEnhancement = JSON.parse(content) as AudioEnhancement;

      return this.validateAudioEnhancement(audioEnhancement, clipDuration);
    } catch (error) {
      logger.error("OpenAI audio enhancement failed", { error });
      return this.getMockAudioEnhancement(clipStartMs, clipEndMs);
    }
  }

  private validateAudioEnhancement(
    enhancement: AudioEnhancement,
    maxDuration: number
  ): AudioEnhancement {
    // Ensure all required fields exist
    if (!enhancement.music) {
      enhancement.music = this.getDefaultMusic(maxDuration);
    }
    if (!enhancement.audioAdjustments) {
      enhancement.audioAdjustments = this.getDefaultAdjustments();
    }
    if (!enhancement.soundEffects) {
      enhancement.soundEffects = [];
    }
    if (!enhancement.voiceEnhancement) {
      enhancement.voiceEnhancement = this.getDefaultVoiceEnhancement();
    }

    // Clamp music timing
    enhancement.music.startMs = Math.max(0, Math.min(enhancement.music.startMs, maxDuration));
    enhancement.music.endMs = Math.max(0, Math.min(enhancement.music.endMs, maxDuration));
    enhancement.music.volumeLevel = Math.max(0, Math.min(enhancement.music.volumeLevel, 100));

    // Clamp sound effects
    enhancement.soundEffects = enhancement.soundEffects.map((sfx) => ({
      ...sfx,
      timestampMs: Math.max(0, Math.min(sfx.timestampMs, maxDuration)),
      volume: Math.max(0, Math.min(sfx.volume, 100))
    }));

    return enhancement;
  }

  private getDefaultMusic(duration: number) {
    return {
      genre: "ambient",
      mood: "neutral",
      tempo: "medium" as const,
      startMs: 0,
      endMs: duration,
      volumeFade: {
        fadeIn: 1000,
        fadeOut: 2000
      },
      volumeLevel: 25,
      suggestions: ["Subtle Background", "Corporate Minimal", "Soft Ambience"]
    };
  }

  private getDefaultAdjustments() {
    return {
      normalizeAudio: true,
      noiseReduction: true,
      compressorSettings: {
        enabled: true,
        threshold: -18,
        ratio: 3
      },
      eqSettings: {
        enabled: true,
        bassBoost: 0,
        trebleBoost: 2
      }
    };
  }

  private getDefaultVoiceEnhancement() {
    return {
      deEsser: true,
      clarity: 7,
      warmth: 5
    };
  }

  private getMockAudioEnhancement(
    clipStartMs?: number,
    clipEndMs?: number
  ): AudioEnhancement {
    const duration = clipEndMs && clipStartMs ? clipEndMs - clipStartMs : 30000;

    return {
      music: {
        genre: "electronic",
        mood: "energetic",
        tempo: "fast",
        startMs: 0,
        endMs: duration,
        volumeFade: {
          fadeIn: 1500,
          fadeOut: 2000
        },
        volumeLevel: 28,
        suggestions: [
          "Upbeat Electronic Corporate",
          "Tech Innovation Theme",
          "Modern Energy Beat"
        ]
      },
      audioAdjustments: {
        normalizeAudio: true,
        noiseReduction: true,
        compressorSettings: {
          enabled: true,
          threshold: -16,
          ratio: 4
        },
        eqSettings: {
          enabled: true,
          bassBoost: 2,
          trebleBoost: 4
        }
      },
      soundEffects: [
        {
          type: "whoosh",
          timestampMs: 5000,
          volume: 75,
          description: "Transition sweep at key moment"
        },
        {
          type: "impact",
          timestampMs: 10000,
          volume: 60,
          description: "Emphasis hit for main point"
        },
        {
          type: "rise",
          timestampMs: 25000,
          volume: 70,
          description: "Build-up before CTA"
        }
      ],
      voiceEnhancement: {
        deEsser: true,
        clarity: 8,
        warmth: 6
      }
    };
  }
}
