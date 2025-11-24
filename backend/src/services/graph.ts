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
export async function fetchEmails(accessToken: string, top: number = 50) {
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
 * Mark email as read
 */
export async function markEmailAsRead(accessToken: string, emailId: string) {
  const client = createGraphClient(accessToken);

  await client.api(`/me/messages/${emailId}`).patch({
    isRead: true,
  });
}

/**
 * Send email
 */
export async function sendEmail(
  accessToken: string,
  to: string[],
  subject: string,
  body: string
) {
  const client = createGraphClient(accessToken);

  const message = {
    subject,
    body: {
      contentType: "HTML",
      content: body,
    },
    toRecipients: to.map((email) => ({
      emailAddress: { address: email },
    })),
  };

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
 * Delete email permanently
 */
export async function deleteEmail(accessToken: string, emailId: string) {
  const client = createGraphClient(accessToken);
  await client.api(`/me/messages/${emailId}`).delete();
}
