"use client";

import { Video } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useVeoGenerator } from "./use-veo-generator";
import { VeoForm } from "./veo-form";
import { VeoVideoGallery } from "./video-gallery";

export function VeoWorkspace() {
  const generator = useVeoGenerator();

  return (
    <div className="space-y-10 pb-16">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-green-500/90 via-emerald-500/90 to-teal-500/90 p-4 shadow-sm">
            <Video className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Veo Studio</h1>
            <p className="text-sm font-medium text-muted-foreground/80">Powered by Google Veo 3.1</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="veo-heading" className="grid gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle id="veo-heading" className="tracking-tight">Describe your scene</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              Script cinematic stories with Google&apos;s Veo 3.1 model. Perfect for concept reels and animated moodboards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VeoForm
              form={generator.form}
              onSubmit={generator.handleSubmit}
              onReset={generator.resetForm}
              onChange={generator.updateForm}
              isGenerating={generator.isGenerating}
              progress={generator.progress}
              error={generator.error}
              canGenerate={generator.canGenerate}
            />
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="tracking-tight">Generated videos</CardTitle>
            <CardDescription className="text-muted-foreground/80">
              Save or download Veo clips. Videos are ephemeral in dev—re-render for fresh takes or change the prompt anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VeoVideoGallery videos={generator.videos} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
