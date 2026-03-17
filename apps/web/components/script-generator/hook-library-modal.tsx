"use client";

import { useState } from "react";
import { Copy, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HOOK_LIBRARY } from "@/lib/data/hook-library";
import { HookExample } from "@/lib/types/script";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HookLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectHook?: (hook: string) => void;
}

export function HookLibraryModal({ open, onOpenChange, onSelectHook }: HookLibraryModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HookExample['category'] | 'all'>('all');
  const [selectedPerformance, setSelectedPerformance] = useState<'all' | 'high' | 'medium'>('all');
  const { toast } = useToast();

  const filteredHooks = HOOK_LIBRARY.filter((hook) => {
    const matchesSearch = hook.text.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || hook.category === selectedCategory;
    const matchesPerformance = selectedPerformance === 'all' || hook.performance === selectedPerformance;
    return matchesSearch && matchesCategory && matchesPerformance;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Hook copied to clipboard." });
  };

  const handleSelect = (hook: HookExample) => {
    if (onSelectHook) {
      onSelectHook(hook.text);
      onOpenChange(false);
    }
  };

  const categories: Array<{ value: HookExample['category'] | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'curiosity', label: 'Curiosity Gap' },
    { value: 'bold-statement', label: 'Bold Statement' },
    { value: 'question', label: 'Question' },
    { value: 'pattern-interrupt', label: 'Pattern Interrupt' },
    { value: 'statistic', label: 'Statistic' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Hook Library</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Browse {HOOK_LIBRARY.length}+ proven hooks to captivate your audience
          </p>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search hooks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Performance Filter */}
          <div className="flex gap-2">
            <Button
              variant={selectedPerformance === 'all' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPerformance('all')}
            >
              All Performance
            </Button>
            <Button
              variant={selectedPerformance === 'high' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPerformance('high')}
            >
              🔥 High
            </Button>
            <Button
              variant={selectedPerformance === 'medium' ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPerformance('medium')}
            >
              ⭐ Medium
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 space-y-2 overflow-y-auto pr-2">
          <div className="mb-2 text-sm text-muted-foreground">
            Showing {filteredHooks.length} hook{filteredHooks.length !== 1 ? 's' : ''}
          </div>

          {filteredHooks.map((hook) => (
            <Card
              key={hook.id}
              className="group cursor-pointer p-4 transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20"
              onClick={() => handleSelect(hook)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">{hook.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {hook.category.replace('-', ' ')}
                    </Badge>
                    {hook.performance === 'high' && (
                      <Badge className="bg-red-500/10 text-red-600 text-xs">
                        🔥 High Performance
                      </Badge>
                    )}
                    {hook.niche && (
                      <Badge variant="outline" className="text-xs">
                        {hook.niche}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(hook.text);
                  }}
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}

          {filteredHooks.length === 0 && (
            <div className="flex min-h-[200px] items-center justify-center text-center">
              <p className="text-muted-foreground">No hooks match your filters</p>
            </div>
          )}
        </div>

        {/* Tips */}
        <Card className="border-primary/20 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            💡 Tip: Use placeholders like {'{topic}'}, {'{benefit}'}, {'{timeframe}'} and customize them for your video
          </p>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
