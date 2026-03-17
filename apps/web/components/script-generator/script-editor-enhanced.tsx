"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Copy, Download, FileText, Loader2, RefreshCw, FileType, Tv, Edit, Save, X, BarChart, History, Share2, MessageSquare, Headphones, Sparkles } from "lucide-react";
import { GeneratedScript, ScriptSegmentStructured } from "@/lib/types/script";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { KeywordDensityChecker } from "./keyword-density-checker";
import { RetentionAnalysis } from "./retention-analysis";
import { RichTextEditor } from "./rich-text-editor";
import { VersionHistoryDialog } from "./version-history-dialog";
import { ShareScriptDialog } from "./share-script-dialog";
import { CommentsPanel } from "./comments-panel";
import { VoiceSelector } from "./voice-selector";
import { ScriptAudioPlayer } from "./script-audio-player";
import { exportAsText, exportAsTeleprompter, exportAsPDF, exportToGoogleDocs } from "@/lib/utils/export-script";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScriptEditorEnhancedProps {
  script: GeneratedScript;
  onUpdate?: (updates: Partial<GeneratedScript>) => Promise<void>;
  onRevise?: (revision: string) => Promise<void>;
  onRegenerateSection?: (section: string, context?: string) => Promise<void>;
  isRevising?: boolean;
  isRegenerating?: boolean;
}

type TabType = "hook" | "intro" | "main" | "conclusion" | "cta" | "full" | "analysis" | "comments" | "audio";

export function ScriptEditorEnhanced({
  script,
  onUpdate,
  onRevise,
  onRegenerateSection,
  isRevising,
  isRegenerating
}: ScriptEditorEnhancedProps) {
  const [activeTab, setActiveTab] = useState<TabType>("full");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [useRichText, setUseRichText] = useState(false);

  // Audio TTS state
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [audioSection, setAudioSection] = useState<string>("fullScript");
  const [scriptAudio, setScriptAudio] = useState<any>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const { toast } = useToast();

  const tabs: Array<{ id: TabType; label: string; show: boolean }> = [
    { id: "hook", label: "Hook", show: !!script.hook },
    { id: "intro", label: "Intro", show: !!script.intro },
    { id: "main", label: "Main Content", show: !!script.mainContent },
    { id: "conclusion", label: "Conclusion", show: !!script.conclusion },
    { id: "cta", label: "CTA", show: !!script.cta },
    { id: "full", label: "Full Script", show: true },
    { id: "audio", label: "Audio", show: true },
    { id: "analysis", label: "Analysis", show: true },
    { id: "comments", label: "Comments", show: true },
  ];

  const getContent = (tab: TabType): string => {
    switch (tab) {
      case "hook":
        return script.hook || "";
      case "intro":
        return script.intro || "";
      case "main":
        try {
          const mainContent = JSON.parse(script.mainContent || "[]") as ScriptSegmentStructured[];
          return mainContent.map(seg => `[${seg.timestamp}] ${seg.segment}\n${seg.content}\n${seg.visualCue || ""}`).join("\n\n");
        } catch {
          return script.mainContent || "";
        }
      case "conclusion":
        return script.conclusion || "";
      case "cta":
        return script.cta || "";
      case "full":
        return script.fullScript || "";
      case "analysis":
        return "";
      case "comments":
        return "";
      case "audio":
        return "";
    }
  };

  const handleCopy = () => {
    const content = getContent(activeTab);
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!", description: "Script content copied successfully." });
  };

  const handleStartEdit = () => {
    setEditedContent(getContent(activeTab));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!onUpdate) return;

    const updates: any = {};

    if (activeTab === "hook") updates.hook = editedContent;
    else if (activeTab === "intro") updates.intro = editedContent;
    else if (activeTab === "main") updates.mainContent = editedContent;
    else if (activeTab === "conclusion") updates.conclusion = editedContent;
    else if (activeTab === "cta") updates.cta = editedContent;
    else if (activeTab === "full") updates.fullScript = editedContent;

    await onUpdate(updates);
    setIsEditing(false);
    toast({ title: "Saved!", description: "Script updated successfully." });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent("");
  };

  const handleRevision = async (type: string) => {
    if (onRevise) {
      await onRevise(type);
    }
  };

  const handleRegenerateSection = async () => {
    if (!onRegenerateSection || activeTab === "full" || activeTab === "analysis") return;

    const sectionMap: Record<string, string> = {
      hook: "hook",
      intro: "intro",
      main: "mainContent",
      conclusion: "conclusion",
      cta: "cta",
    };

    await onRegenerateSection(sectionMap[activeTab]);
    toast({ title: "Regenerated!", description: `${tabs.find(t => t.id === activeTab)?.label} has been regenerated.` });
  };

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Audio generation failed");
      }

      const data = await response.json();
      setScriptAudio(data.audio);
      toast({
        title: "Audio Generated!",
        description: "Your script audio is ready to play.",
      });
    } catch (error: any) {
      console.error("Error generating audio:", error);
      toast({
        title: "Audio Generation Failed",
        description: error.message || "Failed to generate audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fullScriptText = script.fullScript || [
    script.hook,
    script.intro,
    script.mainContent,
    script.conclusion,
    script.cta
  ].filter(Boolean).join('\n\n');

  const keywords = Array.isArray(script.keywords) ? script.keywords : [];

  return (
    <div className="space-y-4">
      {/* Header with Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{script.title}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Duration: {formatDuration(script.durationEstimate || 0)}</span>
            <span>•</span>
            <span>Created {format(new Date(script.createdAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportAsPDF(script)}>
                <FileText className="mr-2 h-4 w-4" />
                PDF / Print
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAsText(script)}>
                <FileType className="mr-2 h-4 w-4" />
                Plain Text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAsTeleprompter(script)}>
                <Tv className="mr-2 h-4 w-4" />
                Teleprompter View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToGoogleDocs(script)}>
                <FileText className="mr-2 h-4 w-4" />
                Google Docs
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVersionHistory(true)}
          >
            <History className="mr-2 h-4 w-4" />
            History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>

          <Button
            variant={showAnalysis ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAnalysis(!showAnalysis)}
          >
            <BarChart className="mr-2 h-4 w-4" />
            Analysis
          </Button>
        </div>
      </div>

      {/* Revision Options */}
      <Card className="border border-border dark:border-white/[0.07] bg-gradient-to-br from-muted/40 dark:from-white/[0.02] to-transparent p-4">
        <div className="mb-3 text-sm font-semibold">Quick Revisions:</div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevision("more-engaging")}
            disabled={isRevising}
          >
            {isRevising ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            More Engaging
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevision("shorten")}
            disabled={isRevising}
          >
            Shorten
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevision("add-examples")}
            disabled={isRevising}
          >
            Add Examples
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevision("simplify")}
            disabled={isRevising}
          >
            Simplify
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-border dark:border-white/[0.07]">
        {tabs.filter(t => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {activeTab === "analysis" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <KeywordDensityChecker script={fullScriptText} keywords={keywords} />
          <RetentionAnalysis
            script={fullScriptText}
            hook={script.hook}
            durationEstimate={script.durationEstimate || 0}
          />
        </div>
      ) : activeTab === "comments" ? (
        <CommentsPanel scriptId={script.id} />
      ) : activeTab === "audio" ? (
        <div className="space-y-4">
          <Card className="p-4 border-blue-200 bg-blue-50/50 dark:border-blue-900/20 dark:bg-blue-950/20">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
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
          </Card>

          {/* Section Selector */}
          <div className="space-y-2">
            <Label htmlFor="audio-section">Select Section to Synthesize</Label>
            <Select value={audioSection} onValueChange={setAudioSection}>
              <SelectTrigger id="audio-section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fullScript">Full Script</SelectItem>
                {script.hook && <SelectItem value="hook">Hook Only</SelectItem>}
                {script.intro && <SelectItem value="intro">Intro Only</SelectItem>}
                {script.mainContent && <SelectItem value="mainContent">Main Content Only</SelectItem>}
                {script.conclusion && <SelectItem value="conclusion">Conclusion Only</SelectItem>}
                {script.cta && <SelectItem value="cta">CTA Only</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Voice Selector */}
          <VoiceSelector
            selectedVoice={selectedVoice}
            onVoiceChange={setSelectedVoice}
            disabled={isGeneratingAudio}
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
              title={script.title}
              voice={scriptAudio.voice}
              duration={scriptAudio.duration}
              section={scriptAudio.section}
            />
          )}

          {/* Info */}
          <Card className="p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Audio generation uses AI text-to-speech technology</p>
              <p>• 9 professional voices optimized for content creation</p>
              <p>• Download and use in your video editing workflow</p>
              <p>• Visual cues are automatically removed for natural speech</p>
            </div>
          </Card>
        </div>
      ) : (
        <Card className="border border-border dark:border-white/[0.07] p-6">
          {/* Section Actions */}
          {activeTab !== "full" && (
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold capitalize">{activeTab} Section</h3>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateSection}
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Regenerate
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleStartEdit}>
                      <Edit className="mr-2 h-3 w-3" />
                      Edit
                    </Button>
                  </>
                )}
                {isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUseRichText(!useRichText)}
                  >
                    {useRichText ? "Plain Text" : "Rich Text"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Script Content */}
          {isEditing ? (
            <div className="space-y-4">
              {useRichText ? (
                <RichTextEditor
                  content={editedContent}
                  onChange={setEditedContent}
                  placeholder="Edit your script..."
                />
              ) : (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                />
              )}
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Textarea
              value={getContent(activeTab)}
              readOnly
              rows={20}
              className="font-mono text-sm"
            />
          )}

          {/* Retention Tips */}
          {script.retentionTips && script.retentionTips.length > 0 && activeTab === "full" && (
            <div className="mt-6">
              <Separator className="mb-4" />
              <h3 className="mb-3 text-sm font-semibold">💡 Retention Tips:</h3>
              <ul className="space-y-2">
                {(Array.isArray(script.retentionTips) ? script.retentionTips : JSON.parse(script.retentionTips as any)).map((tip: string, index: number) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    • {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Duration Timeline */}
      {activeTab !== "analysis" && activeTab !== "audio" && activeTab !== "comments" && (
        <Card className="p-4">
          <div className="mb-2 text-sm font-semibold">Timeline Preview:</div>
          <div className="relative h-2 w-full rounded-full bg-secondary">
            {script.hook && <div className="absolute left-0 h-full w-[8%] rounded-l-full bg-red-500" title="Hook" />}
            {script.intro && <div className="absolute left-[8%] h-full w-[12%] bg-yellow-500" title="Intro" />}
            <div className="absolute left-[20%] h-full w-[60%] bg-primary" title="Main Content" />
            {script.conclusion && <div className="absolute right-[8%] h-full w-[12%] bg-green-500" title="Conclusion" />}
            {script.cta && <div className="absolute right-0 h-full w-[8%] rounded-r-full bg-blue-500" title="CTA" />}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0:00</span>
            <span>{formatDuration(script.durationEstimate || 0)}</span>
          </div>
        </Card>
      )}

      {/* Analysis Panel (when toggled) */}
      {showAnalysis && activeTab !== "analysis" && activeTab !== "comments" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <KeywordDensityChecker script={fullScriptText} keywords={keywords} />
          <RetentionAnalysis
            script={fullScriptText}
            hook={script.hook}
            durationEstimate={script.durationEstimate || 0}
          />
        </div>
      )}

      {/* Version History Dialog */}
      <VersionHistoryDialog
        scriptId={script.id}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        onVersionRestored={() => {
          // Refresh the script
          window.location.reload();
        }}
      />

      {/* Share Dialog */}
      <ShareScriptDialog
        scriptId={script.id}
        scriptTitle={script.title}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
      />
    </div>
  );
}
