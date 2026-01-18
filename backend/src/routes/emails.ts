import { Elysia, t } from "elysia";
import {
  emailQueries,
  MAIL_FOLDERS,
  type MailFolder,
  syncQueries,
  userQueries,
} from "../db/db";
import {
  getClerkUser,
  getMicrosoftToken,
  verifyClerkToken,
} from "../services/clerk";
import {
  deleteEmail as deleteEmailGraph,
  fetchEmailBody,
  type GraphMailFolder,
  getDeltaEmails,
  moveEmail,
  permanentDeleteEmail,
  updateEmailFlag,
  updateEmailReadStatus,
} from "../services/graph";
import { queueSync, getSyncJobStatus } from "../services/sync-queue";
import { withRateLimit } from "../services/rate-limiter";
import { searchEmails as meiliSearch, indexEmail } from "../services/meilisearch";

// Valid flag colors (local only - Microsoft Graph doesn't support colors)
const FLAG_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
] as const;
type FlagColor = (typeof FLAG_COLORS)[number];

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

// Helper to sync a single folder (direct sync, not queued)
async function syncFolder(
  accessToken: string,
  userId: string,
  folder: MailFolder,
  clerkUserId: string
): Promise<{
  inserted: number;
  updated: number;
  removed: number;
  total: number;
}> {
  const syncState = await syncQueries.getByUserAndFolder(userId, folder);

  let emails: any[] = [];
  let deltaLink: string | undefined;

  // Use rate limiter for Graph API calls
  const deltaResult = await withRateLimit(clerkUserId, async () => {
    if (syncState?.delta_link) {
      return getDeltaEmails(
        accessToken,
        folder as GraphMailFolder,
        syncState.delta_link
      );
    }
    return getDeltaEmails(accessToken, folder as GraphMailFolder);
  });

  emails = deltaResult.emails;
  deltaLink = deltaResult.deltaLink;

  let inserted = 0;
  let updated = 0;
  let removed = 0;

  for (const email of emails) {
    if (email["@removed"]) {
      try {
        await emailQueries.deleteByOutlookId(userId, email.id);
        removed++;
      } catch (err) {
        console.error(`Failed to remove email ${email.id}:`, err);
      }
      continue;
    }

    try {
      const result = await emailQueries.insert(userId, {
        outlook_id: email.id,
        conversation_id: email.conversationId || undefined,
        internet_message_id: email.internetMessageId || undefined,
        folder,
        from_email: email.from?.emailAddress?.address || "",
        from_name: email.from?.emailAddress?.name || undefined,
        subject: email.subject || undefined,
        body_preview: email.bodyPreview || undefined,
        to_emails:
          email.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
        cc_emails:
          email.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
        is_read: email.isRead,
        has_attachments: email.hasAttachments,
        importance: email.importance || "normal",
        received_at: email.receivedDateTime,
        sent_at: email.sentDateTime || undefined,
      });

      if (result) {
        inserted++;
        // Index in Meilisearch
        try {
          await indexEmail({
            id: result.id,
            user_id: userId,
            outlook_id: email.id,
            conversation_id: email.conversationId,
            folder,
            from_email: email.from?.emailAddress?.address || "",
            from_name: email.from?.emailAddress?.name,
            subject: email.subject,
            body_preview: email.bodyPreview,
            to_emails: email.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
            cc_emails: email.ccRecipients?.map((r: any) => r.emailAddress?.address) || [],
            is_read: email.isRead,
            has_attachments: email.hasAttachments,
            importance: email.importance || "normal",
            received_at: email.receivedDateTime,
            sent_at: email.sentDateTime,
          });
        } catch (searchErr) {
          console.warn("Failed to index email in Meilisearch:", searchErr);
        }
      } else {
        await emailQueries.updateFromSync(userId, email.id, email.isRead);
        updated++;
      }
    } catch (err) {
      console.error(`Failed to process email ${email.id}:`, err);
    }
  }

  if (deltaLink) {
    await syncQueries.upsert(userId, folder, deltaLink);
  }

  return { inserted, updated, removed, total: emails.length };
}

export const emailRoutes = new Elysia({ prefix: "/api/emails" })
  /**
   * POST /api/emails/sync
   * Sync emails - can be direct (blocking) or queued (async)
   */
  .post(
    "/sync",
    async ({ headers, query }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const user = await getOrCreateUser(clerkUserId);

        // If async=true, queue the sync job
        if (query.async === "true") {
          const job = await queueSync(clerkUserId, user.id, {
            folder: query.folder as MailFolder | undefined,
          });

          return {
            success: true,
            queued: true,
            jobId: job.id,
            message: "Sync job queued",
          };
        }

        // Direct sync (blocking)
        const accessToken = await getMicrosoftToken(clerkUserId);
        const foldersToSync = query.folder
          ? [query.folder as MailFolder]
          : MAIL_FOLDERS;

        const results: Record<
          string,
          { inserted: number; updated: number; removed: number; total: number }
        > = {};
        let totalInserted = 0;
        let totalUpdated = 0;
        let totalRemoved = 0;
        let totalEmails = 0;

        for (const folder of foldersToSync) {
          try {
            const result = await syncFolder(accessToken, user.id, folder, clerkUserId);
            results[folder] = result;
            totalInserted += result.inserted;
            totalUpdated += result.updated;
            totalRemoved += result.removed;
            totalEmails += result.total;
          } catch (err) {
            console.error(`Error syncing folder ${folder}:`, err);
            results[folder] = { inserted: 0, updated: 0, removed: 0, total: 0 };
          }
        }

        return {
          success: true,
          inserted: totalInserted,
          updated: totalUpdated,
          removed: totalRemoved,
          total: totalEmails,
          byFolder: results,
        };
      } catch (error) {
        console.error("Sync error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({
        folder: t.Optional(t.String()),
        async: t.Optional(t.String()),
      }),
      detail: { tags: ["Emails"], summary: "Sync emails from Outlook" },
    }
  )

  /**
   * GET /api/emails/sync/status/:jobId
   * Get status of a queued sync job
   */
  .get(
    "/sync/status/:jobId",
    async ({ params }) => {
      const status = await getSyncJobStatus(params.jobId);
      if (!status) {
        return { success: false, error: "Job not found" };
      }
      return { success: true, ...status };
    },
    {
      params: t.Object({ jobId: t.String() }),
      detail: { tags: ["Emails"], summary: "Get sync job status" },
    }
  )

  /**
   * GET /api/emails
   * Get emails for the authenticated user, optionally filtered by folder
   */
  .get(
    "/",
    async ({ headers, query }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const user = await getOrCreateUser(clerkUserId);

        const folder = (query.folder as MailFolder) || "inbox";
        const emails = await emailQueries.getByFolder(user.id, folder);

        return { success: true, emails, folder };
      } catch (error) {
        console.error("Get emails error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({ folder: t.Optional(t.String()) }),
      detail: { tags: ["Emails"], summary: "Get emails" },
    }
  )

  /**
   * GET /api/emails/search
   * Search emails using Meilisearch
   */
  .get(
    "/search",
    async ({ headers, query }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const user = await getOrCreateUser(clerkUserId);

        if (!query.q) {
          return { success: false, error: "Query parameter 'q' is required" };
        }

        const results = await meiliSearch(user.id, query.q, {
          folder: query.folder,
          limit: query.limit ? Number.parseInt(query.limit) : 50,
          offset: query.offset ? Number.parseInt(query.offset) : 0,
          hybrid: query.hybrid === "true",
        });

        return {
          success: true,
          ...results,
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
        folder: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        hybrid: t.Optional(t.String()),
      }),
      detail: { tags: ["Emails"], summary: "Search emails" },
    }
  )

  /**
   * GET /api/emails/counts
   * Get folder counts for the authenticated user
   */
  .get(
    "/counts",
    async ({ headers }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const user = await getOrCreateUser(clerkUserId);

        const rawCounts = await emailQueries.getCounts(user.id);

        const counts: Record<string, { total: number; unread: number }> = {};
        for (const folder of MAIL_FOLDERS) {
          counts[folder] = { total: 0, unread: 0 };
        }
        for (const row of rawCounts) {
          counts[row.folder] = {
            total: Number(row.total),
            unread: Number(row.unread),
          };
        }

        return { success: true, counts };
      } catch (error) {
        console.error("Get counts error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    { detail: { tags: ["Emails"], summary: "Get folder counts" } }
  )

  /**
   * GET /api/emails/:id/body
   * Fetch full email body on demand
   */
  .get(
    "/:id/body",
    async ({ headers, params }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const accessToken = await getMicrosoftToken(clerkUserId);

        const email = await emailQueries.getById(params.id);
        if (!email) {
          return { success: false, error: "Email not found" };
        }

        const body = await withRateLimit(clerkUserId, () =>
          fetchEmailBody(accessToken, email.outlook_id)
        );
        return { success: true, body };
      } catch (error) {
        console.error("Get body error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Emails"], summary: "Get email body" },
    }
  )

  /**
   * GET /api/emails/thread/:conversationId
   * Get all emails in a conversation thread
   */
  .get(
    "/thread/:conversationId",
    async ({ headers, params }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const user = await getOrCreateUser(clerkUserId);

        const emails = await emailQueries.getByConversationId(
          user.id,
          params.conversationId
        );

        if (emails.length === 0) {
          return { success: false, error: "Thread not found" };
        }

        const participants = new Set<string>();
        for (const email of emails) {
          participants.add(email.from_email);
        }

        return {
          success: true,
          thread: {
            conversationId: params.conversationId,
            subject: emails[0]?.subject || "(No Subject)",
            participantCount: participants.size,
            messageCount: emails.length,
            emails,
          },
        };
      } catch (error) {
        console.error("Get thread error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ conversationId: t.String() }),
      detail: { tags: ["Emails"], summary: "Get email thread" },
    }
  )

  /**
   * PATCH /api/emails/:id/read
   * Update email read status
   */
  .patch(
    "/:id/read",
    async ({ headers, params, body }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const accessToken = await getMicrosoftToken(clerkUserId);

        const email = await emailQueries.getById(params.id);
        if (!email) {
          return { success: false, error: "Email not found" };
        }

        const isRead = body.read ?? true;

        await withRateLimit(clerkUserId, () =>
          updateEmailReadStatus(accessToken, email.outlook_id, isRead)
        );
        await emailQueries.updateReadStatus(params.id, isRead);

        return { success: true, read: isRead };
      } catch (error) {
        console.error("Update read error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ read: t.Optional(t.Boolean()) }),
      detail: { tags: ["Emails"], summary: "Update read status" },
    }
  )

  /**
   * PATCH /api/emails/:id/flag
   * Update email flag status and color
   */
  .patch(
    "/:id/flag",
    async ({ headers, params, body }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const accessToken = await getMicrosoftToken(clerkUserId);

        const email = await emailQueries.getById(params.id);
        if (!email) {
          return { success: false, error: "Email not found" };
        }

        const flagStatus = body.flagStatus || "flagged";
        const flagColor = body.flagColor || null;

        if (flagColor && !FLAG_COLORS.includes(flagColor as FlagColor)) {
          return {
            success: false,
            error: `Invalid flag color. Must be one of: ${FLAG_COLORS.join(", ")}`,
          };
        }

        await withRateLimit(clerkUserId, () =>
          updateEmailFlag(
            accessToken,
            email.outlook_id,
            flagStatus as "notFlagged" | "flagged" | "complete"
          )
        );
        await emailQueries.updateFlag(
          params.id,
          flagStatus,
          flagColor || undefined
        );

        return { success: true, flagStatus, flagColor };
      } catch (error) {
        console.error("Update flag error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        flagStatus: t.Optional(t.String()),
        flagColor: t.Optional(t.String()),
      }),
      detail: { tags: ["Emails"], summary: "Update flag status" },
    }
  )

  /**
   * POST /api/emails/:id/move
   * Move email to a different folder
   */
  .post(
    "/:id/move",
    async ({ headers, params, body }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const accessToken = await getMicrosoftToken(clerkUserId);

        const email = await emailQueries.getById(params.id);
        if (!email) {
          return { success: false, error: "Email not found" };
        }

        const destination = body.destination as GraphMailFolder;
        if (!MAIL_FOLDERS.includes(destination as MailFolder)) {
          return { success: false, error: "Invalid destination folder" };
        }

        try {
          await withRateLimit(clerkUserId, () =>
            moveEmail(accessToken, email.outlook_id, destination)
          );
          await emailQueries.updateFolder(params.id, destination);
        } catch (graphError) {
          console.warn(
            `Microsoft Graph move failed (email may not exist): ${graphError}`
          );
          await emailQueries.delete(params.id);
        }

        return { success: true, folder: destination };
      } catch (error) {
        console.error("Move error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ destination: t.String() }),
      detail: { tags: ["Emails"], summary: "Move email to folder" },
    }
  )

  /**
   * DELETE /api/emails/:id
   * Permanently delete an email
   */
  .delete(
    "/:id",
    async ({ headers, params }) => {
      try {
        const authHeader = headers.authorization;
        if (!(authHeader && authHeader.startsWith("Bearer "))) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);
        const accessToken = await getMicrosoftToken(clerkUserId);

        const email = await emailQueries.getById(params.id);
        if (!email) {
          return { success: false, error: "Email not found" };
        }

        try {
          if (email.folder === "deleteditems") {
            console.log(`Permanently deleting email ${email.outlook_id}`);
            await withRateLimit(clerkUserId, () =>
              permanentDeleteEmail(accessToken, email.outlook_id)
            );
          } else {
            console.log(`Moving email ${email.outlook_id} to trash`);
            await withRateLimit(clerkUserId, () =>
              deleteEmailGraph(accessToken, email.outlook_id)
            );
          }
        } catch (graphError) {
          console.warn(
            `Microsoft Graph delete failed (may already be deleted): ${graphError}`
          );
        }

        await emailQueries.delete(params.id);

        return { success: true };
      } catch (error) {
        console.error("Delete error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Emails"], summary: "Delete email permanently" },
    }
  );
