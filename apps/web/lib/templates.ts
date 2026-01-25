import { Mic, Presentation, Video, MessageSquare, Sparkles, FileText } from "lucide-react";

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Mic;
  category: "content" | "marketing" | "education";
  settings: {
    model: string;
    target: number;
    tone: string;
    audience: string;
    callToAction?: string;
    brief: string;
    presets: string[];
  };
}

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "podcast",
    name: "Podcast Clips",
    description: "Extract engaging moments from long-form podcast episodes",
    icon: Mic,
    category: "content",
    settings: {
      model: "gemini-2.5-pro",
      target: 6,
      tone: "Conversational and insightful, with authentic energy",
      audience: "Podcast listeners who love deep conversations",
      callToAction: "Subscribe for more episodes",
      brief:
        "Find moments with strong opinions, surprising insights, storytelling peaks, or unexpected reveals. Prioritize authenticity over polish.",
      presets: ["shorts_9x16_1080", "square_1x1_1080"]
    }
  },
  {
    id: "webinar",
    name: "Webinar Highlights",
    description: "Convert educational webinars into shareable teaching moments",
    icon: Presentation,
    category: "education",
    settings: {
      model: "gemini-2.5-pro",
      target: 8,
      tone: "Educational and actionable, clear and professional",
      audience: "Professionals seeking to learn and grow",
      callToAction: "Watch the full webinar",
      brief:
        "Extract key takeaways, actionable tips, case studies, and aha moments. Focus on practical value and step-by-step guidance.",
      presets: ["landscape_16x9_1080", "square_1x1_1080"]
    }
  },
  {
    id: "vlog",
    name: "Vlog Moments",
    description: "Highlight the best moments from lifestyle and daily vlogs",
    icon: Video,
    category: "content",
    settings: {
      model: "gemini-2.5-pro",
      target: 5,
      tone: "Fun, energetic, and relatable",
      audience: "Social media followers who love authentic content",
      callToAction: "Follow for daily vlogs",
      brief:
        "Find funny moments, emotional beats, surprising events, or relatable struggles. Prioritize entertainment and personality.",
      presets: ["shorts_9x16_1080"]
    }
  },
  {
    id: "interview",
    name: "Interview Clips",
    description: "Extract powerful quotes and insights from interviews",
    icon: MessageSquare,
    category: "content",
    settings: {
      model: "gemini-2.5-pro",
      target: 7,
      tone: "Inspiring and thought-provoking",
      audience: "Curious minds seeking wisdom and inspiration",
      callToAction: "Watch the full conversation",
      brief:
        "Find powerful quotes, contrarian takes, personal stories, career advice, or philosophical insights. Emphasize wisdom and depth.",
      presets: ["shorts_9x16_1080", "square_1x1_1080", "landscape_16x9_1080"]
    }
  },
  {
    id: "tutorial",
    name: "Tutorial Steps",
    description: "Break down tutorials into step-by-step teaching clips",
    icon: FileText,
    category: "education",
    settings: {
      model: "gemini-2.5-pro",
      target: 10,
      tone: "Clear, instructional, and easy to follow",
      audience: "Learners who want step-by-step guidance",
      callToAction: "Learn more in the full tutorial",
      brief:
        "Extract complete steps, setup instructions, troubleshooting tips, or before/after results. Each clip should teach one clear concept.",
      presets: ["landscape_16x9_1080", "square_1x1_1080"]
    }
  },
  {
    id: "testimonial",
    name: "Customer Stories",
    description: "Extract powerful testimonials and success stories",
    icon: Sparkles,
    category: "marketing",
    settings: {
      model: "gemini-2.5-pro",
      target: 4,
      tone: "Authentic and compelling",
      audience: "Potential customers evaluating solutions",
      callToAction: "See how it works",
      brief:
        "Find transformation stories, specific results, emotional moments, or clear before/after comparisons. Focus on credibility and impact.",
      presets: ["shorts_9x16_1080", "square_1x1_1080"]
    }
  }
];

export function getTemplateById(id: string): WorkspaceTemplate | undefined {
  return WORKSPACE_TEMPLATES.find((template) => template.id === id);
}

export function getTemplatesByCategory(category: WorkspaceTemplate["category"]): WorkspaceTemplate[] {
  return WORKSPACE_TEMPLATES.filter((template) => template.category === category);
}
