/**
 * Census Mail List
 *
 * Email list that displays real emails from census.db
 * with drag-and-drop reordering and urgency indicators.
 */

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CensusEmail, EmailClassification } from "@/lib/census-types";
import { cn } from "@/lib/utils";

interface CensusMailListProps {
  emails: CensusEmail[];
  selectedId: number | null;
  onSelect: (email: CensusEmail) => void;
}

// Type guard for drag data
interface MailDragData {
  type: "census-mail";
  id: number;
  index: number;
}

function isMailData(data: Record<string, unknown>): data is MailDragData {
  return data.type === "census-mail" && typeof data.id === "number";
}

// Classification badge colors
function getClassificationVariant(
  classification: EmailClassification | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (classification) {
    case "CONTRACT":
      return "default";
    case "INVOICE":
      return "secondary";
    case "DUST_PERMIT":
    case "SWPPP":
      return "outline";
    default:
      return "secondary";
  }
}

// Urgency indicator
function getUrgencyIndicator(email: CensusEmail): {
  color: string;
  label: string;
} | null {
  const receivedDate = new Date(email.receivedAt);
  const daysSince = Math.floor(
    (Date.now() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check for urgent keywords in subject
  const subject = email.subject?.toLowerCase() ?? "";
  if (
    subject.includes("urgent") ||
    subject.includes("asap") ||
    subject.includes("action required")
  ) {
    return { color: "bg-red-500", label: "Urgent" };
  }

  // Age-based urgency
  if (daysSince > 7) {
    return { color: "bg-red-500", label: "Overdue" };
  }
  if (daysSince > 3) {
    return { color: "bg-yellow-500", label: "Needs attention" };
  }

  return null;
}

interface MailCardProps {
  email: CensusEmail;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

function MailCard({ email, index, isSelected, onSelect }: MailCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "dragging" | "over">("idle");

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    return combine(
      draggable({
        element,
        getInitialData: () => ({
          type: "census-mail",
          id: email.id,
          index,
        }),
        onDragStart: () => setState("dragging"),
        onDrop: () => setState("idle"),
      }),
      dropTargetForElements({
        element,
        getData: () => ({
          type: "census-mail",
          id: email.id,
          index,
        }),
        canDrop: ({ source }) => {
          const sourceData = source.data;
          return isMailData(sourceData) && sourceData.id !== email.id;
        },
        onDragEnter: () => setState("over"),
        onDragLeave: () => setState("idle"),
        onDrop: () => setState("idle"),
      })
    );
  }, [email.id, index]);

  const urgency = getUrgencyIndicator(email);

  return (
    <div
      ref={ref}
      role="option"
      aria-label={`Email from ${email.fromName ?? email.fromEmail}: ${email.subject}`}
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border p-3 text-left text-sm transition-all cursor-grab active:cursor-grabbing",
        isSelected && "bg-muted",
        state === "dragging" && "opacity-50",
        state === "over" && "ring-2 ring-primary"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onSelect();
        }
      }}
    >
      {/* Urgency indicator */}
      {urgency && (
        <div
          className={cn(
            "absolute top-2 right-2 h-2 w-2 rounded-full",
            urgency.color
          )}
          title={urgency.label}
        />
      )}

      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="font-semibold">
              {email.fromName ?? email.fromEmail?.split("@")[0] ?? "Unknown"}
            </div>
            {email.projectId && (
              <Badge variant="outline" className="text-xs">
                Linked
              </Badge>
            )}
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(email.receivedAt), {
              addSuffix: true,
            })}
          </div>
        </div>
        <div className="text-xs font-medium">
          {email.subject ?? "(No subject)"}
        </div>
      </div>

      <div className="line-clamp-2 text-xs text-muted-foreground">
        {email.bodyPreview ?? ""}
      </div>

      <div className="flex items-center gap-2">
        {email.classification && (
          <Badge variant={getClassificationVariant(email.classification)}>
            {email.classification}
          </Badge>
        )}
        {email.hasAttachments && (
          <Badge variant="outline" className="text-xs">
            📎 {email.attachmentNames?.length ?? 0}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CensusMailList({
  emails,
  selectedId,
  onSelect,
}: CensusMailListProps) {
  const [orderedEmails, setOrderedEmails] = useState(emails);

  // Sync ordered emails when props change
  useEffect(() => {
    setOrderedEmails(emails);
  }, [emails]);

  // Handle reorder from drag-and-drop
  useEffect(() => {
    const handleDrop = (event: CustomEvent) => {
      const { source, location } = event.detail;
      const target = location.current.dropTargets[0];

      if (!target || !isMailData(source.data) || !isMailData(target.data)) {
        return;
      }

      const startIndex = source.data.index;
      const finishIndex = target.data.index;

      if (startIndex === finishIndex) {
        return;
      }

      setOrderedEmails((items) =>
        reorder({
          list: items,
          startIndex,
          finishIndex,
        })
      );
    };

    // Listen to global drop events
    window.addEventListener(
      "pragmatic-drag-and-drop:drop" as any,
      handleDrop as any
    );
    return () => {
      window.removeEventListener(
        "pragmatic-drag-and-drop:drop" as any,
        handleDrop as any
      );
    };
  }, []);

  if (orderedEmails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        No emails found
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-2 p-4" role="listbox">
        {orderedEmails.map((email, index) => (
          <MailCard
            key={email.id}
            email={email}
            index={index}
            isSelected={email.id === selectedId}
            onSelect={() => onSelect(email)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
