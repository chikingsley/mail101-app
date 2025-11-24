import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

// Initialize database
const dbPath = process.env.NODE_ENV === "production"
  ? "./data/emails.db"
  : "./emails.db";

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.run("PRAGMA journal_mode = WAL;");

// Initialize schema FIRST
const schema = readFileSync(join(import.meta.dir, "schema.sql"), "utf-8");
db.run(schema);

export function initDatabase() {
  console.log("✅ Database initialized");
}

// Email queries
export const emailQueries = {
  // Get all emails for a user
  getAllByUser: db.query<
    {
      id: number;
      clerk_user_id: string;
      outlook_id: string;
      from_email: string;
      from_name: string | null;
      subject: string | null;
      body_preview: string | null;
      is_read: number;
      received_at: string;
    },
    [string]
  >(`
    SELECT * FROM emails
    WHERE clerk_user_id = ?
    ORDER BY received_at DESC
  `),

  // Get single email
  getById: db.query<
    {
      id: number;
      clerk_user_id: string;
      outlook_id: string;
      conversation_id: string | null;
      from_email: string;
      from_name: string | null;
      subject: string | null;
      body_preview: string | null;
      to_emails: string | null;
      cc_emails: string | null;
      is_read: number;
      has_attachments: number;
      importance: string;
      received_at: string;
      sent_at: string | null;
    },
    [number]
  >(`
    SELECT * FROM emails WHERE id = ?
  `),

  // Insert email
  insert: db.prepare(`
    INSERT INTO emails (
      clerk_user_id, outlook_id, conversation_id, internet_message_id,
      from_email, from_name, subject, body_preview,
      to_emails, cc_emails, is_read, has_attachments, importance,
      received_at, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Update read status
  markAsRead: db.prepare(`
    UPDATE emails SET is_read = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),

  // Delete email
  delete: db.prepare(`
    DELETE FROM emails WHERE id = ?
  `),
};

// Sync state queries
export const syncQueries = {
  // Get sync state for user
  getByUser: db.query<
    {
      id: number;
      clerk_user_id: string;
      delta_link: string | null;
      last_sync: string | null;
    },
    [string]
  >(`
    SELECT * FROM sync_state WHERE clerk_user_id = ?
  `),

  // Upsert sync state
  upsert: db.prepare(`
    INSERT INTO sync_state (clerk_user_id, delta_link, last_sync, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(clerk_user_id)
    DO UPDATE SET
      delta_link = excluded.delta_link,
      last_sync = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `),
};
