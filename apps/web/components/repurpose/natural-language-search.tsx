"use client";

import { useState } from "react";
import { Search, Loader2, Sparkles, Lightbulb, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { formatDuration } from "@/lib/utils";

interface SearchMatch {
  clip: {
    id: string;
    title?: string | null;
    summary?: string | null;
    startMs: number;
    endMs: number;
    viralityScore?: number | null;
  };
  relevanceScore: number;
  matchReasons: string[];
}

interface SearchResult {
  analysis: {
    keywords: string[];
    emotions: string[];
    actions: string[];
    intent: string;
    targetDuration?: number;
  };
  results: SearchMatch[];
  totalMatches: number;
  resultCount: number;
}

interface NaturalLanguageSearchProps {
  projectId: string;
  onClipsGenerated?: () => void;
}

export function NaturalLanguageSearch({ projectId, onClipsGenerated }: NaturalLanguageSearchProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  const handleSearch = async (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) {
      toast({
        variant: "destructive",
        title: "Enter a search query",
        description: "Describe what you're looking for in natural language"
      });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);

    try {
      const response = await fetch("/api/repurpose/search-clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: finalQuery,
          includeTranscripts: true,
          limit: 10
        })
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const apiResponse = await response.json();

      if (apiResponse.success && apiResponse.data) {
        setSearchResult(apiResponse.data);

        toast({
          title: "Search complete",
          description: `Found ${apiResponse.data.totalMatches} matching clips`
        });
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        variant: "destructive",
        title: "Search failed",
        description: "Please try again with a different query"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Natural Language Search
          </CardTitle>
          <CardDescription>
            Find specific moments using natural language. Try: &quot;Find emotional moments with specific numbers&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="e.g., Find clips discussing pricing strategy..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSearching) {
                    handleSearch();
                  }
                }}
                disabled={isSearching}
              />
            </div>
            <Button onClick={() => handleSearch()} disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Search Results */}
          {searchResult && (
            <div className="space-y-4 mt-6">
              {/* Query Analysis Summary */}
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <span className="font-medium">Query Analysis</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {searchResult.analysis.keywords.slice(0, 5).map((keyword, idx) => (
                    <Badge key={idx} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                  {searchResult.analysis.emotions.length > 0 && (
                    searchResult.analysis.emotions.slice(0, 3).map((emotion, idx) => (
                      <Badge key={`emotion-${idx}`} variant="outline" className="border-pink-500 text-pink-700">
                        {emotion}
                      </Badge>
                    ))
                  )}
                  {searchResult.analysis.actions.length > 0 && (
                    searchResult.analysis.actions.slice(0, 3).map((action, idx) => (
                      <Badge key={`action-${idx}`} variant="outline" className="border-blue-500 text-blue-700">
                        {action}
                      </Badge>
                    ))
                  )}
                </div>
                {searchResult.analysis.intent && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Intent: {searchResult.analysis.intent}
                  </p>
                )}
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {searchResult.totalMatches} {searchResult.totalMatches === 1 ? 'match' : 'matches'} found
                  </span>
                  {searchResult.results.length > 0 && (
                    <span className="text-muted-foreground">
                      Avg relevance: <span className="font-medium text-foreground">
                        {Math.round(searchResult.results.reduce((sum, r) => sum + r.relevanceScore, 0) / searchResult.results.length)}%
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Matches */}
              <div className="space-y-3">
                {searchResult.results.map((match, idx) => {
                  const durationSec = Math.round((match.clip.endMs - match.clip.startMs) / 1000);
                  return (
                    <Card key={match.clip.id || idx} className="border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={getScoreColor(match.relevanceScore)}>
                                {match.relevanceScore}% match
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDuration(match.clip.startMs)} → {formatDuration(match.clip.endMs)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({durationSec}s)
                              </span>
                              {match.clip.viralityScore && match.clip.viralityScore > 70 && (
                                <Badge variant="outline" className="text-xs border-purple-500 text-purple-700">
                                  🔥 {match.clip.viralityScore}
                                </Badge>
                              )}
                            </div>
                            {match.clip.title && (
                              <h4 className="text-sm font-medium mb-1">{match.clip.title}</h4>
                            )}
                            {match.clip.summary && (
                              <p className="text-sm leading-relaxed text-muted-foreground">{match.clip.summary}</p>
                            )}
                          </div>
                        </div>
                        {match.matchReasons.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {match.matchReasons.map((reason, ridx) => (
                              <div key={ridx} className="flex items-start gap-2">
                                <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                                <p className="text-xs text-muted-foreground italic">{reason}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
