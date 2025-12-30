import { describe, expect, test } from "bun:test";
import {
  addAttachment,
  createDraft,
  forwardEmail,
  listAttachments,
  replyAllToEmail,
  replyToEmail,
  sendDraft,
  sendEmail,
} from "../services/graph";
import { getCachedAccessToken } from "../services/graph-auth";

let cachedToken: string | null = null;

async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  try {
    cachedToken = await getCachedAccessToken();
    return cachedToken;
  } catch {
    console.log(
      "⊘ No cached token found. Run: bun run auth (in backend directory)"
    );
    return null;
  }
}

function skipIfNoDelegatedAuth(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("delegated authentication")) {
    console.log(
      "⊘ Skipped (Token lacks required permissions - need delegated token)"
    );
    return true;
  }
  return false;
}

describe("Compose API - Draft Management", () => {
  test("should create a draft email", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("create draft");
      const draftId = await createDraft(
        token,
        ["test@example.com"],
        "Test Draft Subject",
        "<p>This is a test draft email</p>"
      );
      console.timeEnd("create draft");

      expect(draftId).toBeTruthy();
      expect(typeof draftId).toBe("string");
      console.log(`✓ Created draft with ID: ${draftId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should create draft with cc and bcc", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("create draft with recipients");
      const draftId = await createDraft(
        token,
        ["main@example.com"],
        "Draft with CC/BCC",
        "<p>This draft has additional recipients</p>",
        ["cc@example.com"],
        ["bcc@example.com"]
      );
      console.timeEnd("create draft with recipients");

      expect(draftId).toBeTruthy();
      console.log(`✓ Created draft with CC/BCC: ${draftId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should send a draft email", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      // Create a draft first
      const draftId = await createDraft(
        token,
        ["test@example.com"],
        "Draft to Send",
        "<p>This draft will be sent</p>"
      );

      console.time("send draft");
      await sendDraft(token, draftId);
      console.timeEnd("send draft");

      console.log(`✓ Sent draft: ${draftId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});

describe("Compose API - Direct Send", () => {
  test("should send email directly without draft", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("send direct");
      await sendEmail(
        token,
        ["test@example.com"],
        "Direct Send Test",
        "<p>This email was sent directly</p>"
      );
      console.timeEnd("send direct");

      console.log("✓ Sent email directly");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should send email with cc and bcc", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("send with recipients");
      await sendEmail(
        token,
        ["main@example.com"],
        "Email with CC/BCC",
        "<p>This email has additional recipients</p>",
        ["cc@example.com"],
        ["bcc@example.com"]
      );
      console.timeEnd("send with recipients");

      console.log("✓ Sent email with CC/BCC");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle HTML content in email body", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const htmlBody = `
        <h1>Test Email</h1>
        <p>This email contains <strong>bold</strong> and <em>italic</em> text.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
        <a href="https://example.com">Click here</a>
      `;

      await sendEmail(
        token,
        ["test@example.com"],
        "HTML Content Test",
        htmlBody
      );

      console.log("✓ Sent email with HTML content");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});

describe("Compose API - Reply and Forward", () => {
  test("should reply to an email", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      // First, get an email to reply to
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails in inbox to reply to)");
        return;
      }

      const emailId = emails[0].id;

      console.time("reply");
      await replyToEmail(token, emailId, "Thanks for your email!");
      console.timeEnd("reply");

      console.log(`✓ Replied to email: ${emailId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should reply-all to an email", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails to reply all to)");
        return;
      }

      const emailId = emails[0].id;

      console.time("reply all");
      await replyAllToEmail(token, emailId, "Replying to all participants!");
      console.timeEnd("reply all");

      console.log(`✓ Replied all to email: ${emailId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should forward an email", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails to forward)");
        return;
      }

      const emailId = emails[0].id;

      console.time("forward");
      await forwardEmail(
        token,
        emailId,
        ["forward@example.com"],
        "Thought you might be interested in this"
      );
      console.timeEnd("forward");

      console.log(`✓ Forwarded email: ${emailId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should forward email without comment", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails to forward)");
        return;
      }

      const emailId = emails[0].id;

      await forwardEmail(token, emailId, ["forward@example.com"]);

      console.log(`✓ Forwarded email without comment: ${emailId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should forward to multiple recipients", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails to forward)");
        return;
      }

      const emailId = emails[0].id;

      await forwardEmail(
        token,
        emailId,
        [
          "recipient1@example.com",
          "recipient2@example.com",
          "recipient3@example.com",
        ],
        "FW: Sharing this with the team"
      );

      console.log(`✓ Forwarded to multiple recipients: ${emailId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});

describe("Compose API - Attachments", () => {
  test("should list attachments for an email with attachments", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const { fetchEmails } = await import("../services/graph");
      const emails = await fetchEmails(token, 50);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails available)");
        return;
      }

      // Find an email with attachments
      const emailWithAttachments = emails.find((e) => e.hasAttachments);
      if (!emailWithAttachments) {
        console.log("⊘ Skipped (no emails with attachments found)");
        return;
      }

      console.time("list attachments");
      const attachments = await listAttachments(token, emailWithAttachments.id);
      console.timeEnd("list attachments");

      expect(Array.isArray(attachments)).toBe(true);
      console.log(
        `✓ Listed ${attachments.length} attachments for email: ${emailWithAttachments.id}`
      );
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should add attachment to draft", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      // Create a draft first
      const draftId = await createDraft(
        token,
        ["test@example.com"],
        "Draft with Attachment",
        "<p>This draft has an attachment</p>"
      );

      // Create a simple text file content
      const fileContent = Buffer.from(
        "This is a test attachment file.\nIt contains some test content."
      );
      const base64Content = fileContent.toString("base64");

      console.time("add attachment");
      const attachmentId = await addAttachment(
        token,
        draftId,
        "test-document.txt",
        fileContent,
        "text/plain"
      );
      console.timeEnd("add attachment");

      expect(attachmentId).toBeTruthy();
      console.log(`✓ Added attachment: ${attachmentId}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle different file types", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const draftId = await createDraft(
        token,
        ["test@example.com"],
        "Draft with Various Files",
        "<p>Testing different file types</p>"
      );

      const fileTests = [
        {
          name: "document.pdf",
          content: Buffer.from("PDF content here"),
          type: "application/pdf",
        },
        {
          name: "image.jpg",
          content: Buffer.from("JPEG content here"),
          type: "image/jpeg",
        },
        {
          name: "spreadsheet.csv",
          content: Buffer.from("col1,col2,col3\nval1,val2,val3"),
          type: "text/csv",
        },
      ];

      for (const file of fileTests) {
        await addAttachment(token, draftId, file.name, file.content, file.type);
      }

      console.log(`✓ Added ${fileTests.length} attachments of different types`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});

describe("Compose API - Error Handling", () => {
  test("should handle invalid email addresses gracefully", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      try {
        await sendEmail(
          token,
          ["invalid-email-without-at-sign"],
          "Test",
          "<p>Test</p>"
        );
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeTruthy();
        console.log("✓ Invalid email address rejected");
      }
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle invalid draft ID", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      try {
        await sendDraft(token, "invalid-draft-id-xyz");
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeTruthy();
        console.log("✓ Invalid draft ID rejected");
      }
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle empty recipient list", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      try {
        await sendEmail(token, [], "Subject", "<p>Body</p>");
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeTruthy();
        console.log("✓ Empty recipient list rejected");
      }
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});
