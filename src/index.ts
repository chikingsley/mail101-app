import { serve } from "bun";
import homepage from "./index.html";

// Lazy load the database to avoid conflicts with the HTML bundler
// Using the census from desert-services-hub (the actively maintained one)
let db: typeof import("@census/db/index") | null = null;

async function getDb() {
  if (!db) {
    db = await import("@census/db/index");
  }
  return db;
}

// Helper to create JSON response
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Helper to parse query params from request
function getQueryParams(req: Request) {
  const url = new URL(req.url);
  const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const query = url.searchParams.get("q") ?? "";
  const mailbox = url.searchParams.get("mailbox") ?? "";
  return { limit, offset, query, mailbox };
}

// Your actionable mailboxes (can write/triage these)
const ACTIONABLE_MAILBOXES = [
  "chi@desertservices.net",
  "contracts@desertservices.net",
  "dustpermits@desertservices.net",
];

const server = serve({
  routes: {
    // ============================================
    // API: Mailboxes
    // ============================================
    "/api/mailboxes": async () => {
      const census = await getDb();
      const mailboxes = census.getAllMailboxes();
      
      // Get actual email counts from DB (mailbox.emailCount can be stale)
      const mailboxesWithActualCounts = mailboxes.map((mb) => {
        const actualCount = census.db
          .query("SELECT COUNT(*) as c FROM emails WHERE mailbox_id = ?")
          .get(mb.id) as { c: number };
        return {
          ...mb,
          emailCount: actualCount.c, // Override with actual count
        };
      });
      
      return json({
        mailboxes: mailboxesWithActualCounts,
        actionable: ACTIONABLE_MAILBOXES,
      });
    },

    // ============================================
    // API: Emails
    // ============================================
    "/api/emails": async (req) => {
      const { limit, mailbox } = getQueryParams(req);
      const census = await getDb();
      
      // If mailbox specified, filter by it
      if (mailbox) {
        const mb = census.getMailbox(mailbox);
        if (mb) {
          const emails = census.db
            .query(
              `SELECT * FROM emails WHERE mailbox_id = ? ORDER BY received_at DESC LIMIT ?`
            )
            .all(mb.id, limit);
          // Parse emails
          const parsedEmails = emails.map((row: Record<string, unknown>) => ({
            id: row.id as number,
            messageId: row.message_id as string,
            mailboxId: row.mailbox_id as number,
            conversationId: row.conversation_id as string | null,
            subject: row.subject as string | null,
            fromEmail: row.from_email as string | null,
            fromName: row.from_name as string | null,
            toEmails: JSON.parse((row.to_emails as string) || "[]"),
            ccEmails: JSON.parse((row.cc_emails as string) || "[]"),
            receivedAt: row.received_at as string,
            hasAttachments: row.has_attachments === 1,
            attachmentNames: JSON.parse((row.attachment_names as string) || "[]"),
            bodyPreview: row.body_preview as string | null,
            webUrl: row.web_url as string | null,
            classification: row.classification as string | null,
            classificationConfidence: row.classification_confidence as number | null,
            classificationMethod: row.classification_method as string | null,
            projectName: row.project_name as string | null,
            contractorName: row.contractor_name as string | null,
            mondayEstimateId: row.monday_estimate_id as string | null,
            notionProjectId: row.notion_project_id as string | null,
            accountId: row.account_id as number | null,
            projectId: row.project_id as number | null,
            bodyFull: row.body_full as string | null,
            bodyHtml: row.body_html as string | null,
            categories: JSON.parse((row.categories as string) || "[]"),
            createdAt: row.created_at as string,
          }));
          return json({ 
            emails: parsedEmails, 
            total: mb.emailCount,
            mailbox: mb,
          });
        }
      }
      
      // Default: get recent emails from actionable mailboxes only
      const emails = census.getRecentEmails(limit);
      return json({ emails, total: census.getTotalEmailCount() });
    },

    "/api/emails/search": async (req) => {
      const { query, limit } = getQueryParams(req);
      if (!query) {
        return json({ error: "Query parameter 'q' is required" }, 400);
      }
      const census = await getDb();
      const results = census.searchEmailsFullText(query, limit);
      return json({ results });
    },

    "/api/emails/:id": async (req) => {
      const id = Number.parseInt(req.params.id, 10);
      const census = await getDb();
      const email = census.getEmailById(id);
      if (!email) {
        return json({ error: "Email not found" }, 404);
      }
      const attachments = census.getAttachmentsForEmail(id);
      return json({ email, attachments });
    },

    "/api/emails/:id/link": {
      async POST(req) {
        const id = Number.parseInt(req.params.id, 10);
        const body = (await req.json()) as { projectId?: number };
        const projectId = body.projectId;

        if (!projectId) {
          return json({ error: "projectId is required" }, 400);
        }

        const census = await getDb();
        census.linkEmailToProject(id, projectId);
        const email = census.getEmailById(id);
        return json({ success: true, email });
      },
    },

    "/api/emails/:id/classify": {
      async POST(req) {
        const id = Number.parseInt(req.params.id, 10);
        const body = (await req.json()) as { classification?: string };
        const classification =
          body.classification as import("@census/db/index").EmailClassification;

        if (!classification) {
          return json({ error: "classification is required" }, 400);
        }

        const census = await getDb();
        census.updateEmailClassification(id, classification, 1.0, "pattern");
        const email = census.getEmailById(id);
        return json({ success: true, email });
      },
    },

    // ============================================
    // API: Accounts (Contractors)
    // ============================================
    "/api/accounts": async () => {
      const census = await getDb();
      const accounts = census.getAllAccounts();
      return json({ accounts });
    },

    "/api/accounts/by-id/:id": async (req) => {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return json({ error: "Invalid account ID" }, 400);
      }
      const census = await getDb();
      
      // Query account by ID directly
      const row = census.db
        .query("SELECT * FROM accounts WHERE id = ?")
        .get(id) as Record<string, unknown> | null;
      
      if (!row) {
        return json({ error: "Account not found" }, 404);
      }
      
      // Parse account row
      const account = {
        id: row.id as number,
        domain: row.domain as string,
        name: row.name as string,
        type: row.type as string,
        contactCount: row.contact_count as number,
        emailCount: row.email_count as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
      
      const projects = census.getProjectsForAccount(id);
      const emails = census.getEmailsForAccount(id);
      return json({ account, projects, emails: emails.slice(0, 50) });
    },

    "/api/accounts/:domain": async (req) => {
      const domain = decodeURIComponent(req.params.domain);
      const census = await getDb();
      const account = census.getAccountByDomain(domain);
      if (!account) {
        return json({ error: "Account not found" }, 404);
      }
      const projects = census.getProjectsForAccount(account.id);
      const emails = census.getEmailsForAccount(account.id);
      return json({ account, projects, emails: emails.slice(0, 50) });
    },

    // ============================================
    // API: Projects
    // ============================================
    "/api/projects": async () => {
      const census = await getDb();
      const projects = census.getAllProjects();
      return json({ projects });
    },

    "/api/projects/:id": async (req) => {
      const id = Number.parseInt(req.params.id, 10);
      const census = await getDb();
      const project = census.getProjectById(id);
      if (!project) {
        return json({ error: "Project not found" }, 404);
      }
      const emails = census.getEmailsForProject(id);
      return json({ project, emails });
    },

    // ============================================
    // API: Estimates
    // ============================================
    "/api/estimates": async () => {
      const census = await getDb();
      const estimates = census.getAllEstimates();
      return json({ estimates });
    },

    // ============================================
    // API: Stats
    // ============================================
    "/api/stats": async () => {
      const census = await getDb();
      const totalEmails = census.getTotalEmailCount();
      const classifications = census.getClassificationDistribution();
      const accounts = census.getAllAccounts();
      const projects = census.getAllProjects();
      const estimates = census.getAllEstimates();

      return json({
        totalEmails,
        totalAccounts: accounts.length,
        totalProjects: projects.length,
        totalEstimates: estimates.length,
        classifications,
      });
    },

    // ============================================
    // API: Smart Linking
    // ============================================
    "/api/linking/suggest/:emailId": async (req) => {
      const emailId = Number.parseInt(req.params.emailId, 10);
      const census = await getDb();
      const email = census.getEmailById(emailId);
      if (!email) {
        return json({ error: "Email not found" }, 404);
      }

      const suggestions: Array<{
        projectId: number;
        reason: string;
        confidence: number;
        signalType: "conversation" | "sender" | "domain" | "subject";
      }> = [];

      // Signal 1: Check conversation thread (highest confidence)
      if (email.conversationId) {
        const linkedProjectId = census.getLinkedConversationSibling(
          email.conversationId
        );
        if (linkedProjectId) {
          suggestions.push({
            projectId: linkedProjectId,
            reason: "Same conversation thread",
            confidence: 0.95,
            signalType: "conversation",
          });
        }
      }

      // Signal 2: Check sender history
      if (email.fromEmail) {
        const senderStats = census.getSenderProjectStats(email.fromEmail);
        if (senderStats && senderStats.percentage > 0.5) {
          if (!suggestions.some((s) => s.projectId === senderStats.projectId)) {
            suggestions.push({
              projectId: senderStats.projectId,
              reason: `Sender typically emails about this project (${Math.round(senderStats.percentage * 100)}%)`,
              confidence: senderStats.percentage * 0.8,
              signalType: "sender",
            });
          }
        }
      }

      // Signal 3: Check domain-based projects
      if (email.fromEmail) {
        const domain = email.fromEmail.split("@")[1];
        if (domain) {
          const account = census.getAccountByDomain(domain);
          if (account) {
            const accountProjects = census.getProjectsForAccount(account.id);
            // Add top 3 most recent projects for this account
            for (const proj of accountProjects.slice(0, 3)) {
              if (!suggestions.some((s) => s.projectId === proj.id)) {
                suggestions.push({
                  projectId: proj.id,
                  reason: `From ${account.name} (${proj.emailCount} related emails)`,
                  confidence: 0.5 + (proj.emailCount > 10 ? 0.2 : proj.emailCount * 0.02),
                  signalType: "domain",
                });
              }
            }
          }
        }
      }

      // Signal 4: Check subject line for project name matches
      // Note: Heavy lifting should be in census sync, not UI
      // This just shows what the DB has linked
      if (email.subject) {
        const allProjects = census.getAllProjectNames();
        const lowerSubject = email.subject.toLowerCase();
        for (const [projectId, projectName] of allProjects) {
          if (
            projectName.length > 4 &&
            lowerSubject.includes(projectName.toLowerCase())
          ) {
            if (!suggestions.some((s) => s.projectId === projectId)) {
              suggestions.push({
                projectId,
                reason: `Project name "${projectName}" found in subject`,
                confidence: 0.7,
                signalType: "subject",
              });
            }
          }
        }
      }

      // Sort by confidence and limit to top 5
      suggestions.sort((a, b) => b.confidence - a.confidence);
      const topSuggestions = suggestions.slice(0, 5);

      // Get project details for suggestions
      const suggestionsWithDetails = topSuggestions.map((s) => ({
        ...s,
        project: census.getProjectById(s.projectId),
      }));

      return json({ suggestions: suggestionsWithDetails });
    },

    // ============================================
    // Fallback: Serve index.html for SPA routing
    // ============================================
    "/*": homepage,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
