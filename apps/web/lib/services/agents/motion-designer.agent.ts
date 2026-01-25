import OpenAI from "openai";
import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Use AGENT_EDITOR_MODEL if set, otherwise fall back to OPENAI_MODEL
const MODEL = process.env.AGENT_EDITOR_MODEL?.trim() ?? process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";

export interface MotionDesign {
  transitions: Array<{
    timestampMs: number;
    type: "fade" | "slide" | "zoom" | "wipe" | "dissolve";
    duration: number;
    direction?: "left" | "right" | "up" | "down";
    easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  }>;
  textOverlays: Array<{
    text: string;
    startMs: number;
    endMs: number;
    position: "top" | "center" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
    animation: "fade-in" | "slide-in" | "scale" | "bounce";
    fontSize: number;
    fontWeight: "normal" | "bold";
    color: string;
    backgroundColor?: string;
    emphasis: boolean;
  }>;
  animations: Array<{
    startMs: number;
    endMs: number;
    type: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "shake" | "blur";
    intensity: number; // 1-10
  }>;
  graphics: Array<{
    type: "lower-third" | "logo" | "badge" | "callout";
    startMs: number;
    endMs: number;
    content?: string;
    position: string;
  }>;
}

export class MotionDesignerAgent extends BaseAgent {
  constructor() {
    super("MotionDesignerAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      // Get script analysis from previous agent
      const scriptAnalysis = context.previousResults?.["ScriptAnalyzerAgent"];

      if (!scriptAnalysis || !scriptAnalysis.analysis) {
        logger.warn("No script analysis found, using basic motion design", {
          jobId: context.jobId
        });
        return {
          success: true,
          data: {
            motionDesign: this.getBasicMotionDesign(context)
          }
        };
      }

      const motionDesign = await this.generateMotionDesign(
        scriptAnalysis.analysis,
        context.transcript,
        context.clipStartMs,
        context.clipEndMs,
        context.config
      );

      logger.info("Motion design completed", {
        jobId: context.jobId,
        transitionsCount: motionDesign.transitions.length,
        overlaysCount: motionDesign.textOverlays.length,
        animationsCount: motionDesign.animations.length
      });

      return {
        success: true,
        data: {
          motionDesign
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Motion design failed", {
        jobId: context.jobId,
        error: message
      });

      return {
        success: false,
        error: message
      };
    }
  }

  private async generateMotionDesign(
    scriptAnalysis: any,
    transcript: string | undefined,
    clipStartMs?: number,
    clipEndMs?: number,
    config?: Record<string, any>
  ): Promise<MotionDesign> {
    if (!client) {
      return this.getMockMotionDesign();
    }

    const clipDuration = clipEndMs && clipStartMs ? clipEndMs - clipStartMs : 30000;

    const systemPrompt = `You are a motion graphics designer specializing in social media video content. Based on the script analysis and key moments, design transitions, text overlays, and animations that will make the content more engaging and professional.

Your task:
1. Place transitions at key moment boundaries
2. Design text overlays for emphasis words and key phrases
3. Create animations that enhance emotional beats
4. Add graphics like lower-thirds and callouts where appropriate

Respond ONLY with valid JSON matching this exact structure:
{
  "transitions": [{"timestampMs": 0, "type": "fade", "duration": 500, "easing": "ease-in-out"}],
  "textOverlays": [{"text": "...", "startMs": 0, "endMs": 2000, "position": "center", "animation": "fade-in", "fontSize": 48, "fontWeight": "bold", "color": "#FFFFFF", "emphasis": true}],
  "animations": [{"startMs": 0, "endMs": 5000, "type": "zoom-in", "intensity": 3}],
  "graphics": [{"type": "lower-third", "startMs": 0, "endMs": 3000, "content": "Expert Tip", "position": "bottom-left"}]
}`;

    const userPrompt = `Design motion graphics for this video content:

Clip Duration: ${clipDuration}ms (${(clipDuration / 1000).toFixed(1)}s)

Key Moments:
${JSON.stringify(scriptAnalysis.keyMoments, null, 2)}

Emotions:
${JSON.stringify(scriptAnalysis.emotions, null, 2)}

Recommendations:
${JSON.stringify(scriptAnalysis.recommendations, null, 2)}

${transcript ? `Transcript excerpt: ${transcript.substring(0, 500)}...` : ""}

Create engaging motion graphics that:
- Use transitions at natural break points
- Emphasize key phrases with text overlays
- Add animations during emotional peaks
- Keep everything on-brand and professional`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.8,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const motionDesign = JSON.parse(content) as MotionDesign;

      // Validate and clamp timestamps
      return this.validateMotionDesign(motionDesign, clipDuration);
    } catch (error) {
      logger.error("OpenAI motion design failed", { error });
      return this.getMockMotionDesign();
    }
  }

  private validateMotionDesign(
    design: MotionDesign,
    maxDuration: number
  ): MotionDesign {
    // Ensure all arrays exist
    if (!design.transitions) design.transitions = [];
    if (!design.textOverlays) design.textOverlays = [];
    if (!design.animations) design.animations = [];
    if (!design.graphics) design.graphics = [];

    // Clamp all timestamps
    design.transitions = design.transitions.map((t) => ({
      ...t,
      timestampMs: Math.max(0, Math.min(t.timestampMs, maxDuration))
    }));

    design.textOverlays = design.textOverlays.map((o) => ({
      ...o,
      startMs: Math.max(0, Math.min(o.startMs, maxDuration)),
      endMs: Math.max(0, Math.min(o.endMs, maxDuration))
    }));

    design.animations = design.animations.map((a) => ({
      ...a,
      startMs: Math.max(0, Math.min(a.startMs, maxDuration)),
      endMs: Math.max(0, Math.min(a.endMs, maxDuration))
    }));

    design.graphics = design.graphics.map((g) => ({
      ...g,
      startMs: Math.max(0, Math.min(g.startMs, maxDuration)),
      endMs: Math.max(0, Math.min(g.endMs, maxDuration))
    }));

    return design;
  }

  private getBasicMotionDesign(context: AgentContext): MotionDesign {
    const duration = context.clipEndMs && context.clipStartMs
      ? context.clipEndMs - context.clipStartMs
      : 30000;

    return {
      transitions: [
        {
          timestampMs: 0,
          type: "fade",
          duration: 300,
          easing: "ease-in"
        },
        {
          timestampMs: duration - 300,
          type: "fade",
          duration: 300,
          easing: "ease-out"
        }
      ],
      textOverlays: [],
      animations: [],
      graphics: []
    };
  }

  private getMockMotionDesign(): MotionDesign {
    return {
      transitions: [
        {
          timestampMs: 0,
          type: "fade",
          duration: 500,
          easing: "ease-in"
        },
        {
          timestampMs: 10000,
          type: "slide",
          duration: 400,
          direction: "left",
          easing: "ease-in-out"
        },
        {
          timestampMs: 20000,
          type: "zoom",
          duration: 600,
          easing: "ease-out"
        }
      ],
      textOverlays: [
        {
          text: "KEY INSIGHT",
          startMs: 5000,
          endMs: 7000,
          position: "center",
          animation: "scale",
          fontSize: 56,
          fontWeight: "bold",
          color: "#FFFFFF",
          backgroundColor: "rgba(138, 43, 226, 0.9)",
          emphasis: true
        },
        {
          text: "Watch this...",
          startMs: 15000,
          endMs: 18000,
          position: "bottom",
          animation: "slide-in",
          fontSize: 36,
          fontWeight: "normal",
          color: "#FFFFFF",
          emphasis: false
        }
      ],
      animations: [
        {
          startMs: 5000,
          endMs: 7000,
          type: "zoom-in",
          intensity: 5
        },
        {
          startMs: 15000,
          endMs: 20000,
          type: "pan-right",
          intensity: 3
        }
      ],
      graphics: [
        {
          type: "lower-third",
          startMs: 1000,
          endMs: 5000,
          content: "Expert Analysis",
          position: "bottom-left"
        },
        {
          type: "badge",
          startMs: 25000,
          endMs: 30000,
          content: "Subscribe",
          position: "top-right"
        }
      ]
    };
  }
}
