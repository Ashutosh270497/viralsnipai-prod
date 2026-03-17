"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { MessageSquare, Send, Trash2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  section?: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface CommentsPanelProps {
  scriptId: string;
  className?: string;
}

export function CommentsPanel({ scriptId, className }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("general");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
  }, [scriptId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const data = await res.json();
      setComments(data.comments);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newComment,
          section: selectedSection === "general" ? undefined : selectedSection,
        }),
      });

      if (!res.ok) throw new Error("Failed to add comment");

      const data = await res.json();
      setComments([data.comment, ...comments]);
      setNewComment("");

      toast({
        title: "Comment Added",
        description: "Your comment has been posted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved }),
        }
      );

      if (!res.ok) throw new Error("Failed to update comment");

      setComments(
        comments.map((c) =>
          c.id === commentId ? { ...c, resolved } : c
        )
      );

      toast({
        title: resolved ? "Comment Resolved" : "Comment Reopened",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update comment",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/scripts/${scriptId}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) throw new Error("Failed to delete comment");

      setComments(comments.filter((c) => c.id !== commentId));

      toast({
        title: "Comment Deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="font-semibold">Comments</h3>
        <Badge variant="secondary" className="ml-auto">
          {comments.length}
        </Badge>
      </div>

      {/* Add Comment */}
      <div className="mb-4 space-y-2">
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="hook">Hook</SelectItem>
            <SelectItem value="intro">Intro</SelectItem>
            <SelectItem value="main">Main Content</SelectItem>
            <SelectItem value="conclusion">Conclusion</SelectItem>
            <SelectItem value="cta">CTA</SelectItem>
          </SelectContent>
        </Select>

        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
        />

        <Button
          onClick={handleAddComment}
          disabled={submitting || !newComment.trim()}
          size="sm"
          className="w-full"
        >
          {submitting ? (
            "Posting..."
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Post Comment
            </>
          )}
        </Button>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Loading comments...
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No comments yet</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className={cn(
                  "rounded-lg border p-3",
                  comment.resolved && "opacity-60"
                )}
              >
                <div className="mb-2 flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={comment.user.image || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(comment.user.name, comment.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {comment.user.name || comment.user.email}
                      </span>
                      {comment.section && (
                        <Badge variant="outline" className="text-xs">
                          {comment.section}
                        </Badge>
                      )}
                      {comment.resolved && (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-600 border-green-500/20 text-xs"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Resolved
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>

                <p className="mb-2 text-sm whitespace-pre-wrap">{comment.content}</p>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleResolveComment(comment.id, !comment.resolved)
                    }
                  >
                    {comment.resolved ? (
                      <>
                        <X className="mr-1 h-3 w-3" />
                        Reopen
                      </>
                    ) : (
                      <>
                        <Check className="mr-1 h-3 w-3" />
                        Resolve
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
