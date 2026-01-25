import OpenAI from "openai";
import { BaseAgent, AgentContext, AgentResult } from "./base-agent";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const MODEL = process.env.OPENAI_MODEL?.trim() ?? "gpt-4o-mini";

export interface StyleProfile {
  colorGrading: {
    temperature: number; // -100 to +100 (cool to warm)
    tint: number; // -100 to +100 (green to magenta)
    contrast: number; // 0 to 200 (percentage)
    saturation: number; // 0 to 200 (percentage)
    highlights: number; // -100 to +100
    shadows: number; // -100 to +100
    vibrance: number; // 0 to 200
    colorLUT?: string; // LUT file name if using lookup table
  };
  branding: {
    primaryColor: string; // Hex color
    secondaryColor?: string;
    fontFamily: string;
    logoPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    logoOpacity: number; // 0-100
    brandOverlayEnabled: boolean;
  };
  aesthetics: {
    vignette: {
      enabled: boolean;
      intensity: number; // 0-100
    };
    filmGrain: {
      enabled: boolean;
      amount: number; // 0-100
    };
    sharpen: number; // 0-100
    blur: number; // 0-10 (for background blur effects)
  };
  composition: {
    cropRatio?: string; // e.g., "16:9", "9:16", "1:1"
    safeZones: boolean; // Add safe zone overlays
    rulesOfThirds: boolean; // Apply rule of thirds guidelines
  };
}

export class StyleMatcherAgent extends BaseAgent {
  constructor() {
    super("StyleMatcherAgent");
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      // Get brand kit and style profile if configured
      const brandKit = await this.getBrandKit(context.userId);
      const styleProfile = context.config?.styleProfileId
        ? await this.getStyleProfile(context.config.styleProfileId, context.userId)
        : null;

      const style = await this.generateStyleProfile(
        brandKit,
        styleProfile,
        context.config
      );

      logger.info("Style matching completed", {
        jobId: context.jobId,
        hasBrandKit: !!brandKit,
        hasStyleProfile: !!styleProfile
      });

      return {
        success: true,
        data: {
          styleProfile: style
        }
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Style matching failed", {
        jobId: context.jobId,
        error: message
      });

      return {
        success: false,
        error: message
      };
    }
  }

  private async getBrandKit(userId: string) {
    try {
      const brandKit = await prisma.brandKit.findUnique({
        where: { userId }
      });
      return brandKit;
    } catch (error) {
      logger.error("Failed to fetch brand kit", { error });
      return null;
    }
  }

  private async getStyleProfile(profileId: string, userId: string) {
    try {
      const profile = await prisma.agentStyleProfile.findFirst({
        where: {
          id: profileId,
          userId
        }
      });
      return profile;
    } catch (error) {
      logger.error("Failed to fetch style profile", { error });
      return null;
    }
  }

  private async generateStyleProfile(
    brandKit: any,
    styleProfile: any,
    config?: Record<string, any>
  ): Promise<StyleProfile> {
    // If we have a custom style profile with analyzed style config, use it
    if (styleProfile?.styleConfig) {
      return this.applyStyleConfig(styleProfile.styleConfig, brandKit);
    }

    // Otherwise generate default style based on brand kit
    return this.getDefaultStyle(brandKit);
  }

  private applyStyleConfig(
    styleConfig: any,
    brandKit: any
  ): StyleProfile {
    const defaultStyle = this.getDefaultStyle(brandKit);

    // Merge custom style config with defaults
    return {
      colorGrading: {
        ...defaultStyle.colorGrading,
        ...(styleConfig.colorGrading || {})
      },
      branding: {
        ...defaultStyle.branding,
        ...(styleConfig.branding || {})
      },
      aesthetics: {
        ...defaultStyle.aesthetics,
        ...(styleConfig.aesthetics || {})
      },
      composition: {
        ...defaultStyle.composition,
        ...(styleConfig.composition || {})
      }
    };
  }

  private getDefaultStyle(brandKit: any): StyleProfile {
    return {
      colorGrading: {
        temperature: 0,     // Disabled - was causing darkening
        tint: 0,
        contrast: 100,      // Neutral - no change
        saturation: 100,    // Neutral - no change
        highlights: 0,      // Disabled
        shadows: 0,         // Disabled - was causing darkening
        vibrance: 100       // Neutral
      },
      branding: {
        primaryColor: brandKit?.primaryHex || "#8B5CF6", // Default violet
        secondaryColor: undefined,
        fontFamily: brandKit?.fontFamily || "Inter",
        logoPosition: "bottom-right",
        logoOpacity: brandKit?.watermark ? 80 : 0,
        brandOverlayEnabled: !!brandKit
      },
      aesthetics: {
        vignette: {
          enabled: false,  // DISABLED - was darkening edges
          intensity: 0
        },
        filmGrain: {
          enabled: false,
          amount: 0
        },
        sharpen: 0,        // DISABLED for now
        blur: 0
      },
      composition: {
        cropRatio: "9:16",
        safeZones: true,
        rulesOfThirds: false
      }
    };
  }

  /**
   * Future enhancement: Analyze reference videos using GPT-4 Vision
   * This would extract style patterns from provided reference videos
   */
  private async analyzeReferenceVideos(
    referenceVideos: string[]
  ): Promise<Partial<StyleProfile>> {
    if (!client || referenceVideos.length === 0) {
      return {};
    }

    // This would use GPT-4 Vision API to analyze video frames
    // For now, return empty object
    logger.info("Reference video analysis not yet implemented", {
      count: referenceVideos.length
    });

    return {};
  }
}
