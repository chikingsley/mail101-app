"use client";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Mail } from "@/data";
import { cn } from "@/lib/utils";
import { useMail } from "@/use-mail";

// Type guard for mail drag data
function isMailData(
  data: Record<string, unknown>
): data is { type: "mail"; id: string; index: number } {
  return data.type === "mail" && typeof data.id === "string";
}

interface MailListProps {
  items: Mail[];
}

export function MailList({ items }: MailListProps) {
  const [mail, setMail] = useMail();
  const [orderedItems, setOrderedItems] = useState(items);

  // Sync items when they change externally
  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  // Monitor for all drag operations - handles reordering at the list level
  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isMailData(source.data),
      onDrop: ({ source, location }) => {
        const destination = location.current.dropTargets[0];
        if (!destination) {
          return;
        }

        const sourceData = source.data;
        const destinationData = destination.data;

        if (!isMailData(sourceData)) {
          return;
        }

        const sourceIndex = orderedItems.findIndex(
          (item) => item.id === sourceData.id
        );
        const destinationIndex = orderedItems.findIndex(
          (item) => item.id === destinationData.id
        );

        if (sourceIndex === -1 || destinationIndex === -1) {
          return;
        }

        // Use the reorder utility for clean array reordering
        const reordered = reorder({
          list: orderedItems,
          startIndex: sourceIndex,
          finishIndex: destinationIndex,
        });

        setOrderedItems(reordered);
      },
    });
  }, [orderedItems]);

  return (
    <ScrollArea className="h-screen" data-slot="mail-list">
      <div className="flex flex-col gap-2 p-4 pt-0" role="listbox">
        {orderedItems.map((item, index) => (
          <MailCard
            index={index}
            isSelected={mail.selected === item.id}
            key={item.id}
            mail={item}
            onSelect={() =>
              setMail({
                ...mail,
                selected: item.id,
              })
            }
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// Badge variant helper
function getBadgeVariantFromLabel(
  label: string
): ComponentProps<typeof Badge>["variant"] {
  if (["work"].includes(label.toLowerCase())) {
    return "default";
  }
  if (["personal"].includes(label.toLowerCase())) {
    return "outline";
  }
  return "secondary";
}

interface MailCardProps {
  mail: Mail;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

type DragState = "idle" | "dragging" | "over";

function MailCard({ mail, index, isSelected, onSelect }: MailCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<DragState>("idle");

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // Combine draggable and drop target on the same element
    // Entire card is draggable (no dragHandle specified)
    return combine(
      draggable({
        element,
        getInitialData: () => ({
          type: "mail",
          id: mail.id,
          index,
        }),
        onDragStart: () => setState("dragging"),
        onDrop: () => setState("idle"),
      }),
      dropTargetForElements({
        element,
        getData: () => ({ type: "mail", id: mail.id, index }),
        canDrop: ({ source }) => {
          // Don't allow dropping on itself
          return isMailData(source.data) && source.data.id !== mail.id;
        },
        onDragEnter: () => setState("over"),
        onDragLeave: () => setState("idle"),
        onDrop: () => setState("idle"),
      })
    );
  }, [mail.id, index]);

  return (
    <div
      aria-label={`Email from ${mail.name}: ${mail.subject}`}
      aria-selected={isSelected}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border p-3 text-left text-sm transition-all",
        "cursor-grab hover:bg-accent active:cursor-grabbing",
        state === "dragging" && "opacity-50",
        state === "over" && "ring-2 ring-primary ring-offset-2",
        isSelected && "bg-muted"
      )}
      data-slot="mail-card"
      data-state={state}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      ref={ref}
      role="option"
      tabIndex={0}
    >
      {/* Content */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <div className="font-semibold">{mail.name}</div>
            {!mail.read && (
              <span
                className="flex size-2 rounded-full bg-blue-600"
                data-slot="unread-indicator"
              />
            )}
          </div>
          <div
            className={cn(
              "ml-auto text-xs",
              isSelected ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {formatDistanceToNow(new Date(mail.date), {
              addSuffix: true,
            })}
          </div>
        </div>
        <div className="font-medium text-xs">{mail.subject}</div>
        <div className="line-clamp-2 text-muted-foreground text-xs">
          {mail.text.substring(0, 300)}
        </div>
        {mail.labels.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            {mail.labels.map((label) => (
              <Badge key={label} variant={getBadgeVariantFromLabel(label)}>
                {label}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
