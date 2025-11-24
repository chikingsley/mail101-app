import { Elysia, t } from "elysia";
import { getMicrosoftToken, verifyClerkToken } from "../services/clerk";
import {
  fetchEmails,
  fetchEmailBody,
  markEmailAsRead,
  sendEmail,
  getDeltaEmails,
  moveEmail,
  deleteEmail,
  type GraphMailFolder,
} from "../services/graph";
import { emailQueries, syncQueries, MAIL_FOLDERS, type MailFolder } from "../db";

// Helper to sync a single folder
async function syncFolder(
  accessToken: string,
  clerkUserId: string,
  folder: MailFolder
): Promise<{ inserted: number; total: number }> {
  // Check if we have a delta link for this user+folder
  const syncState = syncQueries.getByUserAndFolder.get(clerkUserId, folder);

  let emails;
  let deltaLink;

  if (syncState?.delta_link) {
    // Use delta sync for incremental updates
    const deltaResult = await getDeltaEmails(
      accessToken,
      folder as GraphMailFolder,
      syncState.delta_link
    );
    emails = deltaResult.emails;
    deltaLink = deltaResult.deltaLink;
  } else {
    // First sync - fetch all emails for this folder
    const fetchResult = await getDeltaEmails(accessToken, folder as GraphMailFolder);
    emails = fetchResult.emails;
    deltaLink = fetchResult.deltaLink;
  }

  // Store emails in database
  let inserted = 0;
  for (const email of emails) {
    try {
      emailQueries.insert.run(
        clerkUserId,
        email.id,
        email.conversationId || null,
        email.internetMessageId || null,
        folder, // Include folder
        email.from?.emailAddress?.address || "",
        email.from?.emailAddress?.name || null,
        email.subject || null,
        email.bodyPreview || null,
        email.toRecipients
          ? JSON.stringify(
              email.toRecipients.map((r: any) => r.emailAddress?.address)
            )
          : null,
        email.ccRecipients
          ? JSON.stringify(
              email.ccRecipients.map((r: any) => r.emailAddress?.address)
            )
          : null,
        email.isRead ? 1 : 0,
        email.hasAttachments ? 1 : 0,
        email.importance || "normal",
        email.receivedDateTime,
        email.sentDateTime || null
      );
      inserted++;
    } catch (err) {
      // Skip duplicates (outlook_id is UNIQUE)
      if (
        err instanceof Error &&
        err.message.includes("UNIQUE constraint")
      ) {
        continue;
      }
      throw err;
    }
  }

  // Update sync state with new delta link
  if (deltaLink) {
    syncQueries.upsert.run(clerkUserId, folder, deltaLink);
  }

  return { inserted, total: emails.length };
}

export const emailRoutes = new Elysia({ prefix: "/api/emails" })
  /**
   * POST /api/emails/sync
   * Sync emails from all folders in Microsoft Graph API to local database
   */
  .post(
    "/sync",
    async ({ headers, query }) => {
      try {
        // Get session token from Authorization header
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");

        // Verify session and get Clerk user ID
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get Microsoft access token from Clerk
        const accessToken = await getMicrosoftToken(clerkUserId);

        // Determine which folders to sync
        const foldersToSync = query.folder
          ? [query.folder as MailFolder]
          : MAIL_FOLDERS;

        // Sync each folder
        const results: Record<string, { inserted: number; total: number }> = {};
        let totalInserted = 0;
        let totalEmails = 0;

        for (const folder of foldersToSync) {
          try {
            const result = await syncFolder(accessToken, clerkUserId, folder);
            results[folder] = result;
            totalInserted += result.inserted;
            totalEmails += result.total;
          } catch (err) {
            console.error(`Error syncing folder ${folder}:`, err);
            results[folder] = { inserted: 0, total: 0 };
          }
        }

        return {
          success: true,
          synced: totalInserted,
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
      }),
      detail: {
        tags: ["Emails"],
        summary: "Sync emails from Outlook",
        description:
          "Fetches emails from Microsoft Graph API and stores them in local database. Optionally specify a folder to sync only that folder.",
      },
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
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get emails - filter by folder if specified
        const emails = query.folder
          ? emailQueries.getByFolder.all(clerkUserId, query.folder)
          : emailQueries.getAllByUser.all(clerkUserId);

        return {
          success: true,
          emails: emails.map((email) => ({
            ...email,
            to_emails: email.to_emails ? JSON.parse(email.to_emails) : [],
            cc_emails: email.cc_emails ? JSON.parse(email.cc_emails) : [],
            is_read: email.is_read === 1,
            has_attachments: email.has_attachments === 1,
          })),
        };
      } catch (error) {
        console.error("Fetch emails error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      query: t.Object({
        folder: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Emails"],
        summary: "Get emails",
        description: "Returns emails for the authenticated user. Optionally filter by folder.",
      },
    }
  )

  /**
   * GET /api/emails/counts
   * Get email counts by folder for the authenticated user
   */
  .get(
    "/counts",
    async ({ headers }) => {
      try {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        const counts = emailQueries.getCountsByFolder.all(clerkUserId);

        // Convert to a more usable format
        const countsByFolder: Record<string, { total: number; unread: number }> = {};
        for (const folder of MAIL_FOLDERS) {
          countsByFolder[folder] = { total: 0, unread: 0 };
        }
        for (const count of counts) {
          countsByFolder[count.folder] = {
            total: count.total,
            unread: count.unread,
          };
        }

        return {
          success: true,
          counts: countsByFolder,
        };
      } catch (error) {
        console.error("Fetch counts error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Emails"],
        summary: "Get email counts by folder",
        description: "Returns total and unread email counts for each folder",
      },
    }
  )

  /**
   * GET /api/emails/:id/body
   * Get full email body (fetched on-demand from Microsoft Graph)
   */
  .get(
    "/:id/body",
    async ({ headers, params }) => {
      try {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get email from database to get outlook_id
        const email = emailQueries.getById.get(parseInt(params.id));

        if (!email || email.clerk_user_id !== clerkUserId) {
          return {
            success: false,
            error: "Email not found",
          };
        }

        // Fetch full body from Microsoft Graph
        const accessToken = await getMicrosoftToken(clerkUserId);
        const body = await fetchEmailBody(accessToken, email.outlook_id);

        return {
          success: true,
          body,
        };
      } catch (error) {
        console.error("Fetch body error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Emails"],
        summary: "Get email body",
        description: "Fetches full email body from Microsoft Graph API",
      },
    }
  )

  /**
   * PATCH /api/emails/:id/read
   * Mark email as read
   */
  .patch(
    "/:id/read",
    async ({ headers, params }) => {
      try {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get email from database
        const email = emailQueries.getById.get(parseInt(params.id));

        if (!email || email.clerk_user_id !== clerkUserId) {
          return {
            success: false,
            error: "Email not found",
          };
        }

        // Mark as read in Microsoft Graph
        const accessToken = await getMicrosoftToken(clerkUserId);
        await markEmailAsRead(accessToken, email.outlook_id);

        // Update local database
        emailQueries.markAsRead.run(parseInt(params.id));

        return {
          success: true,
        };
      } catch (error) {
        console.error("Mark as read error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Emails"],
        summary: "Mark email as read",
        description: "Marks an email as read in both Graph API and local database",
      },
    }
  )

  /**
   * POST /api/emails/send
   * Send a new email
   */
  .post(
    "/send",
    async ({ headers, body }) => {
      try {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        const { to, subject, body: emailBody } = body as {
          to: string[];
          subject: string;
          body: string;
        };

        // Send email via Microsoft Graph
        const accessToken = await getMicrosoftToken(clerkUserId);
        await sendEmail(accessToken, to, subject, emailBody);

        return {
          success: true,
        };
      } catch (error) {
        console.error("Send email error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        to: t.Array(t.String()),
        subject: t.String(),
        body: t.String(),
      }),
      detail: {
        tags: ["Emails"],
        summary: "Send email",
        description: "Sends a new email via Microsoft Graph API",
      },
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
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get email from database
        const email = emailQueries.getById.get(parseInt(params.id));

        if (!email || email.clerk_user_id !== clerkUserId) {
          return {
            success: false,
            error: "Email not found",
          };
        }

        const { folder } = body as { folder: string };

        // Validate folder
        if (!MAIL_FOLDERS.includes(folder as MailFolder)) {
          return {
            success: false,
            error: `Invalid folder. Must be one of: ${MAIL_FOLDERS.join(", ")}`,
          };
        }

        // Move email in Microsoft Graph
        const accessToken = await getMicrosoftToken(clerkUserId);
        await moveEmail(accessToken, email.outlook_id, folder as GraphMailFolder);

        // Update local database
        emailQueries.updateFolder.run(folder, parseInt(params.id));

        return {
          success: true,
        };
      } catch (error) {
        console.error("Move email error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        folder: t.String(),
      }),
      detail: {
        tags: ["Emails"],
        summary: "Move email to folder",
        description: "Moves an email to a different folder in both Graph API and local database",
      },
    }
  )

  /**
   * DELETE /api/emails/:id
   * Delete email permanently
   */
  .delete(
    "/:id",
    async ({ headers, params }) => {
      try {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return {
            success: false,
            error: "Missing or invalid Authorization header",
          };
        }

        const sessionToken = authHeader.replace("Bearer ", "");
        const clerkUserId = await verifyClerkToken(sessionToken);

        // Get email from database
        const email = emailQueries.getById.get(parseInt(params.id));

        if (!email || email.clerk_user_id !== clerkUserId) {
          return {
            success: false,
            error: "Email not found",
          };
        }

        // Delete from Microsoft Graph
        const accessToken = await getMicrosoftToken(clerkUserId);
        await deleteEmail(accessToken, email.outlook_id);

        // Delete from local database
        emailQueries.delete.run(parseInt(params.id));

        return {
          success: true,
        };
      } catch (error) {
        console.error("Delete email error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Emails"],
        summary: "Delete email permanently",
        description: "Permanently deletes an email from both Graph API and local database",
      },
    }
  );
