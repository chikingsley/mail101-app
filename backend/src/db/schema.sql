-- Email metadata table
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Clerk user ID (from auth)
  clerk_user_id TEXT NOT NULL,

  -- Outlook identifiers
  outlook_id TEXT UNIQUE NOT NULL,
  conversation_id TEXT,
  internet_message_id TEXT,

  -- Folder (inbox, sentitems, drafts, deleteditems, junkemail, archive)
  folder TEXT DEFAULT 'inbox',

  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_preview TEXT,

  -- Recipients (stored as JSON)
  to_emails TEXT, -- JSON array
  cc_emails TEXT, -- JSON array

  -- Flags
  is_read INTEGER DEFAULT 0,
  has_attachments INTEGER DEFAULT 0,
  importance TEXT DEFAULT 'normal', -- low, normal, high

  -- Timestamps
  received_at TEXT NOT NULL,
  sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sync state table (tracks delta sync per user per folder)
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- One sync state per Clerk user + folder combination
  clerk_user_id TEXT NOT NULL,
  folder TEXT NOT NULL DEFAULT 'inbox',

  -- Microsoft Graph delta link
  delta_link TEXT,
  last_sync TEXT,

  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(clerk_user_id, folder)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_clerk_user ON emails(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_emails_outlook_id ON emails(outlook_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);
CREATE INDEX IF NOT EXISTS idx_emails_user_folder ON emails(clerk_user_id, folder);
CREATE INDEX IF NOT EXISTS idx_sync_state_clerk_user ON sync_state(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_user_folder ON sync_state(clerk_user_id, folder);
