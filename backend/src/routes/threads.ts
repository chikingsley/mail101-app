import { Elysia, t } from "elysia";
import {
  emailQueries,
  searchQueries,
  threadItemQueries,
  threadQueries,
  userQueries,
} from "../db/db";
import { getClerkUser, verifyClerkToken } from "../services/clerk";

// Helper to get or create user from Clerk ID
async function getOrCreateUser(clerkUserId: string) {
  let user = await userQueries.getByClerkId(clerkUserId);
  if (!user) {
    const clerkUser = await getClerkUser(clerkUserId);
    user = await userQueries.getOrCreate(
      clerkUserId,
      clerkUser?.emailAddresses?.[0]?.emailAddress || "unknown@example.com",
      clerkUser?.firstName
        ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
        : undefined
    );
  }
  return user;
}

// Auth middleware helper
async function authenticateRequest(headers: { authorization?: string }) {
  const authHeader = headers.authorization;
  if (!(authHeader && authHeader.startsWith("Bearer "))) {
    throw new Error("Missing or invalid Authorization header");
  }
  const sessionToken = authHeader.replace("Bearer ", "");
  const clerkUserId = await verifyClerkToken(sessionToken);
  const user = await getOrCreateUser(clerkUserId);
  return user;
}

export const threadRoutes = new Elysia({ prefix: "/api/threads" })
  /**
   * GET /api/threads
   * Get all custom threads for the authenticated user
   */
  .get(
    "/",
    async ({ headers }) => {
      try {
        const user = await authenticateRequest(headers);
        const threads = await threadQueries.getByUser(user.id);
        return { success: true, threads };
      } catch (error) {
        console.error("Get threads error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    { detail: { tags: ["Threads"], summary: "Get all custom threads" } }
  )

  /**
   * POST /api/threads
   * Create a new custom thread
   */
  .post(
    "/",
    async ({ headers, body }) => {
      try {
        const user = await authenticateRequest(headers);
        const thread = await threadQueries.create(user.id, body.title);
        return { success: true, thread };
      } catch (error) {
        console.error("Create thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        title: t.Optional(t.String()),
      }),
      detail: { tags: ["Threads"], summary: "Create a new custom thread" },
    }
  )

  /**
   * GET /api/threads/:id
   * Get a thread with all its items
   */
  .get(
    "/:id",
    async ({ headers, params, query }) => {
      try {
        const user = await authenticateRequest(headers);
        const includeRemoved = query.includeRemoved === "true";
        const thread = await threadQueries.getWithItems(
          params.id,
          includeRemoved
        );

        if (!thread) {
          return { success: false, error: "Thread not found" };
        }

        // Verify ownership
        if (thread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        return { success: true, thread };
      } catch (error) {
        console.error("Get thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({ includeRemoved: t.Optional(t.String()) }),
      detail: { tags: ["Threads"], summary: "Get thread with items" },
    }
  )

  /**
   * PATCH /api/threads/:id
   * Update thread title
   */
  .patch(
    "/:id",
    async ({ headers, params, body }) => {
      try {
        const user = await authenticateRequest(headers);

        // Verify ownership
        const existingThread = await threadQueries.getById(params.id);
        if (!existingThread || existingThread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        const thread = await threadQueries.updateTitle(params.id, body.title);
        return { success: true, thread };
      } catch (error) {
        console.error("Update thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ title: t.String() }),
      detail: { tags: ["Threads"], summary: "Update thread title" },
    }
  )

  /**
   * DELETE /api/threads/:id
   * Delete a thread (cascades to items)
   */
  .delete(
    "/:id",
    async ({ headers, params }) => {
      try {
        const user = await authenticateRequest(headers);

        // Verify ownership
        const existingThread = await threadQueries.getById(params.id);
        if (!existingThread || existingThread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        await threadQueries.delete(params.id);
        return { success: true };
      } catch (error) {
        console.error("Delete thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Threads"], summary: "Delete thread" },
    }
  )

  /**
   * POST /api/threads/:id/emails
   * Add one or more emails to a thread
   */
  .post(
    "/:id/emails",
    async ({ headers, params, body }) => {
      try {
        const user = await authenticateRequest(headers);

        // Verify thread ownership
        const thread = await threadQueries.getById(params.id);
        if (!thread || thread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        const emailIds = Array.isArray(body.emailIds)
          ? body.emailIds
          : [body.emailIds];
        const added: string[] = [];
        const skipped: string[] = [];

        for (const emailId of emailIds) {
          // Get email to verify ownership and get date
          const email = await emailQueries.getById(emailId);
          if (!email || email.user_id !== user.id) {
            skipped.push(emailId);
            continue;
          }

          const item = await threadItemQueries.addEmail(
            params.id,
            user.id,
            emailId,
            email.received_at
          );

          if (item) {
            added.push(emailId);
          } else {
            skipped.push(emailId); // Already in thread
          }
        }

        // If this is the first email and no title is set, use the email subject
        if (added.length > 0 && !thread.title) {
          const firstEmail = await emailQueries.getById(added[0]);
          if (firstEmail?.subject) {
            await threadQueries.updateTitle(params.id, firstEmail.subject);
          }
        }

        return { success: true, added, skipped };
      } catch (error) {
        console.error("Add emails to thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        emailIds: t.Union([t.String(), t.Array(t.String())]),
      }),
      detail: { tags: ["Threads"], summary: "Add emails to thread" },
    }
  )

  /**
   * POST /api/threads/:id/comment
   * Add a comment to a thread
   */
  .post(
    "/:id/comment",
    async ({ headers, params, body }) => {
      try {
        const user = await authenticateRequest(headers);

        // Verify thread ownership
        const thread = await threadQueries.getById(params.id);
        if (!thread || thread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        const item = await threadItemQueries.addComment(
          params.id,
          user.id,
          body.content
        );
        return { success: true, item };
      } catch (error) {
        console.error("Add comment error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ content: t.String() }),
      detail: { tags: ["Threads"], summary: "Add comment to thread" },
    }
  )

  /**
   * POST /api/threads/:id/note
   * Add a note to a thread
   */
  .post(
    "/:id/note",
    async ({ headers, params, body }) => {
      try {
        const user = await authenticateRequest(headers);

        // Verify thread ownership
        const thread = await threadQueries.getById(params.id);
        if (!thread || thread.user_id !== user.id) {
          return { success: false, error: "Thread not found" };
        }

        const item = await threadItemQueries.addNote(
          params.id,
          user.id,
          body.content
        );
        return { success: true, item };
      } catch (error) {
        console.error("Add note error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ content: t.String() }),
      detail: { tags: ["Threads"], summary: "Add note to thread" },
    }
  )

  /**
   * POST /api/threads/merge
   * Merge multiple emails into a new or existing thread
   */
  .post(
    "/merge",
    async ({ headers, body }) => {
      try {
        const user = await authenticateRequest(headers);

        const emailIds = body.emailIds;
        if (!emailIds || emailIds.length < 1) {
          return { success: false, error: "At least one email required" };
        }

        let thread;
        if (body.targetThreadId) {
          // Merge into existing thread
          thread = await threadQueries.getById(body.targetThreadId);
          if (!thread || thread.user_id !== user.id) {
            return { success: false, error: "Target thread not found" };
          }
        } else {
          // Create new thread
          thread = await threadQueries.create(user.id, body.title);
        }

        // Add all emails to the thread
        const added: string[] = [];
        const skipped: string[] = [];

        for (const emailId of emailIds) {
          const email = await emailQueries.getById(emailId);
          if (!email || email.user_id !== user.id) {
            skipped.push(emailId);
            continue;
          }

          const item = await threadItemQueries.addEmail(
            thread.id,
            user.id,
            emailId,
            email.received_at
          );

          if (item) {
            added.push(emailId);
          } else {
            skipped.push(emailId);
          }
        }

        // Set title from first email if no title provided
        if (!(body.title || body.targetThreadId) && added.length > 0) {
          const firstEmail = await emailQueries.getById(added[0]);
          if (firstEmail?.subject) {
            await threadQueries.updateTitle(thread.id, firstEmail.subject);
            thread = await threadQueries.getById(thread.id);
          }
        }

        // Update title if explicitly provided
        if (body.title && thread.title !== body.title) {
          await threadQueries.updateTitle(thread.id, body.title);
          thread = await threadQueries.getById(thread.id);
        }

        return { success: true, thread, added, skipped };
      } catch (error) {
        console.error("Merge emails error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        emailIds: t.Array(t.String()),
        targetThreadId: t.Optional(t.String()),
        title: t.Optional(t.String()),
      }),
      detail: { tags: ["Threads"], summary: "Merge emails into a thread" },
    }
  )

  /**
   * DELETE /api/threads/items/:id
   * Soft-delete an item from a thread (unlike Missive!)
   */
  .delete(
    "/items/:id",
    async ({ headers, params }) => {
      try {
        const user = await authenticateRequest(headers);
        const item = await threadItemQueries.remove(params.id, user.id);

        if (!item) {
          return { success: false, error: "Item not found" };
        }

        return { success: true, item };
      } catch (error) {
        console.error("Remove item error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: {
        tags: ["Threads"],
        summary: "Remove item from thread (soft delete)",
      },
    }
  )

  /**
   * POST /api/threads/items/:id/restore
   * Restore a soft-deleted item
   */
  .post(
    "/items/:id/restore",
    async ({ headers, params }) => {
      try {
        await authenticateRequest(headers);
        const item = await threadItemQueries.restore(params.id);

        if (!item) {
          return { success: false, error: "Item not found" };
        }

        return { success: true, item };
      } catch (error) {
        console.error("Restore item error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Threads"], summary: "Restore removed item" },
    }
  )

  /**
   * PATCH /api/threads/items/:id
   * Update item content (for comments/notes)
   */
  .patch(
    "/items/:id",
    async ({ headers, params, body }) => {
      try {
        await authenticateRequest(headers);
        const item = await threadItemQueries.updateContent(
          params.id,
          body.content
        );

        if (!item) {
          return { success: false, error: "Item not found" };
        }

        return { success: true, item };
      } catch (error) {
        console.error("Update item error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ content: t.String() }),
      detail: { tags: ["Threads"], summary: "Update item content" },
    }
  );

/**
 * Search routes (separate prefix)
 */
export const searchRoutes = new Elysia({ prefix: "/api/search" })
  /**
   * GET /api/search/emails
   * Full-text search for emails
   */
  .get(
    "/emails",
    async ({ headers, query }) => {
      try {
        const user = await authenticateRequest(headers);

        if (!query.q || query.q.trim().length < 2) {
          return {
            success: false,
            error: "Search query must be at least 2 characters",
          };
        }

        const limit = Math.min(Number(query.limit) || 50, 100);
        const offset = Number(query.offset) || 0;

        const [emails, totalCount] = await Promise.all([
          searchQueries.searchEmails(user.id, query.q, limit, offset),
          searchQueries.searchEmailsCount(user.id, query.q),
        ]);

        return {
          success: true,
          emails,
          pagination: {
            total: totalCount,
            limit,
            offset,
            hasMore: offset + emails.length < totalCount,
          },
        };
      } catch (error) {
        console.error("Search error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: { tags: ["Search"], summary: "Search emails" },
    }
  );
