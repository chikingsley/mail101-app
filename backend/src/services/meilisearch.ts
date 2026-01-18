import { MeiliSearch, Index } from "meilisearch";

const MEILISEARCH_URL = process.env.MEILISEARCH_URL || "http://localhost:7700";
const MEILISEARCH_KEY = process.env.MEILISEARCH_KEY || "mail101-meili-dev-key";
const JINA_API_KEY = process.env.JINA_API_KEY;

// Initialize Meilisearch client
export const meili = new MeiliSearch({
  host: MEILISEARCH_URL,
  apiKey: MEILISEARCH_KEY,
});

// Email document structure for indexing
interface EmailDocument {
  id: string;
  user_id: string;
  outlook_id: string;
  conversation_id?: string;
  folder: string;
  from_email: string;
  from_name?: string;
  subject?: string;
  body_preview?: string;
  to_emails: string[];
  cc_emails: string[];
  is_read: boolean;
  has_attachments: boolean;
  importance: string;
  received_at: number; // Unix timestamp for filtering
  sent_at?: number;
}

// Index name
const EMAILS_INDEX = "emails";

// Initialize the emails index with settings
export async function initMeilisearch() {
  console.log("📂 Initializing Meilisearch...");

  try {
    // Create index if it doesn't exist
    await meili.createIndex(EMAILS_INDEX, { primaryKey: "id" });
  } catch {
    // Index may already exist
  }

  const index = meili.index(EMAILS_INDEX);

  // Configure index settings
  await index.updateSettings({
    // Searchable attributes in order of importance
    searchableAttributes: [
      "subject",
      "from_name",
      "from_email",
      "body_preview",
      "to_emails",
      "cc_emails",
    ],
    // Filterable attributes for scoping searches
    filterableAttributes: [
      "user_id",
      "folder",
      "is_read",
      "has_attachments",
      "importance",
      "received_at",
      "conversation_id",
    ],
    // Sortable attributes
    sortableAttributes: ["received_at", "sent_at"],
    // Typo tolerance
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8,
      },
    },
    // Pagination
    pagination: {
      maxTotalHits: 10000,
    },
  });

  // Configure embeddings if Jina API key is available
  if (JINA_API_KEY) {
    console.log("🔌 Configuring Jina embeddings...");
    try {
      // Meilisearch v1.8+ REST embedder for Jina
      await fetch(`${MEILISEARCH_URL}/indexes/${EMAILS_INDEX}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MEILISEARCH_KEY}`,
        },
        body: JSON.stringify({
          embedders: {
            jina: {
              source: "rest",
              url: "https://api.jina.ai/v1/embeddings",
              apiKey: JINA_API_KEY,
              dimensions: 768,
              documentTemplate: "{{doc.subject}} {{doc.from_name}} {{doc.body_preview}}",
              request: {
                model: "jina-embeddings-v3",
                input: ["{{text}}"],
              },
              response: {
                data: [{ embedding: "{{embedding}}" }],
              },
            },
          },
        }),
      });
      console.log("✅ Jina embeddings configured");
    } catch (err) {
      console.warn("⚠️ Could not configure Jina embeddings:", err);
    }
  }

  console.log("✅ Meilisearch initialized");
  return index;
}

// Get the emails index
export function getEmailsIndex(): Index<EmailDocument> {
  return meili.index(EMAILS_INDEX);
}

// Index a single email
export async function indexEmail(email: {
  id: string;
  user_id: string;
  outlook_id: string;
  conversation_id?: string;
  folder: string;
  from_email: string;
  from_name?: string;
  subject?: string;
  body_preview?: string;
  to_emails: string[];
  cc_emails: string[];
  is_read: boolean;
  has_attachments: boolean;
  importance: string;
  received_at: string;
  sent_at?: string;
}) {
  const index = getEmailsIndex();

  const doc: EmailDocument = {
    id: email.id,
    user_id: email.user_id,
    outlook_id: email.outlook_id,
    conversation_id: email.conversation_id,
    folder: email.folder,
    from_email: email.from_email,
    from_name: email.from_name,
    subject: email.subject,
    body_preview: email.body_preview,
    to_emails: email.to_emails,
    cc_emails: email.cc_emails,
    is_read: email.is_read,
    has_attachments: email.has_attachments,
    importance: email.importance,
    received_at: new Date(email.received_at).getTime(),
    sent_at: email.sent_at ? new Date(email.sent_at).getTime() : undefined,
  };

  await index.addDocuments([doc]);
}

// Index multiple emails in batch
export async function indexEmailsBatch(emails: EmailDocument[]) {
  const index = getEmailsIndex();
  await index.addDocuments(emails, { primaryKey: "id" });
}

// Remove email from index
export async function removeEmailFromIndex(emailId: string) {
  const index = getEmailsIndex();
  await index.deleteDocument(emailId);
}

// Search emails
export async function searchEmails(
  userId: string,
  query: string,
  options?: {
    folder?: string;
    isRead?: boolean;
    hasAttachments?: boolean;
    limit?: number;
    offset?: number;
    sort?: string[];
    hybrid?: boolean; // Use semantic search if available
  }
) {
  const index = getEmailsIndex();

  // Build filter
  const filters: string[] = [`user_id = "${userId}"`];

  if (options?.folder) {
    filters.push(`folder = "${options.folder}"`);
  }
  if (options?.isRead !== undefined) {
    filters.push(`is_read = ${options.isRead}`);
  }
  if (options?.hasAttachments !== undefined) {
    filters.push(`has_attachments = ${options.hasAttachments}`);
  }

  const searchParams: any = {
    filter: filters.join(" AND "),
    limit: options?.limit || 50,
    offset: options?.offset || 0,
    sort: options?.sort || ["received_at:desc"],
    attributesToHighlight: ["subject", "body_preview"],
    highlightPreTag: "<mark>",
    highlightPostTag: "</mark>",
  };

  // Enable hybrid search if Jina is configured and requested
  if (options?.hybrid && JINA_API_KEY) {
    searchParams.hybrid = {
      embedder: "jina",
      semanticRatio: 0.5, // 50% semantic, 50% keyword
    };
  }

  const results = await index.search(query, searchParams);

  return {
    hits: results.hits,
    total: results.estimatedTotalHits || 0,
    processingTime: results.processingTimeMs,
    query: results.query,
  };
}

// Faceted search for filters
export async function getEmailFacets(userId: string) {
  const index = getEmailsIndex();

  const results = await index.search("", {
    filter: `user_id = "${userId}"`,
    facets: ["folder", "is_read", "has_attachments", "importance"],
    limit: 0,
  });

  return results.facetDistribution;
}
