import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Check,
  Flag,
  GripVertical,
  Mail,
  MailOpen,
  Merge,
  MessageSquare,
  Trash2,
} from "lucide-react";
import {
  type ComponentProps,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { EmailWithFlags } from "@/App";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMailStore } from "../use-mail";

// Flag color mapping
const FLAG_COLOR_CLASSES: Record<string, string> = {
  red: "text-red-500",
  orange: "text-orange-500",
  yellow: "text-yellow-500",
  green: "text-green-500",
  blue: "text-blue-500",
  purple: "text-purple-500",
};

const FLAG_COLORS = [
  { name: "red", class: "bg-red-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "yellow", class: "bg-yellow-500" },
  { name: "green", class: "bg-green-500" },
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
];

// Animation variants
const itemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100, transition: { duration: 0.2 } },
};

interface EmailItemProps {
  item: EmailWithFlags;
  index: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect: (
    item: EmailWithFlags,
    index: number,
    event: React.MouseEvent
  ) => void;
  emailActions: EmailListProps["emailActions"];
  emails: EmailWithFlags[];
}

// Memoized email item with Pragmatic DnD
const EmailItem = memo(
  function EmailItem({
    item,
    index,
    isSelected,
    isMultiSelected,
    onSelect,
    emailActions,
    emails,
  }: EmailItemProps) {
    const { openMergeDialog, selectedEmails } = useMailStore();
    const ref = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isDraggedOver, setIsDraggedOver] = useState(false);

    // Set up Pragmatic Drag and Drop
    useEffect(() => {
      const element = ref.current;
      if (!element) return;

      return combine(
        draggable({
          element,
          getInitialData: () => ({
            type: "email",
            emailId: item.id,
            // Include all selected emails if this one is selected
            emailIds:
              selectedEmails.has(item.id) && selectedEmails.size > 1
                ? Array.from(selectedEmails)
                : [item.id],
          }),
          onDragStart: () => setIsDragging(true),
          onDrop: () => setIsDragging(false),
        }),
        dropTargetForElements({
          element,
          getData: () => ({
            type: "email",
            emailId: item.id,
          }),
          canDrop: ({ source }) => {
            // Can't drop on itself
            const sourceIds = source.data.emailIds as string[];
            return !sourceIds?.includes(item.id);
          },
          onDragEnter: () => setIsDraggedOver(true),
          onDragLeave: () => setIsDraggedOver(false),
          onDrop: ({ source }) => {
            setIsDraggedOver(false);
            const sourceIds = source.data.emailIds as string[];
            if (sourceIds && sourceIds.length > 0) {
              // Merge dragged emails with this one
              const allIds = [...new Set([...sourceIds, item.id])];
              openMergeDialog(allIds, undefined, item.subject);
            }
          },
        })
      );
    }, [item.id, item.subject, selectedEmails, openMergeDialog]);

    const handleClick = useCallback(
      (event: React.MouseEvent) => {
        onSelect(item, index, event);
      },
      [onSelect, item, index]
    );

    const handleMerge = useCallback(() => {
      const emailsToMerge =
        selectedEmails.size > 1 ? Array.from(selectedEmails) : [item.id];
      const firstEmail = emails.find((e) => e.id === emailsToMerge[0]);
      openMergeDialog(emailsToMerge, undefined, firstEmail?.subject);
    }, [item.id, selectedEmails, openMergeDialog, emails]);

    const handleMarkRead = useCallback(() => {
      emailActions?.markRead(item.id, true);
    }, [emailActions, item.id]);

    const handleMarkUnread = useCallback(() => {
      emailActions?.markRead(item.id, false);
    }, [emailActions, item.id]);

    const handleArchive = useCallback(() => {
      emailActions?.archive(item.id);
    }, [emailActions, item.id]);

    const handleDelete = useCallback(() => {
      emailActions?.delete(item.id);
    }, [emailActions, item.id]);

    const handleFlag = useCallback(
      (color: string) => {
        emailActions?.flag(item.id, "flagged", color);
      },
      [emailActions, item.id]
    );

    const handleRemoveFlag = useCallback(() => {
      emailActions?.flag(item.id, "notFlagged");
    }, [emailActions, item.id]);

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            animate="animate"
            className={cn(
              "group relative flex cursor-pointer select-none items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
              "hover:bg-accent/70",
              isSelected && "bg-accent/70",
              isMultiSelected && "border-primary/50 bg-primary/10",
              isDragging && "opacity-50 ring-2 ring-primary",
              isDraggedOver &&
                "scale-[1.02] border-2 border-primary bg-primary/10"
            )}
            exit="exit"
            initial="initial"
            layout
            onClick={handleClick}
            ref={ref}
            transition={{ duration: 0.15 }}
            variants={itemVariants}
          >
            {/* Drag handle - visible on hover */}
            <div className="flex-shrink-0 cursor-grab opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Multi-select checkbox indicator */}
            {isMultiSelected && (
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate font-semibold">{item.name}</div>
                  {!item.read && (
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />
                  )}
                  {item.flagStatus === "flagged" && item.flagColor && (
                    <Flag
                      className={cn(
                        "h-3 w-3 flex-shrink-0",
                        FLAG_COLOR_CLASSES[item.flagColor]
                      )}
                    />
                  )}
                  {item.threadCount > 1 && (
                    <span className="flex flex-shrink-0 items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                      <MessageSquare className="h-3 w-3" />
                      {item.threadCount}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "ml-auto flex-shrink-0 text-xs",
                    isSelected ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {formatDistanceToNow(new Date(item.date), {
                    addSuffix: true,
                  })}
                </div>
              </div>
              <div className="truncate font-medium text-xs">{item.subject}</div>
              <div className="line-clamp-2 text-muted-foreground text-xs">
                {item.text.substring(0, 300)}
              </div>
              {item.labels.length ? (
                <div className="mt-1 flex items-center gap-2">
                  {item.labels.map((label) => (
                    <Badge
                      key={label}
                      variant={getBadgeVariantFromLabel(label)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={handleMerge}>
            <Merge className="mr-2 h-4 w-4" />
            {selectedEmails.size > 1
              ? `Merge ${selectedEmails.size} emails`
              : "Create thread from email"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          {item.read ? (
            <ContextMenuItem onClick={handleMarkUnread}>
              <Mail className="mr-2 h-4 w-4" />
              Mark as unread
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={handleMarkRead}>
              <MailOpen className="mr-2 h-4 w-4" />
              Mark as read
            </ContextMenuItem>
          )}
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              Flag
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              {FLAG_COLORS.map((color) => (
                <ContextMenuItem
                  key={color.name}
                  onClick={() => handleFlag(color.name)}
                >
                  <div
                    className={cn("mr-2 h-3 w-3 rounded-full", color.class)}
                  />
                  {color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                </ContextMenuItem>
              ))}
              {item.flagStatus === "flagged" && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleRemoveFlag}>
                    Remove flag
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </ContextMenuItem>
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.read === nextProps.item.read &&
    prevProps.item.flagStatus === nextProps.item.flagStatus &&
    prevProps.item.flagColor === nextProps.item.flagColor &&
    prevProps.item.threadCount === nextProps.item.threadCount &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isMultiSelected === nextProps.isMultiSelected &&
    prevProps.index === nextProps.index
);

interface EmailListProps {
  items: EmailWithFlags[];
  emailActions?: {
    markRead: (id: string, read: boolean) => void;
    archive: (id: string) => void;
    delete: (id: string) => void;
    flag: (id: string, status: string, color?: string) => void;
  };
}

export function MailList({ items, emailActions }: EmailListProps) {
  const {
    selectedMail,
    setSelectedMail,
    selectedEmails,
    selectEmail,
    clearSelection,
    threadedEmailIds,
  } = useMailStore();

  // Filter out emails that are already in custom threads
  const visibleItems = items.filter((item) => !threadedEmailIds.has(item.id));

  // Handle selection with modifier keys
  const handleSelect = useCallback(
    (item: EmailWithFlags, index: number, event: React.MouseEvent) => {
      const isMetaKey = event.metaKey || event.ctrlKey;
      const isShiftKey = event.shiftKey;

      if (isMetaKey) {
        selectEmail(item.id, index, "toggle", visibleItems);
      } else if (isShiftKey) {
        selectEmail(item.id, index, "range", visibleItems);
      } else {
        selectEmail(item.id, index, "single", visibleItems);
        setSelectedMail(item);
      }
    },
    [selectEmail, setSelectedMail, visibleItems]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "a") {
        event.preventDefault();
        const { selectAll } = useMailStore.getState();
        selectAll(visibleItems);
      } else if (event.key === "Escape") {
        clearSelection();
      }
    },
    [visibleItems, clearSelection]
  );

  return (
    <div className="h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {visibleItems.length === 0 ? (
        <div className="flex h-full items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            No emails in this folder
          </p>
        </div>
      ) : (
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 p-4 pt-0">
            {/* Selection indicator */}
            {selectedEmails.size > 1 && (
              <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-md border bg-background/95 px-3 py-2 backdrop-blur">
                <span className="text-muted-foreground text-sm">
                  {selectedEmails.size} emails selected
                </span>
                <button
                  className="text-muted-foreground text-xs transition-colors hover:text-foreground"
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item, index) => (
                <EmailItem
                  emailActions={emailActions}
                  emails={visibleItems}
                  index={index}
                  isMultiSelected={selectedEmails.has(item.id)}
                  isSelected={selectedMail?.id === item.id}
                  item={item}
                  key={item.id}
                  onSelect={handleSelect}
                />
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

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
