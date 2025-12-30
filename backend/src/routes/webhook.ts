import crypto from "node:crypto";
import { Elysia, t } from "elysia";
import {
  emailQueries,
  MAIL_FOLDERS,
  subscriptionQueries,
  syncQueries,
  userQueries,
} from "../db/db";
import { getMicrosoftToken, verifyClerkToken } from "../services/clerk";
import {
  createSubscription,
  deleteSubscription,
  type GraphMailFolder,
  getDeltaEmails,
  renewSubscription,
} from "../services/graph";

// Webhook URL (set via environment variable)
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "https://webhook.peacockery.studio/api/emails/webhook";

// Generate a secure client state for webhook validation
function generateClientState(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Process a single notification - trigger sync for affected folder
async function processNotification(
  clerkUserId: string,
  resource: string,
  changeType: string
) {
  console.log(
    `Processing notification for user ${clerkUserId}: ${changeType} on ${resource}`
  );

  try {
    // Get user from database
    const user = await userQueries.getByClerkId(clerkUserId);
    if (!user) {
      console.error(`User not found for clerk ID: ${clerkUserId}`);
      return;
    }

    // Get Microsoft token for this user
    const accessToken = await getMicrosoftToken(clerkUserId);

    // Determine which folder was affected (inbox is default)
    // The resource format is "Users/{user-id}/messages/{message-id}"
    // We'll sync all folders to catch moves between folders
    for (const folder of MAIL_FOLDERS) {
      const syncState = await syncQueries.getByUserAndFolder(user.id, folder);

      // Sync whether or not we have a delta_link
      // If no delta_link, this will be a fresh sync and establish one
      try {
        const deltaResult = await getDeltaEmails(
          accessToken,
          folder as GraphMailFolder,
          syncState?.delta_link || undefined // Pass undefined for fresh sync
        );

        // Process emails
        let inserted = 0;
        let updated = 0;
        let removed = 0;

        for (const email of deltaResult.emails) {
          if (email["@removed"]) {
            try {
              await emailQueries.deleteByOutlookId(user.id, email.id);
              removed++;
            } catch (_err) {
              // Email might not exist locally
            }
            continue;
          }

          try {
            const result = await emailQueries.insert(user.id, {
              outlook_id: email.id,
              conversation_id: email.conversationId || undefined,
              internet_message_id: email.internetMessageId || undefined,
              folder,
              from_email: email.from?.emailAddress?.address || "",
              from_name: email.from?.emailAddress?.name || undefined,
              subject: email.subject || undefined,
              body_preview: email.bodyPreview || undefined,
              to_emails:
                email.toRecipients?.map((r: any) => r.emailAddress?.address) ||
                [],
              cc_emails:
                email.ccRecipients?.map((r: any) => r.emailAddress?.address) ||
                [],
              is_read: email.isRead,
              has_attachments: email.hasAttachments,
              importance: email.importance || "normal",
              received_at: email.receivedDateTime,
              sent_at: email.sentDateTime || undefined,
            });

            if (result) {
              inserted++;
            } else {
              // Email already exists - update it
              await emailQueries.updateFromSync(
                user.id,
                email.id,
                email.isRead
              );
              updated++;
            }
          } catch (err) {
            console.error(`Failed to process email ${email.id}:`, err);
          }
        }

        // Update delta link
        if (deltaResult.deltaLink) {
          await syncQueries.upsert(user.id, folder, deltaResult.deltaLink);
        }

        if (inserted > 0 || updated > 0 || removed > 0) {
          console.log(
            `Folder ${folder}: inserted=${inserted}, updated=${updated}, removed=${removed}`
          );
        }
      } catch (err) {
        console.error(`Error processing folder ${folder}:`, err);
      }
    }
  } catch (error) {
    console.error(
      `Failed to process notification for user ${clerkUserId}:`,
      error
    );
  }
}

export const webhookRoutes = new Elysia({ prefix: "/api/emails" })
  /**
   * POST /api/emails/webhook
   * Microsoft Graph sends notifications here
   * Also handles validation requests (with validationToken query param)
   */
  .post(
    "/webhook",
    async ({ query, body, set }) => {
      // Validation request - Microsoft sends this when creating subscription
      if (query.validationToken) {
        console.log("Webhook validation request received");
        set.headers["content-type"] = "text/plain";
        return query.validationToken;
      }

      // Actual notification
      const notification = body as {
        value: Array<{
          subscriptionId: string;
          clientState?: string;
          changeType: string;
          resource: string;
          resourceData?: {
            "@odata.type": string;
            id: string;
          };
        }>;
      };

      console.log(
        `Received ${notification.value?.length || 0} webhook notifications`
      );

      // Process notifications asynchronously (respond quickly to Microsoft)
      for (const item of notification.value || []) {
        // Verify client state matches our stored subscription
        const subscription = await subscriptionQueries.getById(
          item.subscriptionId
        );

        if (!subscription) {
          console.warn(`Unknown subscription: ${item.subscriptionId}`);
          continue;
        }

        if (
          subscription.client_state &&
          subscription.client_state !== item.clientState
        ) {
          console.warn(
            `Client state mismatch for subscription ${item.subscriptionId}`
          );
          continue;
        }

        // Process notification in background (don't await)
        processNotification(
          subscription.clerk_user_id,
          item.resource,
          item.changeType
        ).catch(console.error);
      }

      // Respond with 202 Accepted
      set.status = 202;
      return "";
    },
    {
      query: t.Object({
        validationToken: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Webhooks"],
        summary: "Receive Microsoft Graph notifications",
      },
    }
  )

  /**
   * POST /api/emails/subscribe
   * Create a webhook subscription for the authenticated user
   */
  .post(
    "/subscribe",
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
        const accessToken = await getMicrosoftToken(clerkUserId);

        // Get user from database
        const user = await userQueries.getByClerkId(clerkUserId);
        if (!user) {
          return { success: false, error: "User not found" };
        }

        // Check if user already has a subscription
        const existingSubscriptions = await subscriptionQueries.getByUser(
          user.id
        );
        if (existingSubscriptions.length > 0) {
          // Try to renew existing subscription
          const existing = existingSubscriptions[0];
          try {
            const renewed = await renewSubscription(
              accessToken,
              existing.subscription_id
            );
            await subscriptionQueries.updateExpiration(
              existing.subscription_id,
              renewed.expirationDateTime
            );
            return {
              success: true,
              subscription: {
                id: existing.subscription_id,
                expirationDateTime: renewed.expirationDateTime,
              },
              message: "Subscription renewed",
            };
          } catch (_err) {
            // Subscription might have expired, delete and recreate
            console.log("Existing subscription invalid, creating new one");
            await subscriptionQueries.delete(existing.subscription_id);
          }
        }

        // Create new subscription
        const clientState = generateClientState();
        const subscription = await createSubscription(
          accessToken,
          WEBHOOK_URL,
          clientState
        );

        // Store subscription in database
        await subscriptionQueries.insert(
          user.id,
          subscription.id,
          subscription.resource,
          subscription.changeType,
          subscription.expirationDateTime,
          clientState
        );

        return {
          success: true,
          subscription: {
            id: subscription.id,
            expirationDateTime: subscription.expirationDateTime,
          },
          message: "Subscription created",
        };
      } catch (error) {
        console.error("Subscribe error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Webhooks"],
        summary: "Subscribe to email notifications",
      },
    }
  )

  /**
   * DELETE /api/emails/subscribe
   * Remove webhook subscription for the authenticated user
   */
  .delete(
    "/subscribe",
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
        const accessToken = await getMicrosoftToken(clerkUserId);

        // Get user from database
        const user = await userQueries.getByClerkId(clerkUserId);
        if (!user) {
          return { success: false, error: "User not found" };
        }

        // Get user's subscriptions
        const subscriptions = await subscriptionQueries.getByUser(user.id);

        for (const sub of subscriptions) {
          try {
            await deleteSubscription(accessToken, sub.subscription_id);
          } catch (_err) {
            // Subscription might already be deleted at Microsoft
          }
          await subscriptionQueries.delete(sub.subscription_id);
        }

        return {
          success: true,
          message: `Deleted ${subscriptions.length} subscription(s)`,
        };
      } catch (error) {
        console.error("Unsubscribe error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Webhooks"],
        summary: "Unsubscribe from email notifications",
      },
    }
  )

  /**
   * GET /api/emails/subscription
   * Get current subscription status for the authenticated user
   */
  .get(
    "/subscription",
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

        // Get user from database
        const user = await userQueries.getByClerkId(clerkUserId);
        if (!user) {
          return { success: false, error: "User not found" };
        }

        const subscriptions = await subscriptionQueries.getByUser(user.id);

        return {
          success: true,
          subscriptions: subscriptions.map((s) => ({
            id: s.subscription_id,
            resource: s.resource,
            expirationDateTime: s.expiration_time,
            isExpired: new Date(s.expiration_time) < new Date(),
          })),
        };
      } catch (error) {
        console.error("Get subscription error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    {
      detail: {
        tags: ["Webhooks"],
        summary: "Get subscription status",
      },
    }
  );
