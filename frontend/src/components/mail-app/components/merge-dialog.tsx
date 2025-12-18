import { useSession } from "@clerk/clerk-react";
import { ChevronRight, FolderPlus, Loader2, Mail } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EmailWithFlags } from "@/App";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useMailStore } from "../use-mail";

const BACKEND_URL =
  process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface MergeDialogProps {
  emails: EmailWithFlags[];
  onSuccess?: () => void;
}

export function MergeDialog({ emails, onSuccess }: MergeDialogProps) {
  const { session } = useSession();
  const {
    mergeDialog,
    closeMergeDialog,
    threads,
    setThreads,
    setSelectedThread,
    setViewMode,
    addThreadedEmailIds,
    clearSelection,
  } = useMailStore();
  const [title, setTitle] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);

  // Get emails being merged
  const emailsToMerge = emails.filter((e) =>
    mergeDialog.emailIds.includes(e.id)
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (mergeDialog.isOpen) {
      setTitle(mergeDialog.defaultTitle || emailsToMerge[0]?.subject || "");
      setSelectedThreadId(mergeDialog.targetThreadId || null);
      fetchThreads();
    }
  }, [mergeDialog.isOpen]);

  const fetchThreads = useCallback(async () => {
    if (!session) return;
    setLoadingThreads(true);

    try {
      const token = await session.getToken();
      const response = await fetch(`${BACKEND_URL}/api/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setThreads(data.threads);
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [session, setThreads]);

  const handleMerge = async () => {
    if (!session || emailsToMerge.length === 0) return;
    setLoading(true);

    try {
      const token = await session.getToken();
      const response = await fetch(`${BACKEND_URL}/api/threads/merge`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailIds: mergeDialog.emailIds,
          targetThreadId: selectedThreadId || undefined,
          title: title.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Add merged email IDs to the tracked set (so they hide from main list)
        addThreadedEmailIds(mergeDialog.emailIds);

        // Clear multi-selection
        clearSelection();

        // Fetch the full thread and switch to thread view
        const threadResponse = await fetch(
          `${BACKEND_URL}/api/threads/${data.thread.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const threadData = await threadResponse.json();

        if (threadData.success) {
          setSelectedThread(threadData.thread);
          setViewMode("thread");
        }

        closeMergeDialog();
        onSuccess?.();
      } else {
        console.error("Merge failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to merge emails:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => !open && closeMergeDialog()}
      open={mergeDialog.isOpen}
    >
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedThreadId ? "Add to Thread" : "Create New Thread"}
          </DialogTitle>
          <DialogDescription>
            {emailsToMerge.length === 1
              ? "Create a thread from this email"
              : `Merge ${emailsToMerge.length} emails into a thread`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          {/* Thread title input */}
          <div className="space-y-2">
            <Label htmlFor="thread-title">Thread Title</Label>
            <Input
              className="h-9"
              id="thread-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this thread..."
              value={title}
            />
            <p className="text-muted-foreground text-xs">
              Leave blank to use the first email's subject
            </p>
          </div>

          <Separator />

          {/* Emails being merged */}
          <div className="space-y-2">
            <Label className="font-medium text-muted-foreground text-xs uppercase">
              Emails to merge ({emailsToMerge.length})
            </Label>
            <div className="rounded-md border bg-muted/30">
              <ScrollArea className="max-h-28">
                <div className="space-y-1.5 p-2">
                  {emailsToMerge.map((email) => (
                    <div
                      className="flex items-center gap-2 rounded bg-background px-2 py-1.5 text-sm"
                      key={email.id}
                    >
                      <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-xs">
                          {email.name}
                        </div>
                        <div className="truncate text-muted-foreground text-xs">
                          {email.subject}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Existing threads to merge into */}
          {threads.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="font-medium text-muted-foreground text-xs uppercase">
                  Or add to existing thread
                </Label>
                {loadingThreads ? (
                  <div className="flex h-20 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <ScrollArea className="max-h-32">
                      <div className="space-y-0.5 p-1.5">
                        {/* Create new thread option */}
                        <button
                          className={cn(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                            selectedThreadId === null
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          )}
                          onClick={() => setSelectedThreadId(null)}
                          type="button"
                        >
                          <FolderPlus className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="font-medium text-xs">
                            Create new thread
                          </span>
                          {selectedThreadId === null && (
                            <ChevronRight className="ml-auto h-3.5 w-3.5" />
                          )}
                        </button>

                        {/* Existing threads */}
                        {threads.map((thread) => (
                          <button
                            className={cn(
                              "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                              selectedThreadId === thread.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent"
                            )}
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            type="button"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-xs">
                                {thread.title || "Untitled Thread"}
                              </div>
                              <div
                                className={cn(
                                  "text-xs",
                                  selectedThreadId === thread.id
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                                )}
                              >
                                {thread.email_count || 0} emails
                              </div>
                            </div>
                            {selectedThreadId === thread.id && (
                              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={loading}
            onClick={closeMergeDialog}
            size="sm"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={loading || emailsToMerge.length === 0}
            onClick={handleMerge}
            size="sm"
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {selectedThreadId ? "Add to Thread" : "Create Thread"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
