import { Elysia, t } from "elysia";
import { userQueries } from "../db/db";
import {
  getClerkUser,
  getMicrosoftToken,
  verifyClerkToken,
} from "../services/clerk";
import {
  addAttachment,
  createDraft,
  forwardEmail,
  getAttachment,
  listAttachments,
  replyAllToEmail,
  replyToEmail,
  sendDraft,
  sendEmail,
} from "../services/graph";

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

export const composeRoutes = new Elysia({ prefix: "/api/compose" })
  /**
   * POST /api/compose/send
   * Send a new email
   */
  .post(
    "/send",
    async ({ headers, body }) => {
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

        // Validate recipients
        if (!body.to || body.to.length === 0) {
          return {
            success: false,
            error: "At least one recipient is required",
          };
        }

        if (!body.subject || typeof body.subject !== "string") {
          return { success: false, error: "Subject is required" };
        }

        if (!body.body || typeof body.body !== "string") {
          return { success: false, error: "Email body is required" };
        }

        // Send the email
        await sendEmail(
          accessToken,
          body.to,
          body.subject,
          body.body,
          body.cc,
          body.bcc
        );

        return { success: true };
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
        cc: t.Optional(t.Array(t.String())),
        bcc: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["Compose"], summary: "Send new email" },
    }
  )

  /**
   * POST /api/compose/reply
   * Reply to an email
   */
  .post(
    "/reply",
    async ({ headers, body }) => {
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

        if (!body.emailId) {
          return { success: false, error: "Email ID is required" };
        }

        if (!body.comment || typeof body.comment !== "string") {
          return { success: false, error: "Reply comment is required" };
        }

        await replyToEmail(
          accessToken,
          body.emailId,
          body.comment,
          body.toRecipients
        );

        return { success: true };
      } catch (error) {
        console.error("Reply error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        emailId: t.String(),
        comment: t.String(),
        toRecipients: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["Compose"], summary: "Reply to email" },
    }
  )

  /**
   * POST /api/compose/reply-all
   * Reply all to an email
   */
  .post(
    "/reply-all",
    async ({ headers, body }) => {
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

        if (!body.emailId) {
          return { success: false, error: "Email ID is required" };
        }

        if (!body.comment || typeof body.comment !== "string") {
          return { success: false, error: "Reply comment is required" };
        }

        await replyAllToEmail(accessToken, body.emailId, body.comment);

        return { success: true };
      } catch (error) {
        console.error("Reply all error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        emailId: t.String(),
        comment: t.String(),
      }),
      detail: { tags: ["Compose"], summary: "Reply all to email" },
    }
  )

  /**
   * POST /api/compose/forward
   * Forward an email
   */
  .post(
    "/forward",
    async ({ headers, body }) => {
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

        if (!body.emailId) {
          return { success: false, error: "Email ID is required" };
        }

        if (!body.toRecipients || body.toRecipients.length === 0) {
          return {
            success: false,
            error: "At least one recipient is required",
          };
        }

        await forwardEmail(
          accessToken,
          body.emailId,
          body.toRecipients,
          body.comment
        );

        return { success: true };
      } catch (error) {
        console.error("Forward error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      body: t.Object({
        emailId: t.String(),
        toRecipients: t.Array(t.String()),
        comment: t.Optional(t.String()),
      }),
      detail: { tags: ["Compose"], summary: "Forward email" },
    }
  )

  /**
   * POST /api/compose/draft
   * Create a draft email
   */
  .post(
    "/draft",
    async ({ headers, body }) => {
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

        if (!body.to || body.to.length === 0) {
          return {
            success: false,
            error: "At least one recipient is required",
          };
        }

        if (!body.subject || typeof body.subject !== "string") {
          return { success: false, error: "Subject is required" };
        }

        if (!body.body || typeof body.body !== "string") {
          return { success: false, error: "Email body is required" };
        }

        const draftId = await createDraft(
          accessToken,
          body.to,
          body.subject,
          body.body,
          body.cc,
          body.bcc
        );

        return { success: true, draftId };
      } catch (error) {
        console.error("Create draft error:", error);
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
        cc: t.Optional(t.Array(t.String())),
        bcc: t.Optional(t.Array(t.String())),
      }),
      detail: { tags: ["Compose"], summary: "Create draft email" },
    }
  )

  /**
   * POST /api/compose/draft/:id/send
   * Send a draft email
   */
  .post(
    "/draft/:id/send",
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

        await sendDraft(accessToken, params.id);

        return { success: true };
      } catch (error) {
        console.error("Send draft error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { tags: ["Compose"], summary: "Send draft email" },
    }
  )

  /**
   * GET /api/compose/:emailId/attachments
   * List attachments for an email
   */
  .get(
    "/:emailId/attachments",
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

        const attachments = await listAttachments(accessToken, params.emailId);

        return { success: true, attachments };
      } catch (error) {
        console.error("List attachments error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ emailId: t.String() }),
      detail: { tags: ["Compose"], summary: "List email attachments" },
    }
  )

  /**
   * GET /api/compose/:emailId/attachments/:attachmentId/download
   * Download an attachment
   */
  .get(
    "/:emailId/attachments/:attachmentId/download",
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

        const attachment = await getAttachment(
          accessToken,
          params.emailId,
          params.attachmentId
        );

        if (!(attachment && attachment.contentBytes)) {
          return { success: false, error: "Attachment not found" };
        }

        // Return the file with appropriate headers
        const buffer = Buffer.from(attachment.contentBytes, "base64");
        return new Response(buffer, {
          headers: {
            "Content-Type":
              attachment.contentType || "application/octet-stream",
            "Content-Disposition": `attachment; filename="${attachment.name}"`,
          },
        });
      } catch (error) {
        console.error("Download attachment error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({
        emailId: t.String(),
        attachmentId: t.String(),
      }),
      detail: { tags: ["Compose"], summary: "Download attachment" },
    }
  )

  /**
   * POST /api/compose/draft/:id/attachments
   * Upload attachment to a draft
   */
  .post(
    "/draft/:id/attachments",
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

        if (!body.fileName || typeof body.fileName !== "string") {
          return { success: false, error: "File name is required" };
        }

        if (!body.contentBytes) {
          return { success: false, error: "File content is required" };
        }

        // contentBytes should be base64-encoded string
        const content = Buffer.from(body.contentBytes, "base64");

        const attachmentId = await addAttachment(
          accessToken,
          params.id,
          body.fileName,
          content,
          body.contentType || "application/octet-stream"
        );

        return { success: true, attachmentId };
      } catch (error) {
        console.error("Upload attachment error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        fileName: t.String(),
        contentBytes: t.String(),
        contentType: t.Optional(t.String()),
      }),
      detail: { tags: ["Compose"], summary: "Upload attachment to draft" },
    }
  );
