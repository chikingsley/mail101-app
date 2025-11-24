import "./index.css";
import { SignedIn, SignedOut, SignInButton, useSession } from "@clerk/clerk-react";
import { Mail } from "./components/mail-app/components/mail";
import { accounts, mails } from "./components/mail-app/data";
import { useEffect, useState } from "react";

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

export function App() {
  const { session } = useSession();
  const [emails, setEmails] = useState(mails); // Start with mock data
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<MailFolder>('inbox');
  const [folderCounts, setFolderCounts] = useState<FolderCounts>(DEFAULT_FOLDER_COUNTS);

  // Read layout preferences from localStorage
  const getLayoutPreference = () => {
    const layout = localStorage.getItem('react-resizable-panels:layout:mail');
    return layout ? JSON.parse(layout) : undefined;
  };

  const getCollapsedPreference = () => {
    const collapsed = localStorage.getItem('react-resizable-panels:collapsed');
    return collapsed ? JSON.parse(collapsed) : undefined;
  };

  // Fetch emails from backend for a specific folder
  const fetchEmails = async (folder: MailFolder = currentFolder) => {
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
        // Transform backend emails to match frontend format
        const transformedEmails = (data.emails || []).map((email: any) => ({
          id: email.id.toString(),
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
          labels: email.importance === 'high' ? ['important'] : []
        }));

        setEmails(transformedEmails);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch folder counts from backend
  const fetchCounts = async () => {
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
  };

  // Handle folder change - don't show full loading screen, just fetch
  const handleFolderChange = async (folder: MailFolder) => {
    setCurrentFolder(folder);
    await fetchEmails(folder);
  };

  // Sync emails from Outlook
  const syncEmails = async () => {
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

      // After syncing, fetch the emails and counts
      await Promise.all([
        fetchEmails(currentFolder),
        fetchCounts()
      ]);
    } catch (error) {
      console.error('Failed to sync emails:', error);
    } finally {
      setSyncing(false);
    }
  };

  // On mount, sync and fetch emails
  useEffect(() => {
    if (session) {
      setLoading(true);
      syncEmails();
    }
  }, [session]);

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
        {loading || syncing ? (
          <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-muted-foreground">
                {syncing ? 'Syncing your emails...' : 'Loading...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="h-screen w-full overflow-hidden">
            <div className="h-screen rounded-md border">
              <Mail
                accounts={accounts}
                mails={emails}
                defaultLayout={getLayoutPreference()}
                defaultCollapsed={getCollapsedPreference()}
                navCollapsedSize={4}
                currentFolder={currentFolder}
                folderCounts={folderCounts}
                onFolderChange={handleFolderChange}
              />
            </div>
          </div>
        )}
      </SignedIn>
    </>
  );
}

export default App;
