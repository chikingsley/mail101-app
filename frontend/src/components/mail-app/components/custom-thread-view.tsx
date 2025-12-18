import { useSession } from "@clerk/clerk-react";
import {
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  StickyNote,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ThreadItem, useMailStore } from "../use-mail";
import { EmailBody } from "./email-body";
import type { EmailActions } from "./mail";

const BACKEND_URL =
  process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface CustomThreadViewProps {
  emailActions: EmailActions;
}

export function CustomThreadView({ emailActions }: CustomThreadViewProps) {
  const { session } = useSession();
  const { selectedThread, setSelectedThread } = useMailStore();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!selectedThread) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No thread selected</p>
      </div>
    );
  }

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const refreshThread = async () => {
    if (!(session && selectedThread)) return;

    try {
      const token = await session.getToken();
      const response = await fetch(
        `${BACKEND_URL}/api/threads/${selectedThread.id}?includeRemoved=${showRemoved}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setSelectedThread(data.thread);
      }
    } catch (error) {
      console.error("Failed to refresh thread:", error);
    }
  };

  const handleUpdateTitle = async () => {
    if (!(session && selectedThread && titleInput.trim())) return;
    setLoading(true);

    try {
      const token = await session.getToken();
      await fetch(`${BACKEND_URL}/api/threads/${selectedThread.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: titleInput.trim() }),
      });

      await refreshThread();
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!session) return;

    try {
      const token = await session.getToken();
      await fetch(`${BACKEND_URL}/api/threads/items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshThread();
    } catch (error) {
      console.error("Failed to remove item:", error);
    }
  };

  const handleRestoreItem = async (itemId: string) => {
    if (!session) return;

    try {
      const token = await session.getToken();
      await fetch(`${BACKEND_URL}/api/threads/items/${itemId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      await refreshThread();
    } catch (error) {
      console.error("Failed to restore item:", error);
    }
  };

  const handleAddComment = async () => {
    if (!(session && selectedThread && newComment.trim())) return;
    setAddingComment(true);

    try {
      const token = await session.getToken();
      await fetch(`${BACKEND_URL}/api/threads/${selectedThread.id}/comment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      setNewComment("");
      await refreshThread();
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setAddingComment(false);
    }
  };

  const handleAddNote = async () => {
    if (!(session && selectedThread && newComment.trim())) return;
    setAddingComment(true);

    try {
      const token = await session.getToken();
      await fetch(`${BACKEND_URL}/api/threads/${selectedThread.id}/note`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      setNewComment("");
      await refreshThread();
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setAddingComment(false);
    }
  };

  // Filter items based on showRemoved
  const visibleItems = showRemoved
    ? selectedThread.items
    : selectedThread.items.filter((item) => !item.removed_at);

  // Get unique participants from emails
  const participants = new Set<string>();
  for (const item of selectedThread.items) {
    if (item.item_type === "email" && item.from_email) {
      participants.add(item.from_email);
    }
  }

  const emailCount = selectedThread.items.filter(
    (i) => i.item_type === "email" && !i.removed_at
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread header */}
      <div className="border-b p-4">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              className="flex-1"
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdateTitle();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              placeholder="Thread title..."
              value={titleInput}
            />
            <Button disabled={loading} onClick={handleUpdateTitle} size="sm">
              Save
            </Button>
            <Button
              onClick={() => setIsEditingTitle(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-semibold text-lg">
              {selectedThread.title || "Untitled Thread"}
            </h2>
            <Button
              onClick={() => {
                setTitleInput(selectedThread.title || "");
                setIsEditingTitle(true);
              }}
              size="sm"
              variant="ghost"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="mt-1 flex items-center gap-4 text-muted-foreground text-sm">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {participants.size} participants
          </span>
          <span>{emailCount} emails</span>
          <button
            className="flex items-center gap-1 transition-colors hover:text-foreground"
            onClick={() => setShowRemoved(!showRemoved)}
          >
            {showRemoved ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {showRemoved ? "Hide removed" : "Show removed"}
          </button>
        </div>
      </div>

      {/* Thread items */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y">
          {visibleItems.map((item) => (
            <ThreadItemComponent
              formatDate={formatDate}
              isExpanded={expandedItems.has(item.id)}
              item={item}
              key={item.id}
              onRemove={() => handleRemoveItem(item.id)}
              onRestore={() => handleRestoreItem(item.id)}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>
      </div>

      {/* Add comment/note form */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            className="min-h-[80px] flex-1"
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment or note..."
            value={newComment}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={!newComment.trim() || addingComment}
                size="sm"
                variant="outline"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAddComment}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Add as Comment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddNote}>
                <StickyNote className="mr-2 h-4 w-4" />
                Add as Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            disabled={!newComment.trim() || addingComment}
            onClick={handleAddComment}
            size="sm"
          >
            {addingComment ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Comment
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ThreadItemComponentProps {
  item: ThreadItem;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onRestore: () => void;
  formatDate: (date: string) => string;
}

function ThreadItemComponent({
  item,
  isExpanded,
  onToggle,
  onRemove,
  onRestore,
  formatDate,
}: ThreadItemComponentProps) {
  const isRemoved = !!item.removed_at;

  const getItemIcon = () => {
    switch (item.item_type) {
      case "email":
        return <Mail className="h-4 w-4" />;
      case "comment":
        return <MessageSquare className="h-4 w-4" />;
      case "note":
        return <StickyNote className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (item.item_type === "email") {
    return (
      <Collapsible onOpenChange={onToggle} open={isExpanded}>
        <div
          className={cn(
            "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-accent/50",
            isExpanded && "bg-accent/30",
            isRemoved && "opacity-50"
          )}
        >
          <CollapsibleTrigger asChild>
            <button className="flex flex-1 items-start gap-3 text-left">
              <div className="mt-1">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {(item.from_name || item.from_email || "?")
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      !item.is_read && "font-semibold"
                    )}
                  >
                    {item.from_name || item.from_email}
                  </span>
                  {!item.is_read && (
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                  )}
                  {isRemoved && (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive text-xs">
                      Removed
                    </span>
                  )}
                </div>
                {!isExpanded && (
                  <p className="line-clamp-1 text-muted-foreground text-sm">
                    {item.subject}
                  </p>
                )}
              </div>
              <span className="whitespace-nowrap text-muted-foreground text-xs">
                {formatDate(item.item_date)}
              </span>
            </button>
          </CollapsibleTrigger>
          <div className="flex flex-shrink-0 items-center gap-1">
            {isRemoved ? (
              <Button onClick={onRestore} size="sm" variant="ghost">
                <RotateCcw className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onRemove} size="sm" variant="ghost">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <div className="ml-6 border-muted border-l-2 pl-4">
            {/* Email details */}
            <div className="px-4 py-2 text-muted-foreground text-sm">
              <div>
                <span className="font-medium">From:</span>{" "}
                {item.from_name || item.from_email} &lt;{item.from_email}&gt;
              </div>
              {item.to_emails && item.to_emails.length > 0 && (
                <div>
                  <span className="font-medium">To:</span>{" "}
                  {item.to_emails.join(", ")}
                </div>
              )}
              {item.cc_emails && item.cc_emails.length > 0 && (
                <div>
                  <span className="font-medium">Cc:</span>{" "}
                  {item.cc_emails.join(", ")}
                </div>
              )}
              <div>
                <span className="font-medium">Subject:</span> {item.subject}
              </div>
            </div>
            <Separator />
            {/* Email body */}
            {item.email_id && (
              <EmailBody
                emailId={item.email_id}
                fallbackText={item.body_preview || ""}
              />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  // Comment or Note
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4",
        item.item_type === "note" && "bg-yellow-50/50 dark:bg-yellow-950/20",
        isRemoved && "opacity-50"
      )}
    >
      <div className="mt-1 flex-shrink-0 text-muted-foreground">
        {getItemIcon()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-medium text-muted-foreground text-xs uppercase">
            {item.item_type}
          </span>
          {isRemoved && (
            <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-destructive text-xs">
              Removed
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm">{item.content}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-muted-foreground text-xs">
          {formatDate(item.item_date)}
        </span>
        {isRemoved ? (
          <Button onClick={onRestore} size="sm" variant="ghost">
            <RotateCcw className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onRemove} size="sm" variant="ghost">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
