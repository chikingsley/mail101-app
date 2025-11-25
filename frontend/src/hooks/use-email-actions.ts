import { useSession } from "@clerk/clerk-react";
import { useCallback } from "react";

const BACKEND_URL = process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type FlagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple';
export type FlagStatus = 'notFlagged' | 'flagged' | 'complete';
export type MailFolder = 'inbox' | 'sentitems' | 'drafts' | 'deleteditems' | 'junkemail' | 'archive';

interface OptimisticCallbacks {
  onOptimisticRemove?: (emailId: string) => void;
  onOptimisticUpdate?: (emailId: string, updates: Record<string, unknown>) => void;
  onRevert?: (emailId: string) => void;
}

interface UseEmailActionsOptions {
  onSuccess?: () => void;
  optimistic?: OptimisticCallbacks;
}

export function useEmailActions(options: UseEmailActionsOptions = {}) {
  const { session } = useSession();
  const { onSuccess, optimistic } = options;

  const getAuthHeaders = useCallback(async () => {
    if (!session) throw new Error("Not authenticated");
    const token = await session.getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, [session]);

  /**
   * Toggle or set email read status
   */
  const setReadStatus = useCallback(async (emailId: string, read: boolean) => {
    // Optimistic update
    optimistic?.onOptimisticUpdate?.(emailId, { read });

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/emails/${emailId}/read`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ read }),
      });

      const data = await response.json();
      if (!data.success) {
        // Revert on failure
        optimistic?.onOptimisticUpdate?.(emailId, { read: !read });
        throw new Error(data.error || 'Failed to update read status');
      }

      onSuccess?.();
      return data;
    } catch (error) {
      optimistic?.onOptimisticUpdate?.(emailId, { read: !read });
      throw error;
    }
  }, [getAuthHeaders, onSuccess, optimistic]);

  /**
   * Mark email as read
   */
  const markAsRead = useCallback(async (emailId: string) => {
    return setReadStatus(emailId, true);
  }, [setReadStatus]);

  /**
   * Mark email as unread
   */
  const markAsUnread = useCallback(async (emailId: string) => {
    return setReadStatus(emailId, false);
  }, [setReadStatus]);

  /**
   * Set email flag status and optional color
   */
  const setFlag = useCallback(async (
    emailId: string,
    flagStatus: FlagStatus,
    flagColor?: FlagColor | null
  ) => {
    // Optimistic update
    optimistic?.onOptimisticUpdate?.(emailId, { flagStatus, flagColor: flagColor ?? null });

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/emails/${emailId}/flag`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ flagStatus, flagColor }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update flag');
      }

      onSuccess?.();
      return data;
    } catch (error) {
      // Revert handled by onSuccess refetch
      throw error;
    }
  }, [getAuthHeaders, onSuccess, optimistic]);

  /**
   * Add flag with color
   */
  const addFlag = useCallback(async (emailId: string, color: FlagColor = 'red') => {
    return setFlag(emailId, 'flagged', color);
  }, [setFlag]);

  /**
   * Remove flag
   */
  const removeFlag = useCallback(async (emailId: string) => {
    return setFlag(emailId, 'notFlagged', null);
  }, [setFlag]);

  /**
   * Move email to a folder
   */
  const moveToFolder = useCallback(async (emailId: string, folder: MailFolder) => {
    // Optimistic remove from current view (email moves to another folder)
    optimistic?.onOptimisticRemove?.(emailId);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/emails/${emailId}/move`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ destination: folder }),
      });

      const data = await response.json();
      if (!data.success) {
        // Revert - but we need to refetch anyway
        optimistic?.onRevert?.(emailId);
        throw new Error(data.error || 'Failed to move email');
      }

      onSuccess?.();
      return data;
    } catch (error) {
      optimistic?.onRevert?.(emailId);
      throw error;
    }
  }, [getAuthHeaders, onSuccess, optimistic]);

  /**
   * Archive email
   */
  const archive = useCallback(async (emailId: string) => {
    return moveToFolder(emailId, 'archive');
  }, [moveToFolder]);

  /**
   * Move to junk/spam
   */
  const moveToJunk = useCallback(async (emailId: string) => {
    return moveToFolder(emailId, 'junkemail');
  }, [moveToFolder]);

  /**
   * Move to trash
   */
  const moveToTrash = useCallback(async (emailId: string) => {
    return moveToFolder(emailId, 'deleteditems');
  }, [moveToFolder]);

  /**
   * Permanently delete email
   */
  const deleteEmail = useCallback(async (emailId: string) => {
    // Optimistic remove
    optimistic?.onOptimisticRemove?.(emailId);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/emails/${emailId}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();
      if (!data.success) {
        optimistic?.onRevert?.(emailId);
        throw new Error(data.error || 'Failed to delete email');
      }

      onSuccess?.();
      return data;
    } catch (error) {
      optimistic?.onRevert?.(emailId);
      throw error;
    }
  }, [getAuthHeaders, onSuccess, optimistic]);

  return {
    // Read status
    setReadStatus,
    markAsRead,
    markAsUnread,

    // Flags
    setFlag,
    addFlag,
    removeFlag,

    // Move operations
    moveToFolder,
    archive,
    moveToJunk,
    moveToTrash,

    // Delete
    deleteEmail,

    // Auth check
    isAuthenticated: !!session,
  };
}
