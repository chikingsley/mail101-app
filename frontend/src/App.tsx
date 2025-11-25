import "./index.css";
import { SignedIn, SignedOut, SignInButton, useSession } from "@clerk/clerk-react";
import { Mail } from "./components/mail-app/components/mail";
import { accounts } from "./components/mail-app/data";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useEmailActions, type FlagColor, type FlagStatus } from "./hooks/use-email-actions";

const BACKEND_URL = process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Folder types matching backend
export type MailFolder = 'inbox' | 'sentitems' | 'drafts' | 'deleteditems' | 'junkemail' | 'archive';

export type FolderCounts = Record<MailFolder, { total: number; unread: number }>;

const DEFAULT_FOLDER_COUNTS: FolderCounts = {
  inbox: { total: 0, unread: 0 },
  sentitems: { total: 0, unread: 0 },
  drafts: { total: 0, unread: 0 },
  deleteditems: { total: 0, unread: 0 },
  junkemail: { total: 0, unread: 0 },
  archive: { total: 0, unread: 0 },
};

// Extended mail type with flag info and thread support
export interface EmailWithFlags {
  id: string;
  conversationId: string | null;
  name: string;
  email: string;
  subject: string;
  text: string;
  date: string;
  read: boolean;
  labels: string[];
  flagStatus: FlagStatus;
  flagColor: FlagColor | null;
  threadCount: number;
}

// Raw email type from backend
interface BackendEmail {
  id: string | number;
  conversation_id?: string;
  from_name?: string;
  from_email: string;
  subject?: string;
  body_preview?: string;
  received_at: string;
  is_read: boolean;
  importance?: string;
  flag_status?: FlagStatus;
  flag_color?: FlagColor;
  thread_count?: number;
}

// Transform backend email to frontend format
function transformEmail(email: BackendEmail): EmailWithFlags {
  return {
    id: email.id.toString(),
    conversationId: email.conversation_id || null,
    name: email.from_name || email.from_email,
    email: email.from_email,
    subject: email.subject || "(No Subject)",
    text: email.body_preview || "",
    date: new Date(email.received_at).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }),
    read: email.is_read,
    labels: email.importance === 'high' ? ['important'] : [],
    flagStatus: email.flag_status || 'notFlagged',
    flagColor: email.flag_color || null,
    threadCount: email.thread_count || 1,
  };
}

export function App() {
  const { session } = useSession();
  const [emails, setEmails] = useState<EmailWithFlags[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<MailFolder>('inbox');
  const [folderCounts, setFolderCounts] = useState<FolderCounts>(DEFAULT_FOLDER_COUNTS);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Store removed emails for revert functionality
  const removedEmailsRef = useRef<Map<string, EmailWithFlags>>(new Map());

  // Read layout preferences from localStorage
  const getLayoutPreference = useCallback(() => {
    const layout = localStorage.getItem('react-resizable-panels:layout:mail');
    return layout ? JSON.parse(layout) : undefined;
  }, []);

  const getCollapsedPreference = useCallback(() => {
    const collapsed = localStorage.getItem('react-resizable-panels:collapsed');
    return collapsed ? JSON.parse(collapsed) : undefined;
  }, []);

  // Optimistic update: remove email from list immediately
  const handleOptimisticRemove = useCallback((emailId: string) => {
    setEmails(prev => {
      const email = prev.find(e => e.id === emailId);
      if (email) {
        removedEmailsRef.current.set(emailId, email);
      }
      return prev.filter(e => e.id !== emailId);
    });
  }, []);

  // Optimistic update: update email properties immediately
  const handleOptimisticUpdate = useCallback((emailId: string, updates: Record<string, unknown>) => {
    setEmails(prev => prev.map(e =>
      e.id === emailId ? { ...e, ...updates } as EmailWithFlags : e
    ));
  }, []);

  // Revert: restore removed email
  const handleRevert = useCallback((emailId: string) => {
    const email = removedEmailsRef.current.get(emailId);
    if (email) {
      setEmails(prev => [...prev, email].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      removedEmailsRef.current.delete(emailId);
    }
  }, []);

  // Fetch emails from backend for a specific folder
  const fetchEmails = useCallback(async (folder: MailFolder = currentFolder) => {
    if (!session) return;

    try {
      const token = await session.getToken();
      console.log(`Fetching emails for folder: ${folder}`);
      const response = await fetch(`${BACKEND_URL}/api/emails?folder=${folder}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log(`Received ${data.emails?.length || 0} emails for folder: ${folder}`);

      if (data.success) {
        const transformedEmails = (data.emails || []).map(transformEmail);
        setEmails(transformedEmails);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [session, currentFolder]);

  // Fetch folder counts from backend
  const fetchCounts = useCallback(async () => {
    if (!session) return;

    try {
      const token = await session.getToken();
      const response = await fetch(`${BACKEND_URL}/api/emails/counts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success && data.counts) {
        setFolderCounts(data.counts);
      }
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  }, [session]);

  // Refresh emails and counts (called after email actions complete)
  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchEmails(currentFolder),
      fetchCounts()
    ]);
  }, [fetchEmails, fetchCounts, currentFolder]);

  // Memoized optimistic callbacks
  const optimisticCallbacks = useMemo(() => ({
    onOptimisticRemove: handleOptimisticRemove,
    onOptimisticUpdate: handleOptimisticUpdate,
    onRevert: handleRevert,
  }), [handleOptimisticRemove, handleOptimisticUpdate, handleRevert]);

  // Email actions hook with optimistic updates
  const emailActions = useEmailActions({
    onSuccess: refreshData,
    optimistic: optimisticCallbacks,
  });

  // Handle folder change - don't show full loading screen, just fetch
  const handleFolderChange = useCallback(async (folder: MailFolder) => {
    setCurrentFolder(folder);
    await fetchEmails(folder);
  }, [fetchEmails]);

  // Sync emails from Outlook
  const syncEmails = useCallback(async () => {
    if (!session || syncing) return;

    setSyncing(true);
    try {
      const token = await session.getToken();
      const response = await fetch(`${BACKEND_URL}/api/emails/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log('Sync result:', data);

      await Promise.all([
        fetchEmails(currentFolder),
        fetchCounts()
      ]);
    } catch (error) {
      console.error('Failed to sync emails:', error);
    } finally {
      setSyncing(false);
    }
  }, [session, syncing, currentFolder, fetchEmails, fetchCounts]);

  // Subscribe to webhooks for real-time updates
  const subscribeToWebhooks = useCallback(async () => {
    if (!session) return;

    try {
      const token = await session.getToken();
      const response = await fetch(`${BACKEND_URL}/api/emails/subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        console.log('Webhook subscription:', data.message, data.subscription);
      } else {
        console.warn('Webhook subscription failed:', data.error);
      }
    } catch (error) {
      console.error('Failed to subscribe to webhooks:', error);
    }
  }, [session]);

  // On mount, sync emails and subscribe to webhooks
  useEffect(() => {
    if (session && !hasInitialized) {
      setHasInitialized(true);
      syncEmails();
      subscribeToWebhooks();
    }
  }, [session, hasInitialized, syncEmails, subscribeToWebhooks]);

  // Refresh data when window regains focus (pick up webhook changes)
  useEffect(() => {
    const handleFocus = () => {
      if (session && hasInitialized) {
        console.log('Window focused, refreshing data...');
        Promise.all([fetchEmails(currentFolder), fetchCounts()]).catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [session, hasInitialized, currentFolder, fetchEmails, fetchCounts]);

  // Poll for updates every 30 seconds (simpler than Supabase Realtime which was unreliable)
  useEffect(() => {
    if (!session || !hasInitialized) return;

    const pollInterval = setInterval(() => {
      console.log('Polling for updates...');
      Promise.all([fetchEmails(currentFolder), fetchCounts()]).catch(console.error);
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [session, hasInitialized, currentFolder, fetchEmails, fetchCounts]);

  // Memoize layout preferences to prevent unnecessary re-renders
  const layoutPreference = useMemo(() => getLayoutPreference(), [getLayoutPreference]);
  const collapsedPreference = useMemo(() => getCollapsedPreference(), [getCollapsedPreference]);

  return (
    <>
      <SignedOut>
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-bold tracking-tight">Welcome to Mail</h1>
              <p className="text-muted-foreground text-lg">
                Sign in to access your emails
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        {initialLoading && emails.length === 0 ? (
          <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-muted-foreground">Loading your emails...</p>
            </div>
          </div>
        ) : (
          <div className="h-screen w-full overflow-hidden relative">
            {syncing && (
              <div className="absolute top-2 right-2 z-50 flex items-center gap-2 rounded-md bg-muted/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                Syncing...
              </div>
            )}
            <div className="h-screen rounded-md border">
              <Mail
                accounts={accounts}
                mails={emails}
                defaultLayout={layoutPreference}
                defaultCollapsed={collapsedPreference}
                navCollapsedSize={4}
                currentFolder={currentFolder}
                folderCounts={folderCounts}
                onFolderChange={handleFolderChange}
                emailActions={emailActions}
              />
            </div>
          </div>
        )}
      </SignedIn>
    </>
  );
}

export default App;
