"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { formatDurationSec } from "@/lib/utils";
import { toast } from "sonner";

interface ScriptAudioPlayerProps {
  audioUrl: string;
  title?: string;
  voice?: string;
  duration?: number;
  section?: string;
  onDownload?: () => void;
}

export function ScriptAudioPlayer({
  audioUrl,
  title = "Script Audio",
  voice,
  duration,
  section,
  onDownload,
}: ScriptAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      // Only update if duration is valid
      if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setTotalDuration(audio.duration);
        setIsLoading(false);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handleCanPlay = () => {
      setIsLoading(false);
      // Try to get duration when audio can play
      if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        setTotalDuration(audio.duration);
      }
    };
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);

    // Try to get duration immediately if available
    if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
      setTotalDuration(audio.duration);
      setIsLoading(false);
    }

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        await audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Error playing audio:", error);
      toast.error("Failed to play audio");
    }
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

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
    } else {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, "_")}_${voice || "audio"}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Audio downloaded!");
      } catch (error) {
        console.error("Error downloading audio:", error);
        toast.error("Failed to download audio");
      }
    }
  };

  return (
    <Card className="p-4 space-y-4 bg-primary/5 border-primary/20">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{title}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {voice && <span>Voice: {voice}</span>}
            {section && (
              <>
                <span>·</span>
                <span className="capitalize">{section.replace("fullScript", "Full Script")}</span>
              </>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Slider
          value={[currentTime]}
          max={Math.max(totalDuration, 1)}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
          disabled={isLoading || !totalDuration}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDurationSec(currentTime)}</span>
          <span>{totalDuration > 0 ? formatDurationSec(totalDuration) : "Loading..."}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleRestart}
          title="Restart"
          disabled={isLoading}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={togglePlay}
          className="flex-1"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : isPlaying ? (
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
