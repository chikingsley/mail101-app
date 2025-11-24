import { Database } from "bun:sqlite";

// Initialize database
const dbPath = process.env.NODE_ENV === "production"
  ? "./data/emails.db"
  : "./emails.db";

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.run("PRAGMA journal_mode = WAL;");

// Create tables (without folder initially for migration compatibility)
db.run(`
  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT NOT NULL,
    outlook_id TEXT UNIQUE NOT NULL,
    conversation_id TEXT,
    internet_message_id TEXT,
    from_email TEXT NOT NULL,
    from_name TEXT,
    subject TEXT,
    body_preview TEXT,
    to_emails TEXT,
    cc_emails TEXT,
    is_read INTEGER DEFAULT 0,
    has_attachments INTEGER DEFAULT 0,
    importance TEXT DEFAULT 'normal',
    received_at TEXT NOT NULL,
    sent_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clerk_user_id TEXT NOT NULL,
    delta_link TEXT,
    last_sync TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Run migrations IMMEDIATELY (before queries are prepared)
// Migration 1: Add folder column to emails table
try {
  db.run("ALTER TABLE emails ADD COLUMN folder TEXT DEFAULT 'inbox'");
  console.log("✅ Migration: Added folder column to emails");
} catch (err) {
  // Column already exists - ignore
}

// Migration 2: Update sync_state table to support per-folder delta links
try {
  const tableInfo = db.query("PRAGMA table_info(sync_state)").all() as { name: string }[];
  const hasFolder = tableInfo.some(col => col.name === 'folder');

  if (!hasFolder) {
    // Drop and recreate sync_state table (we can lose delta links, they'll be refetched)
    db.run("DROP TABLE IF EXISTS sync_state");
    db.run(`
      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clerk_user_id TEXT NOT NULL,
        folder TEXT NOT NULL DEFAULT 'inbox',
        delta_link TEXT,
        last_sync TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(clerk_user_id, folder)
      )
    `);
    console.log("✅ Migration: Recreated sync_state table with folder support");
  }
} catch (err) {
  console.error("Migration error:", err);
}

// Create indexes (after migrations ensure columns exist)
db.run("CREATE INDEX IF NOT EXISTS idx_emails_clerk_user ON emails(clerk_user_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_emails_outlook_id ON emails(outlook_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC)");
db.run("CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails(conversation_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder)");
db.run("CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON emails(clerk_user_id, folder)");
db.run("CREATE INDEX IF NOT EXISTS idx_sync_state_clerk_user ON sync_state(clerk_user_id)");
db.run("CREATE INDEX IF NOT EXISTS idx_sync_state_user_folder ON sync_state(clerk_user_id, folder)");

export function initDatabase() {
  console.log("✅ Database initialized");
}

// Supported folders for sync
export const MAIL_FOLDERS = [
  'inbox',
  'sentitems',
  'drafts',
  'deleteditems',
  'junkemail',
  'archive',
] as const;

export type MailFolder = typeof MAIL_FOLDERS[number];

// Email queries
export const emailQueries = {
  // Get all emails for a user
  getAllByUser: db.query<
    {
      id: number;
      clerk_user_id: string;
      outlook_id: string;
      folder: string;
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

  // Get emails by folder for a user
  getByFolder: db.query<
    {
      id: number;
      clerk_user_id: string;
      outlook_id: string;
      folder: string;
      from_email: string;
      from_name: string | null;
      subject: string | null;
      body_preview: string | null;
      is_read: number;
      received_at: string;
    },
    [string, string]
  >(`
    SELECT * FROM emails
    WHERE clerk_user_id = ? AND folder = ?
    ORDER BY received_at DESC
  `),

  // Get email counts by folder for a user
  getCountsByFolder: db.query<
    { folder: string; total: number; unread: number },
    [string]
  >(`
    SELECT
      folder,
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM emails
    WHERE clerk_user_id = ?
    GROUP BY folder
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
      folder, from_email, from_name, subject, body_preview,
      to_emails, cc_emails, is_read, has_attachments, importance,
      received_at, sent_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // Update email folder (for move operations)
  updateFolder: db.prepare(`
    UPDATE emails SET folder = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
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
  // Get sync state for user and folder
  getByUserAndFolder: db.query<
    {
      id: number;
      clerk_user_id: string;
      folder: string;
      delta_link: string | null;
      last_sync: string | null;
    },
    [string, string]
  >(`
    SELECT * FROM sync_state WHERE clerk_user_id = ? AND folder = ?
  `),

  // Get all sync states for user
  getAllByUser: db.query<
    {
      id: number;
      clerk_user_id: string;
      folder: string;
      delta_link: string | null;
      last_sync: string | null;
    },
    [string]
  >(`
    SELECT * FROM sync_state WHERE clerk_user_id = ?
  `),

  // Upsert sync state for a specific folder
  upsert: db.prepare(`
    INSERT INTO sync_state (clerk_user_id, folder, delta_link, last_sync, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(clerk_user_id, folder)
    DO UPDATE SET
      delta_link = excluded.delta_link,
      last_sync = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `),
};
