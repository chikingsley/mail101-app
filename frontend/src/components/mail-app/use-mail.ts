import { create } from "zustand";
import type { EmailWithFlags } from "@/App";

// Custom thread types
export interface CustomThread {
  id: string;
  user_id: string;
  title: string | null;
  item_count?: number;
  email_count?: number;
  last_activity?: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadItem {
  id: string;
  thread_id: string;
  user_id: string;
  item_type: "email" | "comment" | "note" | "divider";
  email_id: string | null;
  content: string | null;
  item_date: string;
  removed_at: string | null;
  // Email fields (when item_type === 'email')
  from_email?: string;
  from_name?: string;
  subject?: string;
  body_preview?: string;
  email_received_at?: string;
  to_emails?: string[];
  cc_emails?: string[];
  is_read?: boolean;
  has_attachments?: boolean;
  outlook_id?: string;
}

export interface ThreadWithItems extends CustomThread {
  items: ThreadItem[];
}

// Merge dialog state
export interface MergeDialogState {
  isOpen: boolean;
  emailIds: string[];
  targetThreadId?: string;
  defaultTitle?: string;
}

type MailStore = {
  // Single selection (viewing)
  selectedMail: EmailWithFlags | null;
  setSelectedMail: (mail: EmailWithFlags | null) => void;

  // Multi-selection (for actions like merge)
  selectedEmails: Set<string>;
  lastSelectedIndex: number | null;
  selectEmail: (
    emailId: string,
    index: number,
    mode: "single" | "toggle" | "range",
    emails: EmailWithFlags[]
  ) => void;
  clearSelection: () => void;
  selectAll: (emails: EmailWithFlags[]) => void;
  isSelected: (emailId: string) => boolean;

  // Custom threads
  threads: CustomThread[];
  setThreads: (threads: CustomThread[]) => void;
  selectedThread: ThreadWithItems | null;
  setSelectedThread: (thread: ThreadWithItems | null) => void;
  viewMode: "email" | "thread";
  setViewMode: (mode: "email" | "thread") => void;

  // Track which emails are in custom threads (to hide from main list)
  threadedEmailIds: Set<string>;
  addThreadedEmailIds: (ids: string[]) => void;
  setThreadedEmailIds: (ids: Set<string>) => void;
  isEmailInThread: (emailId: string) => boolean;

  // Merge dialog
  mergeDialog: MergeDialogState;
  openMergeDialog: (
    emailIds: string[],
    targetThreadId?: string,
    defaultTitle?: string
  ) => void;
  closeMergeDialog: () => void;

  // Drag state
  draggedEmailId: string | null;
  setDraggedEmailId: (id: string | null) => void;
  dropTargetId: string | null;
  setDropTargetId: (id: string | null) => void;
};

export const useMailStore = create<MailStore>((set, get) => ({
  // Single selection
  selectedMail: null,
  setSelectedMail: (mail) => set({ selectedMail: mail }),

  // Multi-selection
  selectedEmails: new Set(),
  lastSelectedIndex: null,

  selectEmail: (emailId, index, mode, emails) => {
    const { selectedEmails, lastSelectedIndex } = get();
    const newSelection = new Set(selectedEmails);

    if (mode === "single") {
      // Single click - replace selection
      newSelection.clear();
      newSelection.add(emailId);
      set({ selectedEmails: newSelection, lastSelectedIndex: index });
    } else if (mode === "toggle") {
      // Cmd/Ctrl+click - toggle individual selection
      if (newSelection.has(emailId)) {
        newSelection.delete(emailId);
      } else {
        newSelection.add(emailId);
      }
      set({ selectedEmails: newSelection, lastSelectedIndex: index });
    } else if (mode === "range" && lastSelectedIndex !== null) {
      // Shift+click - select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (emails[i]) {
          newSelection.add(emails[i].id);
        }
      }
      set({ selectedEmails: newSelection });
    }
  },

  clearSelection: () =>
    set({ selectedEmails: new Set(), lastSelectedIndex: null }),

  selectAll: (emails) => {
    const newSelection = new Set(emails.map((e) => e.id));
    set({ selectedEmails: newSelection });
  },

  isSelected: (emailId) => get().selectedEmails.has(emailId),

  // Custom threads
  threads: [],
  setThreads: (threads) => set({ threads }),
  selectedThread: null,
  setSelectedThread: (thread) => set({ selectedThread: thread }),
  viewMode: "email",
  setViewMode: (mode) => set({ viewMode: mode }),

  // Track threaded emails
  threadedEmailIds: new Set(),
  addThreadedEmailIds: (ids) => {
    const current = get().threadedEmailIds;
    const newSet = new Set(current);
    ids.forEach((id) => newSet.add(id));
    set({ threadedEmailIds: newSet });
  },
  setThreadedEmailIds: (ids) => set({ threadedEmailIds: ids }),
  isEmailInThread: (emailId) => get().threadedEmailIds.has(emailId),

  // Merge dialog
  mergeDialog: {
    isOpen: false,
    emailIds: [],
    targetThreadId: undefined,
    defaultTitle: undefined,
  },

  openMergeDialog: (emailIds, targetThreadId, defaultTitle) =>
    set({
      mergeDialog: {
        isOpen: true,
        emailIds,
        targetThreadId,
        defaultTitle,
      },
    }),

  closeMergeDialog: () =>
    set({
      mergeDialog: {
        isOpen: false,
        emailIds: [],
        targetThreadId: undefined,
        defaultTitle: undefined,
      },
    }),

  // Drag state
  draggedEmailId: null,
  setDraggedEmailId: (id) => set({ draggedEmailId: id }),
  dropTargetId: null,
  setDropTargetId: (id) => set({ dropTargetId: id }),
}));
