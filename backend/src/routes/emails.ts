import { Elysia, t } from "elysia";
import { getMicrosoftToken, verifyClerkToken } from "../services/clerk";
import {
  fetchEmails,
  fetchEmailBody,
  markEmailAsRead,
  sendEmail,
  getDeltaEmails,
} from "../services/graph";
import { emailQueries, syncQueries } from "../db";

export const emailRoutes = new Elysia({ prefix: "/api/emails" })
  /**
   * POST /api/emails/sync
   * Sync emails from Microsoft Graph API to local database
   */
  .post(
    "/sync",
    async ({ headers }) => {
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

        // Check if we have a delta link for this user
        const syncState = syncQueries.getByUser.get(clerkUserId);

        let emails;
        let deltaLink;

        if (syncState?.delta_link) {
          // Use delta sync for incremental updates
          const deltaResult = await getDeltaEmails(
            accessToken,
            syncState.delta_link
          );
          emails = deltaResult.emails;
          deltaLink = deltaResult.deltaLink;
        } else {
          // First sync - fetch all emails
          const fetchResult = await getDeltaEmails(accessToken);
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
          syncQueries.upsert.run(clerkUserId, deltaLink);
        }

        return {
          success: true,
          synced: inserted,
          total: emails.length,
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
      detail: {
        tags: ["Emails"],
        summary: "Sync emails from Outlook",
        description:
          "Fetches emails from Microsoft Graph API and stores them in local database",
      },
    }
  )

  /**
   * GET /api/emails
   * Get all emails for the authenticated user
   */
  .get(
    "/",
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

        const emails = emailQueries.getAllByUser.all(clerkUserId);

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
      detail: {
        tags: ["Emails"],
        summary: "Get all emails",
        description: "Returns all emails for the authenticated user",
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
  );
