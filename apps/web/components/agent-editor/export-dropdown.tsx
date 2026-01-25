"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { Download, Loader2, Youtube, Instagram, Twitter, Linkedin } from "lucide-react";

interface ExportDropdownProps {
  jobId: string;
}

const PLATFORMS = [
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "tiktok", label: "TikTok", icon: Download },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "twitter", label: "Twitter", icon: Twitter },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin }
] as const;

export function ExportDropdown({ jobId }: ExportDropdownProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportingPlatform, setExportingPlatform] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async (platform: string, quality: string = "high") => {
    setIsExporting(true);
    setExportingPlatform(platform);

    try {
      const response = await fetch(`/api/agent-editor/jobs/${jobId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, quality })
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const data = await response.json();

      toast({
        title: "Export ready",
        description: `Video exported for ${platform}. Downloading...`
      });

      // Trigger download
      const link = document.createElement("a");
      link.href = data.exportPath;
      link.download = `${platform}-export.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed", error);
      toast({
        title: "Export failed",
        description: "Failed to export video for platform",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      setExportingPlatform(null);
    }
  };

  const handleGenerateThumbnails = async () => {
    setIsExporting(true);

    try {
      const response = await fetch(`/api/agent-editor/jobs/${jobId}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 3 })
      });

      if (!response.ok) {
        throw new Error("Thumbnail generation failed");
      }

      const data = await response.json();

      toast({
        title: "Thumbnails generated",
        description: `Generated ${data.thumbnails.length} thumbnails`
      });

      // Open first thumbnail in new tab
      if (data.thumbnails.length > 0) {
        window.open(data.thumbnails[0], "_blank");
      }
    } catch (error) {
      console.error("Thumbnail generation failed", error);
      toast({
        title: "Thumbnail generation failed",
        description: "Failed to generate thumbnails",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg border-violet-300 text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-300"
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-3 w-3 mr-1.5" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export for Platform</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          return (
            <DropdownMenuItem
              key={platform.value}
              onClick={() => handleExport(platform.value)}
              disabled={isExporting}
            >
              <Icon className="h-4 w-4 mr-2" />
              {platform.label}
              {exportingPlatform === platform.value && (
                <Loader2 className="h-3 w-3 ml-auto animate-spin" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleGenerateThumbnails}
          disabled={isExporting}
        >
          <Download className="h-4 w-4 mr-2" />
          Generate Thumbnails
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
