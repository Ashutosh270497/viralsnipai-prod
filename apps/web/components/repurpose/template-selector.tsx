"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WORKSPACE_TEMPLATES, WorkspaceTemplate } from "@/lib/templates";
import { cn } from "@/lib/utils";

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WorkspaceTemplate) => void;
}

export function TemplateSelector({ open, onOpenChange, onSelect }: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<WorkspaceTemplate | null>(null);

  function handleSelect() {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      onOpenChange(false);
      setSelectedTemplate(null);
    }
  }

  const categories = {
    content: WORKSPACE_TEMPLATES.filter((t) => t.category === "content"),
    education: WORKSPACE_TEMPLATES.filter((t) => t.category === "education"),
    marketing: WORKSPACE_TEMPLATES.filter((t) => t.category === "marketing")
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose a Template</DialogTitle>
          <DialogDescription>
            Select a pre-configured template optimized for your content type
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Content Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Content Creation</h3>
              <Badge variant="outline">{categories.content.length} templates</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.content.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedTemplate?.id === template.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <template.icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>• Target: {template.settings.target} clips</p>
                      <p>• Audience: {template.settings.audience}</p>
                      <p>• Formats: {template.settings.presets.length} presets</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Education Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Education & Training</h3>
              <Badge variant="outline">{categories.education.length} templates</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.education.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedTemplate?.id === template.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <template.icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>• Target: {template.settings.target} clips</p>
                      <p>• Audience: {template.settings.audience}</p>
                      <p>• Formats: {template.settings.presets.length} presets</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Marketing Templates */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Marketing & Sales</h3>
              <Badge variant="outline">{categories.marketing.length} templates</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {categories.marketing.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50",
                    selectedTemplate?.id === template.id && "border-primary bg-primary/5"
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <template.icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                      </div>
                      {selectedTemplate?.id === template.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardDescription className="text-xs">{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>• Target: {template.settings.target} clips</p>
                      <p>• Audience: {template.settings.audience}</p>
                      <p>• Formats: {template.settings.presets.length} presets</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedTemplate(null);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedTemplate}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
