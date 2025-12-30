import { Client } from "@microsoft/microsoft-graph-client";

/**
 * Create Microsoft Graph API client with access token
 */
export function createGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Fetch emails from Microsoft Graph API
 */
export async function fetchEmails(accessToken: string, top = 50) {
  const client = createGraphClient(accessToken);

  const response = await client
    .api("/me/messages")
    .top(top)
    .select([
      "id",
      "conversationId",
      "internetMessageId",
      "subject",
      "bodyPreview",
      "from",
      "toRecipients",
      "ccRecipients",
      "isRead",
      "hasAttachments",
      "importance",
      "receivedDateTime",
      "sentDateTime",
    ])
    .orderby("receivedDateTime DESC")
    .get();

  return response.value;
}

/**
 * Fetch email body (on-demand)
 */
export async function fetchEmailBody(accessToken: string, emailId: string) {
  const client = createGraphClient(accessToken);

  const response = await client
    .api(`/me/messages/${emailId}`)
    .select(["body", "id"])
    .get();

  return response.body;
}

/**
 * Update email read status
 */
export async function updateEmailReadStatus(
  accessToken: string,
  emailId: string,
  isRead: boolean
) {
  const client = createGraphClient(accessToken);

  await client.api(`/me/messages/${emailId}`).patch({
    isRead,
  });
}

/**
 * Update email flag status
 * Microsoft Graph uses flagStatus: notFlagged, flagged, complete
 */
export async function updateEmailFlag(
  accessToken: string,
  emailId: string,
  flagStatus: "notFlagged" | "flagged" | "complete"
) {
  const client = createGraphClient(accessToken);

  await client.api(`/me/messages/${emailId}`).patch({
    flag: {
      flagStatus,
    },
  });
}

/**
 * Send email
 */
export async function sendEmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  bcc?: string[]
) {
  const client = createGraphClient(accessToken);

  const message: any = {
    subject,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: to.map((email) => ({
      emailAddress: { address: email },
    })),
  };

  if (cc && cc.length > 0) {
    message.ccRecipients = cc.map((email) => ({
      emailAddress: { address: email },
    }));
  }

  if (bcc && bcc.length > 0) {
    message.bccRecipients = bcc.map((email) => ({
      emailAddress: { address: email },
    }));
  }

  await client.api("/me/sendMail").post({
    message,
    saveToSentItems: true,
  });
}

/**
 * Supported mail folder names in Microsoft Graph API
 */
export type GraphMailFolder =
  | "inbox"
  | "sentitems"
  | "drafts"
  | "deleteditems"
  | "junkemail"
  | "archive";

/**
 * Get delta sync (incremental updates) for a specific folder
 */
export async function getDeltaEmails(
  accessToken: string,
  folder: GraphMailFolder = "inbox",
  deltaLink?: string
) {
  const client = createGraphClient(accessToken);

  let request = client.api(
    deltaLink || `/me/mailFolders/${folder}/messages/delta`
  );

  if (!deltaLink) {
    request = request
      .top(50)
      .select([
        "id",
        "conversationId",
        "internetMessageId",
        "subject",
        "bodyPreview",
        "from",
        "toRecipients",
        "ccRecipients",
        "isRead",
        "hasAttachments",
        "importance",
        "receivedDateTime",
        "sentDateTime",
      ]);
  }

  const response = await request.get();

  return {
    emails: response.value,
    nextLink: response["@odata.nextLink"],
    deltaLink: response["@odata.deltaLink"],
  };
}

/**
 * Move email to a different folder
 */
export async function moveEmail(
  accessToken: string,
  emailId: string,
  destinationFolder: GraphMailFolder
) {
  const client = createGraphClient(accessToken);

  const response = await client.api(`/me/messages/${emailId}/move`).post({
    destinationId: destinationFolder,
  });

  return response;
}

/**
 * Delete email (moves to Deleted Items)
 */
export async function deleteEmail(accessToken: string, emailId: string) {
  const client = createGraphClient(accessToken);
  await client.api(`/me/messages/${emailId}`).delete();
}

/**
 * Permanently delete email (bypasses Deleted Items, truly removes it)
 * Use this for emails already in Deleted Items folder
 */
export async function permanentDeleteEmail(
  accessToken: string,
  emailId: string
) {
  const client = createGraphClient(accessToken);
  await client.api(`/me/messages/${emailId}/permanentDelete`).post({});
}

/**
 * Subscription types
 */
export interface GraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState?: string;
}

/**
 * Create a webhook subscription for mail changes
 * Subscriptions expire after max 4230 minutes (~3 days) for mail
 */
export async function createSubscription(
  accessToken: string,
  notificationUrl: string,
  clientState: string
): Promise<GraphSubscription> {
  const client = createGraphClient(accessToken);

  // Calculate expiration (max 4230 minutes for mail, use 3 days)
  const expirationDateTime = new Date();
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 4230);

  const subscription = {
    changeType: "created,updated,deleted",
    notificationUrl,
    resource: "me/messages",
    expirationDateTime: expirationDateTime.toISOString(),
    clientState,
  };

  const response = await client.api("/subscriptions").post(subscription);
  return response;
}

/**
 * Renew a webhook subscription
 */
export async function renewSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<GraphSubscription> {
  const client = createGraphClient(accessToken);

  // Extend by another 4230 minutes
  const expirationDateTime = new Date();
  expirationDateTime.setMinutes(expirationDateTime.getMinutes() + 4230);

  const response = await client.api(`/subscriptions/${subscriptionId}`).patch({
    expirationDateTime: expirationDateTime.toISOString(),
  });

  return response;
}

/**
 * Delete a webhook subscription
 */
export async function deleteSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const client = createGraphClient(accessToken);
  await client.api(`/subscriptions/${subscriptionId}`).delete();
}

/**
 * Get all subscriptions for the user
 */
export async function listSubscriptions(
  accessToken: string
): Promise<GraphSubscription[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api("/subscriptions").get();
  return response.value || [];
}

/**
 * Reply to an email
 */
export async function replyToEmail(
  accessToken: string,
  emailId: string,
  comment: string,
  toRecipients?: string[]
) {
  const client = createGraphClient(accessToken);

  const replyContent: any = {
    comment,
  };

  if (toRecipients && toRecipients.length > 0) {
    replyContent.toRecipients = toRecipients.map((email) => ({
      emailAddress: { address: email },
    }));
  }

  await client.api(`/me/messages/${emailId}/reply`).post(replyContent);
}

/**
 * Reply all to an email (include original recipients)
 */
export async function replyAllToEmail(
  accessToken: string,
  emailId: string,
  comment: string
) {
  const client = createGraphClient(accessToken);

  await client.api(`/me/messages/${emailId}/replyAll`).post({
    comment,
  });
}

/**
 * Forward an email to recipients
 */
export async function forwardEmail(
  accessToken: string,
  emailId: string,
  toRecipients: string[],
  comment?: string
) {
  const client = createGraphClient(accessToken);

  const forwardContent: any = {
    toRecipients: toRecipients.map((email) => ({
      emailAddress: { address: email },
    })),
  };

  if (comment) {
    forwardContent.comment = comment;
  }

  await client.api(`/me/messages/${emailId}/forward`).post(forwardContent);
}

/**
 * Create a draft email
 */
export async function createDraft(
  accessToken: string,
  to: string[],
  subject: string,
  body: string,
  cc?: string[],
  bcc?: string[]
) {
  const client = createGraphClient(accessToken);

  const message: any = {
    subject,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: to.map((email) => ({
      emailAddress: { address: email },
    })),
  };

  if (cc && cc.length > 0) {
    message.ccRecipients = cc.map((email) => ({
      emailAddress: { address: email },
    }));
  }

  if (bcc && bcc.length > 0) {
    message.bccRecipients = bcc.map((email) => ({
      emailAddress: { address: email },
    }));
  }

  const response = await client.api("/me/messages").post(message);
  return response.id;
}

/**
 * Send a draft email
 */
export async function sendDraft(accessToken: string, draftId: string) {
  const client = createGraphClient(accessToken);
  await client.api(`/me/messages/${draftId}/send`).post({});
}

/**
 * List attachments for an email
 */
export async function listAttachments(accessToken: string, emailId: string) {
  const client = createGraphClient(accessToken);

  const response = await client
    .api(`/me/messages/${emailId}/attachments`)
    .select(["id", "name", "contentType", "size", "isInline"])
    .get();

  return response.value || [];
}

/**
 * Get attachment content (returns binary data)
 */
export async function getAttachment(
  accessToken: string,
  emailId: string,
  attachmentId: string
) {
  const client = createGraphClient(accessToken);

  const response = await client
    .api(`/me/messages/${emailId}/attachments/${attachmentId}`)
    .get();

  return response;
}

/**
 * Add attachment to a draft email
 */
export async function addAttachment(
  accessToken: string,
  draftId: string,
  fileName: string,
  contentBytes: Buffer,
  contentType: string
) {
  const client = createGraphClient(accessToken);

  const attachment = {
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: fileName,
    contentBytes: contentBytes.toString("base64"),
    contentType,
  };

  const response = await client
    .api(`/me/messages/${draftId}/attachments`)
    .post(attachment);

  return response.id;
}

/**
 * Search emails using KQL (Keyword Query Language)
 * Example: "subject:project AND from:john@example.com"
 */
export async function searchEmails(
  accessToken: string,
  query: string,
  top = 50
) {
  const client = createGraphClient(accessToken);

  const response = await client
    .api("/me/messages")
    .top(top)
    .search(`"${query}"`)
    .select([
      "id",
      "conversationId",
      "internetMessageId",
      "subject",
      "bodyPreview",
      "from",
      "toRecipients",
      "ccRecipients",
      "isRead",
      "hasAttachments",
      "importance",
      "receivedDateTime",
      "sentDateTime",
    ])
    .orderby("receivedDateTime DESC")
    .get();

  return response.value || [];
}
