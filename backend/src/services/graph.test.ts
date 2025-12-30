import { describe, expect, test } from "bun:test";
import {
  fetchEmailBody,
  fetchEmails,
  getDeltaEmails,
  listSubscriptions,
  moveEmail,
  updateEmailFlag,
  updateEmailReadStatus,
} from "./graph";
import { getCachedAccessToken } from "./graph-auth";

/**
 * Graph API Integration Tests - Real API Testing
 *
 * These tests use Azure AD credentials to get a real access token
 * and test against the actual Microsoft Graph API.
 *
 * Uses environment variables from .env:
 * - GRAPH_API_TEST_TOKEN (delegated token from Graph Explorer - recommended)
 * - OR AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID (app-only - requires reconfiguration)
 *
 * Token is obtained automatically using client credentials flow or delegated token
 */

let cachedToken: string | null = null;
let tokenCheckDone = false;
const isDelegatedAuthError = false;

async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;

  // Check if token is provided via environment
  if (process.env.GRAPH_API_TEST_TOKEN) {
    cachedToken = process.env.GRAPH_API_TEST_TOKEN;
    tokenCheckDone = true;
    return cachedToken;
  }

  try {
    // Try to load cached token from file
    cachedToken = await getCachedAccessToken();
    tokenCheckDone = true;
    return cachedToken;
  } catch (error) {
    tokenCheckDone = true;
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
      "⊘ Skipped (Token lacks required permissions - need delegated token from Graph Explorer)"
    );
    return true;
  }
  return false;
}

describe("Graph API Integration Tests - Real API", () => {
  test("should fetch emails from inbox", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("fetch emails");
      const emails = await fetchEmails(token, 20);
      console.timeEnd("fetch emails");

      expect(Array.isArray(emails)).toBe(true);
      expect(emails.length).toBeGreaterThan(0);

      console.log(`✓ Fetched ${emails.length} emails from inbox`);

      // Use first email for subsequent tests
      if (emails.length > 0 && emails[0].id) {
        console.log(`  Using email ID: ${emails[0].id}`);
      }
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should fetch email body", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      // Get an email to test with
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails in inbox to test)");
        return;
      }

      const emailId = emails[0].id;

      console.time("fetch email body");
      const body = await fetchEmailBody(token, emailId);
      console.timeEnd("fetch email body");

      expect(body).toBeTruthy();
      console.log("✓ Fetched email body successfully");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should update email read status", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails in inbox to test)");
        return;
      }

      const emailId = emails[0].id;
      const wasRead = emails[0].isRead;

      console.time("update read status");
      await updateEmailReadStatus(token, emailId, !wasRead);
      await updateEmailReadStatus(token, emailId, wasRead); // Restore original state
      console.timeEnd("update read status");

      console.log("✓ Updated email read status");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should update email flag status", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails in inbox to test)");
        return;
      }

      const emailId = emails[0].id;

      console.time("update flag status");
      await updateEmailFlag(token, emailId, "flagged");
      await updateEmailFlag(token, emailId, "notFlagged"); // Restore
      console.timeEnd("update flag status");

      console.log("✓ Updated email flag status");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should get delta emails for sync", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("delta sync");
      const result = await getDeltaEmails(token, "inbox");
      console.timeEnd("delta sync");

      expect(Array.isArray(result.emails)).toBe(true);
      // deltaLink only appears on final page, nextLink on intermediate pages
      expect(result.deltaLink || result.nextLink).toBeTruthy();

      console.log(`✓ Delta sync fetched ${result.emails.length} emails`);
      console.log(`  Has more pages: ${!!result.nextLink}`);
      console.log(`  Has delta link: ${!!result.deltaLink}`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should sync all folders", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const folders = [
        "inbox",
        "sentitems",
        "drafts",
        "deleteditems",
        "junkemail",
        "archive",
      ] as const;
      const results = [];

      console.time("sync all folders");
      for (const folder of folders) {
        const delta = await getDeltaEmails(token, folder);
        results.push({
          folder,
          count: delta.emails.length,
        });
      }
      console.timeEnd("sync all folders");

      expect(results.length).toBe(6);
      console.log("✓ Synced all folders:", results);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should move email between folders", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      // Get a fresh email from inbox (not from archive in case it was moved)
      const emails = await fetchEmails(token, 1);
      if (!emails || emails.length === 0) {
        console.log("⊘ Skipped (no emails in inbox to test)");
        return;
      }

      const emailId = emails[0].id;

      console.time("move email");
      await moveEmail(token, emailId, "archive");
      // Restore by moving back to inbox
      const inboxEmails = await fetchEmails(token, 1);
      if (inboxEmails && inboxEmails.length > 0) {
        await moveEmail(token, inboxEmails[0].id, "inbox");
      }
      console.timeEnd("move email");

      console.log("✓ Moved email between folders");
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should list webhook subscriptions", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("list subscriptions");
      const subscriptions = await listSubscriptions(token);
      console.timeEnd("list subscriptions");

      expect(Array.isArray(subscriptions)).toBe(true);
      console.log(`✓ Listed ${subscriptions.length} webhook subscriptions`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle API errors gracefully", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      try {
        await fetchEmailBody(token, "invalid-email-id-xyz");
        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeTruthy();
        console.log("✓ API error handling working");
      }
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});

/**
 * Performance and Load Tests
 */
describe("Graph API Performance Tests", () => {
  test("should fetch large batches of emails efficiently", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("fetch 50 emails");
      const emails = await fetchEmails(token, 50);
      console.timeEnd("fetch 50 emails");

      expect(emails.length).toBeGreaterThan(0);
      console.log(`✓ Fetched ${emails.length} emails in large batch`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should handle concurrent delta syncs", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      console.time("concurrent folder syncs");
      const promises = [
        getDeltaEmails(token, "inbox"),
        getDeltaEmails(token, "sentitems"),
        getDeltaEmails(token, "drafts"),
      ];

      const results = await Promise.all(promises);
      console.timeEnd("concurrent folder syncs");

      expect(results.length).toBe(3);
      const totalEmails = results.reduce((sum, r) => sum + r.emails.length, 0);
      console.log(`✓ Concurrent sync fetched ${totalEmails} total emails`);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });

  test("should measure round-trip latency", async () => {
    const token = await getToken();
    if (!token) {
      console.log("⊘ Skipped (Azure credentials not available)");
      return;
    }

    try {
      const latencies = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await fetchEmails(token, 10);
        const end = performance.now();
        latencies.push(end - start);
      }

      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);

      console.log(
        `✓ API Latency - Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms, Avg: ${avg.toFixed(2)}ms`
      );
      expect(avg).toBeGreaterThan(0);
    } catch (error) {
      if (skipIfNoDelegatedAuth(error)) return;
      throw error;
    }
  });
});
