"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Sparkles, BookOpen, TrendingUp, Trash2 } from "lucide-react";
import { ScriptInputForm } from "@/components/script-generator/script-input-form";
import { ScriptEditorEnhanced } from "@/components/script-generator/script-editor-enhanced";
import { HookLibraryModal } from "@/components/script-generator/hook-library-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GeneratedScript } from "@/lib/types/script";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ScriptGeneratorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(true);
  const [showHookLibrary, setShowHookLibrary] = useState(false);
  const [currentScriptId, setCurrentScriptId] = useState<string | null>(null);
  const [scriptToDelete, setScriptToDelete] = useState<string | null>(null);

  // Get params from URL (if coming from content calendar)
  const ideaId = searchParams?.get("ideaId");
  const initialTitle = searchParams?.get("title") || "";
  const initialKeywords = useMemo(
    () =>
      (searchParams?.get("keywords") || "")
        .split(",")
        .map((kw) => kw.trim())
        .filter(Boolean),
    [searchParams]
  );

  // Fetch all scripts
  const { data: scriptsData } = useQuery<{ scripts: GeneratedScript[] }>({
    queryKey: ["scripts"],
    queryFn: async () => {
      const res = await fetch("/api/scripts");
      if (!res.ok) throw new Error("Failed to fetch scripts");
      return res.json();
    },
  });

  // Fetch current script
  const { data: currentScriptData, refetch: refetchCurrentScript } = useQuery<{ script: GeneratedScript }>({
    queryKey: ["script", currentScriptId],
    queryFn: async () => {
      if (!currentScriptId) throw new Error("No script ID");
      const res = await fetch(`/api/scripts/${currentScriptId}`);
      if (!res.ok) throw new Error("Failed to fetch script");
      return res.json();
    },
    enabled: !!currentScriptId,
  });

  // Generate script mutation
  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate script");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      setCurrentScriptId(data.scriptId);
      setShowForm(false);
      toast({
        title: "Script Generated!",
        description: "Your production-ready script is ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Revise script mutation
  const reviseMutation = useMutation({
    mutationFn: async ({ scriptId, revision }: { scriptId: string; revision: string }) => {
      const res = await fetch(`/api/scripts/${scriptId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision }),
      });

      if (!res.ok) throw new Error("Failed to revise script");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["script", currentScriptId] });
      refetchCurrentScript();
      toast({
        title: "Script Revised!",
        description: "Your script has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Revision Failed",
        description: "Failed to revise script. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update script mutation (for editing)
  const updateMutation = useMutation({
    mutationFn: async ({ scriptId, updates }: { scriptId: string; updates: Partial<GeneratedScript> }) => {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Failed to update script");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["script", currentScriptId] });
      refetchCurrentScript();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update script. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Regenerate section mutation
  const regenerateSectionMutation = useMutation({
    mutationFn: async ({ scriptId, section }: { scriptId: string; section: string }) => {
      const res = await fetch(`/api/scripts/${scriptId}/regenerate-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });

      if (!res.ok) throw new Error("Failed to regenerate section");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["script", currentScriptId] });
      refetchCurrentScript();
    },
    onError: () => {
      toast({
        title: "Regeneration Failed",
        description: "Failed to regenerate section. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete script mutation
  const deleteMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // If script not found (404), treat it as success (already deleted)
      if (res.status === 404) {
        return { scriptId, result: { success: true, alreadyDeleted: true } };
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to delete script" }));
        const errorObj = new Error(error.error || "Failed to delete script");
        (errorObj as any).status = res.status;
        throw errorObj;
      }

      return { scriptId, result: await res.json() };
    },
    onMutate: async (scriptId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["scripts"] });

      // Snapshot the previous value
      const previousScripts = queryClient.getQueryData(["scripts"]);

      // Optimistically update to remove the script
      queryClient.setQueryData(["scripts"], (old: any) => {
        if (!old?.scripts) return old;
        return {
          ...old,
          scripts: old.scripts.filter((s: any) => s.id !== scriptId),
        };
      });

      // Return context with previous value
      return { previousScripts };
    },
    onSuccess: ({ scriptId, result }) => {
      // If deleted script was currently selected, clear selection
      if (currentScriptId === scriptId) {
        setCurrentScriptId(null);
        setShowForm(false);
      }

      // Force refetch to ensure data is in sync with database
      queryClient.refetchQueries({ queryKey: ["scripts"] });

      // Clear the script to delete state
      setScriptToDelete(null);

      // Show success toast
      const message = result.alreadyDeleted
        ? "Script was already deleted."
        : "Your script has been deleted successfully.";

      toast({
        title: "Script Deleted",
        description: message,
      });
    },
    onError: (error: any, scriptId, context: any) => {
      // Don't rollback for 404 errors (script already gone)
      if (error.status !== 404 && context?.previousScripts) {
        queryClient.setQueryData(["scripts"], context.previousScripts);
      }

      console.error("Delete error:", error);

      // For 404 errors, just refresh the list silently
      if (error.status === 404) {
        queryClient.refetchQueries({ queryKey: ["scripts"] });
        setScriptToDelete(null);
        return;
      }

      // Show error toast only for non-404 errors
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete script. Please try again.",
        variant: "destructive",
      });
      setScriptToDelete(null);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is correct
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
    },
  });

  const handleGenerate = async (data: any) => {
    await generateMutation.mutateAsync(data);
  };

  const handleRevise = async (revision: string) => {
    if (!currentScriptId) return;
    await reviseMutation.mutateAsync({ scriptId: currentScriptId, revision });
  };

  const handleUpdate = async (updates: Partial<GeneratedScript>) => {
    if (!currentScriptId) return;
    await updateMutation.mutateAsync({ scriptId: currentScriptId, updates });
  };

  const handleRegenerateSection = async (section: string) => {
    if (!currentScriptId) return;
    await regenerateSectionMutation.mutateAsync({ scriptId: currentScriptId, section });
  };

  const handleSelectScript = (scriptId: string) => {
    setCurrentScriptId(scriptId);
    setShowForm(false);
  };

  const handleNewScript = () => {
    setCurrentScriptId(null);
    setShowForm(true);
  };

  const handleGenerateTitle = () => {
    if (!currentScript) return;

    const keywords = currentScript.keywords || [];
    const params = new URLSearchParams({
      scriptId: currentScript.id,
      topic: currentScript.title,
      description: currentScript.title || '',
      keywords: keywords.join(','),
    });
    router.push(`/dashboard/title-generator?${params.toString()}`);
  };

  const handleDeleteScript = (scriptId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking delete
    setScriptToDelete(scriptId);
  };

  const confirmDelete = async () => {
    if (scriptToDelete && !deleteMutation.isPending) {
      await deleteMutation.mutateAsync(scriptToDelete);
    }
  };

  const cancelDelete = () => {
    if (!deleteMutation.isPending) {
      setScriptToDelete(null);
    }
  };

  const currentScript = currentScriptData?.script;
  const scripts = scriptsData?.scripts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Script Generator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered scripts optimized for maximum retention
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHookLibrary(true)}>
            <BookOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Hook Library</span>
            <span className="sm:hidden">Hooks</span>
          </Button>
          {currentScript && !showForm && (
            <Button variant="outline" onClick={handleGenerateTitle}>
              <TrendingUp className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Generate Title</span>
              <span className="sm:hidden">Title</span>
            </Button>
          )}
          {!showForm && (
            <Button onClick={handleNewScript}>
              <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              New Script
            </Button>
          )}
        </div>
      </div>

      {scripts.length === 0 && showForm ? (
        // Empty State with Form
        <div className="mx-auto max-w-4xl">
          <Card className="p-6 md:p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-xl font-semibold">Create Your First Script</h3>
                <p className="text-sm text-muted-foreground">
                  Generate production-ready YouTube scripts with AI. Optimized for 2025-2026 algorithm with proven retention structures.
                </p>
              </div>
            </div>
            <ScriptInputForm
              contentIdeaId={ideaId || undefined}
              initialTitle={initialTitle}
              initialKeywords={initialKeywords}
              onGenerate={handleGenerate}
              isGenerating={generateMutation.isPending}
            />
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left Sidebar - Scripts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Your Scripts</h2>
              {!showForm && (
                <Button variant="ghost" size="sm" onClick={handleNewScript}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {showForm && (
                <Card className="border-2 border-primary bg-primary/5 p-3">
                  <div className="font-semibold text-primary">New Script</div>
                  <div className="text-xs text-muted-foreground">Creating...</div>
                </Card>
              )}

              {scripts.map((script) => (
                <Card
                  key={script.id}
                  className={`group relative cursor-pointer p-4 transition-all hover:border-primary/50 hover:shadow-sm ${
                    currentScriptId === script.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => handleSelectScript(script.id)}
                >
                  <div className="mb-2 font-semibold leading-tight line-clamp-2 pr-8">{script.title}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(script.createdAt), "MMM d, yyyy")}
                    </div>
                    {script.durationEstimate && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.floor(script.durationEstimate / 60)}min
                      </Badge>
                    )}
                  </div>
                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    onClick={(e) => handleDeleteScript(script.id, e)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div>
            {showForm ? (
              <Card className="p-6">
                <ScriptInputForm
                  contentIdeaId={ideaId || undefined}
                  initialTitle={initialTitle}
                  initialKeywords={initialKeywords}
                  onGenerate={handleGenerate}
                  isGenerating={generateMutation.isPending}
                />
              </Card>
            ) : currentScript ? (
              <ScriptEditorEnhanced
                script={currentScript}
                onUpdate={handleUpdate}
                onRevise={handleRevise}
                onRegenerateSection={handleRegenerateSection}
                isRevising={reviseMutation.isPending}
                isRegenerating={regenerateSectionMutation.isPending}
              />
            ) : (
              <Card className="flex min-h-[400px] items-center justify-center p-12 text-center">
                <div>
                  <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Select a script from the sidebar to view and edit
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Hook Library Modal */}
      <HookLibraryModal
        open={showHookLibrary}
        onOpenChange={setShowHookLibrary}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!scriptToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setScriptToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this script? This action cannot be undone and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
