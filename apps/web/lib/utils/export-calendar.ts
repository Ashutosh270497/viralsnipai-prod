import { format } from "date-fns";
import { VideoIdea } from "@/lib/types/content-calendar";

export function exportToCSV(ideas: VideoIdea[], calendarName: string) {
  // CSV Headers
  const headers = [
    "Date",
    "Title",
    "Description",
    "Video Type",
    "Category",
    "Status",
    "Virality Score",
    "Estimated Views",
    "Search Volume",
    "Competition Score",
    "Keywords",
    "Hook Suggestions",
    "Thumbnail Ideas",
    "AI Reasoning",
  ];

  // Convert ideas to CSV rows
  const rows = ideas.map((idea) => [
    format(new Date(idea.scheduledDate), "yyyy-MM-dd"),
    escapeCSV(idea.title),
    escapeCSV(idea.description || ""),
    idea.videoType || "",
    idea.contentCategory || "",
    idea.status,
    idea.viralityScore || "",
    idea.estimatedViews || "",
    idea.searchVolume || "",
    idea.competitionScore || "",
    escapeCSV(idea.keywords?.join(", ") || ""),
    escapeCSV(idea.hookSuggestions?.join(" | ") || ""),
    escapeCSV(idea.thumbnailIdeas?.join(" | ") || ""),
    escapeCSV(idea.reasoning || ""),
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Create download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${sanitizeFilename(calendarName)}_${format(new Date(), "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(value: string): string {
  if (!value) return "";

  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}
