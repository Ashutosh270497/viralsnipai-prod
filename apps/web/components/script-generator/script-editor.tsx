"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Copy, Download, FileText, Loader2, RefreshCw } from "lucide-react";
import { GeneratedScript, ScriptSegmentStructured } from "@/lib/types/script";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ScriptEditorProps {
  script: GeneratedScript;
  onUpdate?: (updates: Partial<GeneratedScript>) => Promise<void>;
  onRevise?: (revision: string) => Promise<void>;
  isRevising?: boolean;
}

type TabType = "hook" | "intro" | "main" | "conclusion" | "cta" | "full";

export function ScriptEditor({ script, onUpdate, onRevise, isRevising }: ScriptEditorProps) {
  const [activeTab, setActiveTab] = useState<TabType>("full");
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const { toast } = useToast();

  const tabs: Array<{ id: TabType; label: string; show: boolean }> = [
    { id: "hook", label: "Hook", show: !!script.hook },
    { id: "intro", label: "Intro", show: !!script.intro },
    { id: "main", label: "Main Content", show: !!script.mainContent },
    { id: "conclusion", label: "Conclusion", show: !!script.conclusion },
    { id: "cta", label: "CTA", show: !!script.cta },
    { id: "full", label: "Full Script", show: true },
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
    }
  };

  const handleCopy = () => {
    const content = getContent(activeTab);
    navigator.clipboard.writeText(content);
    toast({ title: "Copied to clipboard!", description: "Script content copied successfully." });
  };

  const handleExportPDF = () => {
    // Create a printable version
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${script.title} - Script</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
            h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
            .section { margin: 30px 0; }
            .section-title { font-weight: bold; color: #0066cc; margin-bottom: 10px; }
            .timestamp { color: #999; font-size: 12px; }
            .visual-cue { background: #f0f0f0; padding: 5px 10px; margin: 10px 0; font-style: italic; }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <h1>${script.title}</h1>
          <div class="meta">
            Generated: ${format(new Date(script.createdAt), "MMMM d, yyyy 'at' h:mm a")}<br>
            Duration: ${Math.floor((script.durationEstimate || 0) / 60)} min ${(script.durationEstimate || 0) % 60} sec
          </div>
          ${script.hook ? `<div class="section"><div class="section-title">HOOK (0:00-0:15)</div><p>${script.hook.replace(/\n/g, '<br>')}</p></div>` : ''}
          ${script.intro ? `<div class="section"><div class="section-title">INTRO</div><p>${script.intro.replace(/\n/g, '<br>')}</p></div>` : ''}
          ${script.mainContent ? `<div class="section"><div class="section-title">MAIN CONTENT</div><p>${script.mainContent.replace(/\n/g, '<br>')}</p></div>` : ''}
          ${script.conclusion ? `<div class="section"><div class="section-title">CONCLUSION</div><p>${script.conclusion.replace(/\n/g, '<br>')}</p></div>` : ''}
          ${script.cta ? `<div class="section"><div class="section-title">CALL TO ACTION</div><p>${script.cta.replace(/\n/g, '<br>')}</p></div>` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handleRevision = async (type: string) => {
    if (onRevise) {
      await onRevise(type);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Revision Options */}
      <Card className="p-4">
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
      <div className="flex gap-2 overflow-x-auto border-b">
        {tabs.filter(t => t.show).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Script Content */}
      <Card className="p-6">
        <Textarea
          value={getContent(activeTab)}
          readOnly
          rows={20}
          className="font-mono text-sm"
        />

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

      {/* Duration Timeline */}
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
    </div>
  );
}
