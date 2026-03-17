# Script Text-to-Speech Feature - Complete Implementation Plan

## 🎯 Feature Goal
Enable content creators to instantly convert their generated scripts into professional, natural-sounding audio that they can:
- Listen to while reviewing
- Use for practice/rehearsal
- Export for voiceover workflows
- Share for collaboration feedback

---

## 🎉 Good News: Foundation Already Exists!

Your codebase already has **significant TTS infrastructure**:

✅ **OpenAI TTS API Integration** ([apps/web/app/api/transcribe/speech/route.ts](apps/web/app/api/transcribe/speech/route.ts))
- Models: gpt-4o-mini-tts, tts-1, tts-1-hd
- 12+ voices: alloy, verse, blossom, ballad, coral, ash, echo, fable, onyx, nova, sage, shimmer
- Automatic chunking for long text (3500-12000 char limits)
- Multiple format support: mp3, wav, ogg, flac
- Smart fallback between models

✅ **ElevenLabs Voice Cloning** ([apps/web/app/api/voicer/](apps/web/app/api/voicer/))
- Custom voice creation from samples
- High-quality synthesis
- Voice profile storage

✅ **Audio Storage Infrastructure**
- Cloud storage via `saveBuffer()` function
- Duration detection via FFmpeg
- Public URL generation

✅ **Database Schema**
- `VoiceProfile` and `VoiceRender` tables exist
- Usage logging framework in place

**What This Means:** We can implement TTS in ~3-4 hours instead of 1-2 weeks!

---

## 📋 Implementation Plan

### Phase 1: Database Schema Extension (15 minutes)

**Add to `GeneratedScript` model:**

```prisma
model GeneratedScript {
  // ... existing fields ...

  // New TTS fields
  audioUrl            String?   // Public URL to synthesized audio
  audioStoragePath    String?   // Internal storage reference
  audioDurationSec    Int?      // Duration in seconds
  audioVoice          String?   // Voice used (e.g., "alloy", "shimmer")
  audioModel          String?   // TTS model used (e.g., "tts-1-hd")
  audioFormat         String?   // Format (mp3, wav, etc.)
  audioGeneratedAt    DateTime? // When audio was generated
  audioFileSize       Int?      // Size in bytes
}
```

**Alternative (More Flexible):** Create separate `ScriptAudio` model for multiple audio versions:

```prisma
model ScriptAudio {
  id                String   @id @default(cuid())
  scriptId          String
  script            GeneratedScript @relation(fields: [scriptId], references: [id], onDelete: Cascade)

  voiceId           String?   // "alloy", "shimmer", or custom voice ID
  voiceModel        String    // "tts-1", "tts-1-hd", "elevenlabs"
  audioUrl          String    // Public URL
  audioStoragePath  String    // Storage key
  durationSec       Int       // Duration
  format            String    // mp3, wav, etc.
  fileSize          Int       // Bytes
  section           String?   // "fullScript", "hook", "intro", etc.

  createdAt         DateTime  @default(now())

  @@index([scriptId])
  @@index([createdAt])
}
```

**Recommendation:** Use the separate `ScriptAudio` model - it's more flexible for future features like:
- Multiple voice versions (compare voices)
- Section-specific audio (just the hook, just the intro)
- Audio history (regenerate with different settings)

---

### Phase 2: API Route Creation (30 minutes)

**Create: `apps/web/app/api/scripts/[scriptId]/synthesize/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const synthesizeSchema = z.object({
  voiceId: z.string().default("alloy"),
  model: z.enum(["tts-1", "tts-1-hd"]).default("tts-1"),
  format: z.enum(["mp3", "wav", "ogg"]).default("mp3"),
  section: z.enum(["fullScript", "hook", "intro", "mainContent", "conclusion", "cta"]).default("fullScript"),
  speed: z.number().min(0.25).max(4.0).default(1.0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { scriptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get script
    const script = await prisma.generatedScript.findUnique({
      where: { id: params.scriptId, userId: session.user.id },
    });

    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const body = await req.json();
    const { voiceId, model, format, section, speed } = synthesizeSchema.parse(body);

    // Get text based on section
    let textToSynthesize = "";
    switch (section) {
      case "hook":
        textToSynthesize = script.hook || "";
        break;
      case "intro":
        textToSynthesize = script.intro || "";
        break;
      case "mainContent":
        textToSynthesize = script.mainContent || "";
        break;
      case "conclusion":
        textToSynthesize = script.conclusion || "";
        break;
      case "cta":
        textToSynthesize = script.cta || "";
        break;
      default:
        textToSynthesize = script.fullScript || "";
    }

    if (!textToSynthesize) {
      return NextResponse.json(
        { error: "No text available for selected section" },
        { status: 400 }
      );
    }

    // Call existing TTS endpoint
    const ttsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/transcribe/speech`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSynthesize,
          voice: voiceId,
          model: model,
          format: format,
          speed: speed,
        }),
      }
    );

    if (!ttsResponse.ok) {
      throw new Error("TTS generation failed");
    }

    const ttsData = await ttsResponse.json();

    // Save audio metadata
    const scriptAudio = await prisma.scriptAudio.create({
      data: {
        scriptId: params.scriptId,
        voiceId: voiceId,
        voiceModel: model,
        audioUrl: ttsData.audioUrl,
        audioStoragePath: ttsData.fileKey,
        durationSec: Math.round(ttsData.size / 4000), // Approximate
        format: format,
        fileSize: ttsData.size,
        section: section,
      },
    });

    // Log usage
    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        feature: "script-tts",
        credits: 1,
        metadata: {
          scriptId: params.scriptId,
          audioId: scriptAudio.id,
          voice: voiceId,
          model: model,
          section: section,
        },
      },
    });

    return NextResponse.json({
      success: true,
      audio: {
        id: scriptAudio.id,
        url: scriptAudio.audioUrl,
        duration: scriptAudio.durationSec,
        voice: scriptAudio.voiceId,
        model: scriptAudio.voiceModel,
        section: scriptAudio.section,
      },
    });
  } catch (error: any) {
    console.error("[Script TTS]", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate audio" },
      { status: 500 }
    );
  }
}

// GET: Retrieve existing audio for script
export async function GET(
  req: NextRequest,
  { params }: { params: { scriptId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const script = await prisma.generatedScript.findUnique({
      where: { id: params.scriptId, userId: session.user.id },
    });

    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const audioFiles = await prisma.scriptAudio.findMany({
      where: { scriptId: params.scriptId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ audioFiles });
  } catch (error: any) {
    console.error("[Script TTS GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch audio files" },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: UI Components (1 hour)

**3.1 Create Voice Selector Component**

**File: `apps/web/components/script-generator/voice-selector.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Volume2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const VOICES = [
  { id: "alloy", name: "Alloy", description: "Neutral and balanced" },
  { id: "echo", name: "Echo", description: "Male, warm" },
  { id: "fable", name: "Fable", description: "Male, expressive" },
  { id: "onyx", name: "Onyx", name: "Male, deep" },
  { id: "nova", name: "Nova", description: "Female, friendly" },
  { id: "shimmer", name: "Shimmer", description: "Female, energetic" },
  { id: "coral", name: "Coral", description: "Female, warm" },
  { id: "sage", name: "Sage", description: "Male, calm" },
  { id: "verse", name: "Verse", description: "Female, conversational" },
  { id: "ballad", name: "Ballad", description: "Male, storytelling" },
  { id: "blossom", name: "Blossom", description: "Female, soft" },
  { id: "ash", name: "Ash", description: "Male, professional" },
];

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onPreview?: (voice: string) => void;
  isPreviewPlaying?: boolean;
}

export function VoiceSelector({
  selectedVoice,
  onVoiceChange,
  onPreview,
  isPreviewPlaying,
}: VoiceSelectorProps) {
  const selectedVoiceData = VOICES.find((v) => v.id === selectedVoice);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-primary" />
        <Label className="text-sm font-medium">Voice Selection</Label>
      </div>

      <Select value={selectedVoice} onValueChange={onVoiceChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VOICES.map((voice) => (
            <SelectItem key={voice.id} value={voice.id}>
              <div className="flex flex-col">
                <span className="font-medium">{voice.name}</span>
                <span className="text-xs text-muted-foreground">
                  {voice.description}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedVoiceData && (
        <p className="text-xs text-muted-foreground">
          {selectedVoiceData.description}
        </p>
      )}

      {onPreview && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPreview(selectedVoice)}
          disabled={isPreviewPlaying}
          className="w-full"
        >
          {isPreviewPlaying ? (
            <>
              <Pause className="mr-2 h-3 w-3" />
              Playing Preview...
            </>
          ) : (
            <>
              <Play className="mr-2 h-3 w-3" />
              Preview Voice
            </>
          )}
        </Button>
      )}
    </Card>
  );
}
```

**3.2 Create Audio Player Component**

**File: `apps/web/components/script-generator/script-audio-player.tsx`**

```typescript
"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/utils";

interface ScriptAudioPlayerProps {
  audioUrl: string;
  title?: string;
  voice?: string;
  duration?: number;
  onDownload?: () => void;
}

export function ScriptAudioPlayer({
  audioUrl,
  title = "Script Audio",
  voice,
  duration,
  onDownload,
}: ScriptAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setTotalDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <Card className="p-4 space-y-4 bg-primary/5 border-primary/20">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{title}</h4>
          {voice && (
            <p className="text-xs text-muted-foreground">Voice: {voice}</p>
          )}
        </div>
        {onDownload && (
          <Button variant="ghost" size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Slider
          value={[currentTime]}
          max={totalDuration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleRestart}
          title="Restart"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={togglePlay}
          className="flex-1"
        >
          {isPlaying ? (
            <>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Play
            </>
          )}
        </Button>

        <div className="flex items-center gap-2 min-w-[120px]">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-full"
          />
        </div>
      </div>
    </Card>
  );
}
```

**3.3 Integrate into ScriptEditorEnhanced**

**Update: `apps/web/components/script-generator/script-editor-enhanced.tsx`**

Add new "Audio" tab and TTS controls:

```typescript
// Add to imports
import { VoiceSelector } from "./voice-selector";
import { ScriptAudioPlayer } from "./script-audio-player";
import { Headphones, Sparkles } from "lucide-react";

// Add state
const [selectedVoice, setSelectedVoice] = useState("alloy");
const [scriptAudio, setScriptAudio] = useState<any>(null);
const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
const [audioSection, setAudioSection] = useState<string>("fullScript");

// Add tab
const tabs = [
  // ... existing tabs
  { id: "audio", label: "Audio", icon: Headphones },
];

// Add generate audio function
const handleGenerateAudio = async () => {
  setIsGeneratingAudio(true);
  try {
    const response = await fetch(`/api/scripts/${script.id}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId: selectedVoice,
        model: "tts-1-hd",
        format: "mp3",
        section: audioSection,
      }),
    });

    if (!response.ok) throw new Error("Audio generation failed");

    const data = await response.json();
    setScriptAudio(data.audio);
    toast.success("Audio generated successfully!");
  } catch (error) {
    toast.error("Failed to generate audio");
    console.error(error);
  } finally {
    setIsGeneratingAudio(false);
  }
};

// Add in render (inside tabs)
{activeTab === "audio" && (
  <div className="space-y-4">
    <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/20">
      <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
      <div>
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
          Convert Your Script to Audio
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Listen to your script in a natural voice to check pacing, flow, and retention.
          Perfect for practice or sharing with collaborators.
        </p>
      </div>
    </div>

    {/* Section Selector */}
    <div className="space-y-2">
      <Label>Select Section to Synthesize</Label>
      <Select value={audioSection} onValueChange={setAudioSection}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fullScript">Full Script</SelectItem>
          <SelectItem value="hook">Hook Only</SelectItem>
          <SelectItem value="intro">Intro Only</SelectItem>
          <SelectItem value="mainContent">Main Content Only</SelectItem>
          <SelectItem value="conclusion">Conclusion Only</SelectItem>
          <SelectItem value="cta">CTA Only</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Voice Selector */}
    <VoiceSelector
      selectedVoice={selectedVoice}
      onVoiceChange={setSelectedVoice}
    />

    {/* Generate Button */}
    <Button
      onClick={handleGenerateAudio}
      disabled={isGeneratingAudio}
      className="w-full"
      size="lg"
    >
      {isGeneratingAudio ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Generating Audio...
        </>
      ) : (
        <>
          <Headphones className="mr-2 h-5 w-5" />
          Generate Audio
        </>
      )}
    </Button>

    {/* Audio Player */}
    {scriptAudio && (
      <ScriptAudioPlayer
        audioUrl={scriptAudio.url}
        title={`${script.title} - ${audioSection}`}
        voice={scriptAudio.voice}
        duration={scriptAudio.duration}
        onDownload={() => window.open(scriptAudio.url, "_blank")}
      />
    )}

    {/* Info */}
    <div className="text-xs text-muted-foreground space-y-1">
      <p>• Audio generation uses AI text-to-speech technology</p>
      <p>• High-quality voices optimized for content creation</p>
      <p>• Download and use in your video editing workflow</p>
    </div>
  </div>
)}
```

---

### Phase 4: Usage Tracking & Limits (15 minutes)

**Update Usage Limits:**

In script generation route, add TTS to tracked features:

```typescript
// apps/web/app/api/scripts/[scriptId]/synthesize/route.ts
await prisma.usageLog.create({
  data: {
    userId: session.user.id,
    feature: "script-tts",
    credits: 1,
    metadata: {
      scriptId: params.scriptId,
      audioId: scriptAudio.id,
      voice: voiceId,
      model: model,
      section: section,
      characterCount: textToSynthesize.length,
    },
  },
});
```

**Add TTS Limits to Subscription Tiers:**

```typescript
// apps/web/lib/subscription-limits.ts (or wherever limits are defined)
export const SUBSCRIPTION_LIMITS = {
  free: {
    scripts: 0,
    tts: 0,
    // ...
  },
  starter: {
    scripts: 30,
    tts: 10, // 10 audio generations per month
    // ...
  },
  creator: {
    scripts: -1, // unlimited
    tts: -1, // unlimited
    // ...
  },
};
```

---

### Phase 5: Export & Download Features (20 minutes)

**Add Download Handler:**

```typescript
// In ScriptAudioPlayer or ScriptEditorEnhanced

const handleDownloadAudio = async () => {
  try {
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title.replace(/[^a-z0-9]/gi, "_")}_${voice}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success("Audio downloaded!");
  } catch (error) {
    toast.error("Failed to download audio");
  }
};
```

**Add Export Options:**

Update export dropdown to include audio:

```typescript
// In ScriptEditorEnhanced export menu
<DropdownMenuItem onClick={handleExportWithAudio}>
  <Download className="mr-2 h-4 w-4" />
  Export Script + Audio (ZIP)
</DropdownMenuItem>
```

---

## 🎨 User Experience Flow

### Typical User Journey:

1. **User generates a script** → Script displayed in editor
2. **User clicks "Audio" tab** → Sees voice selector and TTS options
3. **User selects voice** → Can preview voice with sample text
4. **User clicks "Generate Audio"** → Loading state (~10-30 seconds)
5. **Audio player appears** → User can play, pause, seek, adjust volume
6. **User listens and reviews** → Identifies pacing issues, awkward phrasing
7. **User revises script** → Uses "More Engaging" or custom revisions
8. **User regenerates audio** → Compares versions
9. **User downloads audio** → Uses in video editing workflow

---

## 💰 Cost Estimation

### OpenAI TTS Pricing (as of 2024-2025):

- **tts-1 (Standard):** $15 per 1M characters
- **tts-1-hd (HD):** $30 per 1M characters

### Average Script Size:
- 5-minute video: ~750 words = ~4,500 characters
- 10-minute video: ~1,500 words = ~9,000 characters
- 30-minute video: ~4,500 words = ~27,000 characters

### Cost Per Script Audio:
- 5min script with tts-1: $0.0675 (~$0.07)
- 10min script with tts-1: $0.135 (~$0.14)
- 5min script with tts-1-hd: $0.135 (~$0.14)
- 10min script with tts-1-hd: $0.27 (~$0.27)

### Monthly Cost Projections:

**Scenario: 100 active users**
- Free tier: 0 TTS (no access)
- Starter tier (10 TTS/month): 50 users × 10 × $0.14 = **$70/month**
- Creator tier (unlimited): 30 users × 30 avg × $0.14 = **$126/month**
- **Total: ~$196/month** for TTS feature

**Scenario: 1,000 active users**
- Starter: 500 × 10 × $0.14 = $700
- Creator: 300 × 50 × $0.14 = $2,100
- **Total: ~$2,800/month**

**Cost Optimization Strategies:**
1. Cache audio files (don't regenerate if script unchanged)
2. Use tts-1 as default, offer tts-1-hd as premium
3. Offer lower quality voices for free tier previews
4. Implement daily/weekly limits to prevent abuse

---

## 🚀 Advanced Features (Phase 2 - Future)

### 1. Voice Cloning Integration (Already have infrastructure!)

Allow users to clone their own voice using ElevenLabs:

- Upload 1-3 audio samples (30 seconds each)
- Create custom voice profile
- Use their own voice for script TTS
- Store in `VoiceProfile` table

**Implementation:** Use existing `/api/voicer/voices` route

### 2. Multi-Language Support

Extend TTS to support:
- Spanish, French, German, Italian, Portuguese
- Japanese, Korean, Chinese
- Hindi, Arabic

**OpenAI TTS supports 50+ languages natively!**

### 3. Synchronized Subtitles

Generate word-level timestamps for:
- Auto-captioning in video editor
- Karaoke-style script display
- Precise audio-to-text synchronization

### 4. Emotion & Emphasis Control

Allow users to add SSML-like tags:
```
This is <emphasis>really important</emphasis>!
<pause time="1s"/>
<speed rate="0.8">Slow down here</speed>
```

### 5. Background Music Mixing

Combine TTS with royalty-free background music:
- Ducking (lower music when speaking)
- Fade in/out
- Music library integration

### 6. Script Reading Progress

Highlight script text as audio plays:
- Karaoke-style highlighting
- Auto-scroll to current word
- Click to jump to specific part

### 7. A/B Testing

Compare multiple voice versions:
- Generate audio with 2-3 different voices
- Side-by-side player
- Vote on preferred version

---

## ✅ Implementation Checklist

### Database (15 min)
- [ ] Add `ScriptAudio` model to schema.prisma
- [ ] Run `prisma migrate dev --name add-script-audio`
- [ ] Verify migration successful

### API Routes (30 min)
- [ ] Create `/api/scripts/[scriptId]/synthesize/route.ts`
- [ ] Add POST handler for audio generation
- [ ] Add GET handler for fetching existing audio
- [ ] Test API with Postman/curl
- [ ] Add error handling and validation

### UI Components (1 hour)
- [ ] Create `VoiceSelector` component
- [ ] Create `ScriptAudioPlayer` component
- [ ] Add "Audio" tab to ScriptEditorEnhanced
- [ ] Add voice selection UI
- [ ] Add section selector (fullScript, hook, intro, etc.)
- [ ] Add generate audio button with loading state
- [ ] Test audio playback in browser
- [ ] Add download functionality

### Usage Tracking (15 min)
- [ ] Add TTS usage logging in synthesize route
- [ ] Update subscription limits config
- [ ] Add usage check before generation
- [ ] Display remaining credits in UI

### Testing (30 min)
- [ ] Test with short script (hook only)
- [ ] Test with full 10-minute script
- [ ] Test all voice options
- [ ] Test with different user tiers (Free, Starter, Creator)
- [ ] Test error handling (no API key, rate limits, etc.)
- [ ] Test download functionality
- [ ] Test audio player on mobile browsers

### Documentation (15 min)
- [ ] Update README with TTS feature
- [ ] Document voice options and characteristics
- [ ] Add troubleshooting guide
- [ ] Update user guide with TTS workflow

---

## 📊 Success Metrics

### User Engagement:
- % of scripts with generated audio
- Average audio generations per user
- Audio playback completion rate
- Download rate

### Quality Metrics:
- User satisfaction ratings
- Audio regeneration rate (indication of issues)
- Support tickets related to audio

### Business Metrics:
- Conversion from free to paid (audio feature as hook)
- Upgrade from starter to creator for unlimited TTS
- Churn rate before/after TTS feature

---

## 🎯 Key Benefits for Users

1. **Practice & Rehearsal:** Listen to script before recording
2. **Pacing Review:** Identify sections that are too fast/slow
3. **Quality Control:** Catch awkward phrasing when heard aloud
4. **Accessibility:** Review scripts while multitasking
5. **Collaboration:** Share audio version for feedback
6. **Voiceover Workflow:** Use as placeholder audio in editing
7. **Time Savings:** No need to record rough drafts

---

## 🔧 Technical Considerations

### Performance:
- TTS generation: 10-30 seconds for typical script
- Show progress indicator during generation
- Cache audio files to avoid regeneration

### Storage:
- Average MP3 size: ~1MB per minute of audio
- 10-minute script = ~10MB storage
- Use cloud storage with CDN for fast delivery
- Consider retention policy (delete after 30 days?)

### Browser Compatibility:
- Audio player works in all modern browsers
- MP3 format universally supported
- Fallback to WAV if needed

### Error Handling:
- OpenAI rate limits (50 requests/min)
- API key validation
- Text length limits (chunk long scripts)
- Network failures during generation

---

## 🚦 Implementation Timeline

**Total Estimated Time: 3-4 hours**

1. ✅ **Planning & Research** (Already done!)
2. **Database Schema** (15 min)
3. **API Route** (30 min)
4. **UI Components** (1 hour)
5. **Integration** (30 min)
6. **Usage Tracking** (15 min)
7. **Testing** (30 min)
8. **Documentation** (15 min)

**Ready to ship same day!**

---

## 📝 Files to Create/Modify

### New Files (3):
1. `apps/web/components/script-generator/voice-selector.tsx`
2. `apps/web/components/script-generator/script-audio-player.tsx`
3. `apps/web/app/api/scripts/[scriptId]/synthesize/route.ts`

### Modified Files (3):
1. `apps/web/prisma/schema.prisma` (add ScriptAudio model)
2. `apps/web/components/script-generator/script-editor-enhanced.tsx` (add Audio tab)
3. `apps/web/lib/utils.ts` (add formatDuration helper if not exists)

---

## 🎉 Summary

You're in an **excellent position** to implement TTS quickly because:

✅ TTS infrastructure already exists
✅ Storage and duration detection working
✅ Voice options already integrated
✅ Usage tracking framework in place
✅ Script database schema comprehensive

**This is a high-value, low-effort feature** that will significantly improve the script generator experience.

Let's build it! 🚀
