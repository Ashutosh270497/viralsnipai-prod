"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Palette, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { StyleProfileDialog } from "@/components/agent-editor/style-profile-dialog";

interface StyleProfile {
  id: string;
  name: string;
  referenceVideos: string[];
  styleConfig: any;
  isDefault: boolean;
  createdAt: string;
}

export default function StyleProfilesPage() {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StyleProfile | null>(null);
  const { toast } = useToast();

  const fetchProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/agent-editor/style-profiles");
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles);
      }
    } catch (error) {
      console.error("Failed to fetch style profiles", error);
      toast({
        title: "Error",
        description: "Failed to load style profiles",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleCreate = () => {
    setEditingProfile(null);
    setDialogOpen(true);
  };

  const handleEdit = (profile: StyleProfile) => {
    setEditingProfile(profile);
    setDialogOpen(true);
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this style profile?")) {
      return;
    }

    try {
      const response = await fetch(`/api/agent-editor/style-profiles/${profileId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Style profile deleted successfully"
        });
        fetchProfiles();
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete style profile",
        variant: "destructive"
      });
    }
  };

  const handleSetDefault = async (profileId: string) => {
    try {
      const response = await fetch(`/api/agent-editor/style-profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Default style profile updated"
        });
        fetchProfiles();
      } else {
        throw new Error("Failed to update");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default style profile",
        variant: "destructive"
      });
    }
  };

  const handleDialogSuccess = () => {
    setDialogOpen(false);
    fetchProfiles();
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
            Style Profiles
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage visual styles, color grading, and branding for your AI-edited clips
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
        </div>
      ) : profiles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No style profiles yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
              Create your first style profile to define consistent visual styles for your AI-edited clips
            </p>
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} className="relative hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      {profile.isDefault && (
                        <Badge
                          variant="outline"
                          className="border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950/30"
                        >
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.referenceVideos.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium text-muted-foreground">Reference Videos:</span>
                      <span className="ml-2 text-foreground">{profile.referenceVideos.length}</span>
                    </div>
                  )}

                  {profile.styleConfig && Object.keys(profile.styleConfig).length > 0 && (
                    <div className="text-xs space-y-1">
                      {profile.styleConfig.colorGrading && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Color Grading:</span>
                          <Badge variant="secondary" className="text-xs">
                            Custom
                          </Badge>
                        </div>
                      )}
                      {profile.styleConfig.aesthetics && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Aesthetics:</span>
                          <Badge variant="secondary" className="text-xs">
                            {profile.styleConfig.aesthetics.vignette?.enabled ? "Vignette" : "Custom"}
                          </Badge>
                        </div>
                      )}
                      {profile.styleConfig.composition?.cropRatio && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Ratio:</span>
                          <Badge variant="secondary" className="text-xs">
                            {profile.styleConfig.composition.cropRatio}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    {!profile.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleSetDefault(profile.id)}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(profile)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(profile.id)}
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StyleProfileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        profile={editingProfile}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
