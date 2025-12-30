import { Database } from "bun:sqlite";

const DB_PATH = process.env.DATABASE_PATH || "database.sqlite";
export const db = new Database(DB_PATH);

// Supported folders for sync
export const MAIL_FOLDERS = [
  "inbox",
  "sentitems",
  "drafts",
  "deleteditems",
  "junkemail",
  "archive",
] as const;

export type MailFolder = (typeof MAIL_FOLDERS)[number];

// Helper to handle JSON
function toJson(obj: any): string {
  return JSON.stringify(obj || []);
}

function fromJson(str: string | null): any[] {
  if (!str) return [];
  try {
    return JSON.parse(str);
  } catch (e) {
    return [];
  }
}

// ============================================
// INITIALIZATION
// ============================================

export async function initDatabase() {
  console.log(`📂 Initializing SQLite database at ${DB_PATH}...`);

  // Enable foreign keys
  db.run("PRAGMA foreign_keys = ON");

  // Create Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Emails table
  db.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      outlook_id TEXT NOT NULL,
      conversation_id TEXT,
      internet_message_id TEXT,
      folder TEXT DEFAULT 'inbox',
      from_email TEXT NOT NULL,
      from_name TEXT,
      subject TEXT,
      body_preview TEXT,
      body_html TEXT,
      to_emails TEXT DEFAULT '[]',
      cc_emails TEXT DEFAULT '[]',
      is_read INTEGER DEFAULT 0,
      has_attachments INTEGER DEFAULT 0,
      importance TEXT DEFAULT 'normal',
      flag_status TEXT DEFAULT 'notFlagged',
      flag_color TEXT,
      received_at TEXT NOT NULL,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, outlook_id)
    )
  `);

  // Create Sync State table
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      folder TEXT NOT NULL,
      delta_link TEXT,
      last_sync TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, folder)
    )
  `);

  // Create Webhook Subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      subscription_id TEXT UNIQUE NOT NULL,
      resource TEXT NOT NULL,
      change_types TEXT NOT NULL,
      expiration_time TEXT NOT NULL,
      client_state TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Threads table
  db.run(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create Thread Items table
  db.run(`
    CREATE TABLE IF NOT EXISTS thread_items (
      id TEXT PRIMARY KEY,
      thread_id TEXT REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('email', 'comment', 'note', 'divider')),
      email_id TEXT REFERENCES emails(id) ON DELETE SET NULL,
      content TEXT,
      position INTEGER DEFAULT 0,
      item_date TEXT NOT NULL,
      removed_at TEXT,
      removed_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  db.run("CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(user_id, folder)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails(conversation_id)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_thread_items_thread ON thread_items(thread_id)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_thread_items_email ON thread_items(email_id)"
  );

  console.log("✅ SQLite database initialized");
}

// ============================================
// USER QUERIES
// ============================================

export const userQueries = {
  getByClerkId(clerkUserId: string) {
    return db
      .query("SELECT * FROM users WHERE clerk_user_id = ?")
      .get(clerkUserId) as any;
  },

  getOrCreate(clerkUserId: string, email: string, name?: string) {
    let user = this.getByClerkId(clerkUserId);
    if (!user) {
      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO users (id, clerk_user_id, email, name) VALUES (?, ?, ?, ?)",
        [id, clerkUserId, email, name || null]
      );
      user = this.getByClerkId(clerkUserId);
    }
    return user;
  },

  update(
    clerkUserId: string,
    data: { email?: string; name?: string; avatar_url?: string }
  ) {
    const user = this.getByClerkId(clerkUserId);
    if (!user) return null;

    db.run(
      "UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE clerk_user_id = ?",
      [
        data.email || null,
        data.name || null,
        data.avatar_url || null,
        clerkUserId,
      ]
    );
    return this.getByClerkId(clerkUserId);
  },
};

// ============================================
// EMAIL QUERIES
// ============================================

function parseEmail(email: any) {
  if (!email) return email;
  return {
    ...email,
    to_emails: fromJson(email.to_emails),
    cc_emails: fromJson(email.cc_emails),
    is_read: !!email.is_read,
    has_attachments: !!email.has_attachments,
  };
}

export const emailQueries = {
  getByFolder(userId: string, folder: MailFolder) {
    const emails = db
      .query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM emails e2
         WHERE e2.conversation_id = e.conversation_id
         AND e2.user_id = e.user_id) as thread_count
      FROM emails e
      WHERE e.user_id = ? AND e.folder = ?
      ORDER BY e.received_at DESC
    `)
      .all(userId, folder) as any[];
    return emails.map(parseEmail);
  },

  getById(id: string) {
    const email = db.query("SELECT * FROM emails WHERE id = ?").get(id);
    return parseEmail(email);
  },

  getByOutlookId(userId: string, outlookId: string) {
    const email = db
      .query("SELECT * FROM emails WHERE user_id = ? AND outlook_id = ?")
      .get(userId, outlookId);
    return parseEmail(email);
  },

  getByConversationId(userId: string, conversationId: string) {
    const emails = db
      .query(`
      SELECT * FROM emails
      WHERE user_id = ? AND conversation_id = ?
      ORDER BY received_at ASC
    `)
      .all(userId, conversationId) as any[];
    return emails.map(parseEmail);
  },

  insert(userId: string, email: any) {
    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO emails (
        id, user_id, outlook_id, conversation_id, internet_message_id,
        folder, from_email, from_name, subject, body_preview,
        to_emails, cc_emails, is_read, has_attachments, importance,
        received_at, sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, outlook_id) DO NOTHING
    `,
      [
        id,
        userId,
        email.outlook_id,
        email.conversation_id || null,
        email.internet_message_id || null,
        email.folder,
        email.from_email,
        email.from_name || null,
        email.subject || null,
        email.body_preview || null,
        toJson(email.to_emails),
        toJson(email.cc_emails),
        email.is_read ? 1 : 0,
        email.has_attachments ? 1 : 0,
        email.importance || "normal",
        email.received_at,
        email.sent_at || null,
      ]
    );
    return this.getById(id);
  },

  updateReadStatus(id: string, isRead: boolean) {
    db.run(
      "UPDATE emails SET is_read = ?, updated_at = datetime('now') WHERE id = ?",
      [isRead ? 1 : 0, id]
    );
  },

  updateFlag(id: string, flagStatus: string, flagColor?: string) {
    db.run(
      "UPDATE emails SET flag_status = ?, flag_color = ?, updated_at = datetime('now') WHERE id = ?",
      [flagStatus, flagColor || null, id]
    );
  },

  updateFolder(id: string, folder: string) {
    db.run(
      "UPDATE emails SET folder = ?, updated_at = datetime('now') WHERE id = ?",
      [folder, id]
    );
  },

  updateFromSync(userId: string, outlookId: string, isRead: boolean) {
    db.run(
      "UPDATE emails SET is_read = ?, updated_at = datetime('now') WHERE user_id = ? AND outlook_id = ?",
      [isRead ? 1 : 0, userId, outlookId]
    );
  },

  delete(id: string) {
    db.run("DELETE FROM emails WHERE id = ?", [id]);
  },

  deleteByOutlookId(userId: string, outlookId: string) {
    db.run("DELETE FROM emails WHERE user_id = ? AND outlook_id = ?", [
      userId,
      outlookId,
    ]);
  },

  getCounts(userId: string) {
    return db
      .query(`
      SELECT folder, COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
      FROM emails
      WHERE user_id = ?
      GROUP BY folder
    `)
      .all(userId) as any[];
  },
};

// ============================================
// SYNC STATE QUERIES
// ============================================

export const syncQueries = {
  getByUserAndFolder(userId: string, folder: string) {
    return db
      .query("SELECT * FROM sync_state WHERE user_id = ? AND folder = ?")
      .get(userId, folder) as any;
  },

  upsert(userId: string, folder: string, deltaLink: string) {
    const existing = this.getByUserAndFolder(userId, folder);
    if (existing) {
      db.run(
        "UPDATE sync_state SET delta_link = ?, last_sync = datetime('now'), updated_at = datetime('now') WHERE user_id = ? AND folder = ?",
        [deltaLink, userId, folder]
      );
    } else {
      const id = crypto.randomUUID();
      db.run(
        "INSERT INTO sync_state (id, user_id, folder, delta_link, last_sync) VALUES (?, ?, ?, ?, datetime('now'))",
        [id, userId, folder, deltaLink]
      );
    }
  },
};

// ============================================
// WEBHOOK SUBSCRIPTION QUERIES
// ============================================

export const subscriptionQueries = {
  getById(subscriptionId: string) {
    return db
      .query(`
      SELECT ws.*, u.clerk_user_id
      FROM webhook_subscriptions ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.subscription_id = ?
    `)
      .get(subscriptionId) as any;
  },

  getByUser(userId: string) {
    return db
      .query("SELECT * FROM webhook_subscriptions WHERE user_id = ?")
      .all(userId) as any[];
  },

  insert(
    userId: string,
    subscriptionId: string,
    resource: string,
    changeTypes: string,
    expirationTime: string,
    clientState: string
  ) {
    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO webhook_subscriptions (id, user_id, subscription_id, resource, change_types, expiration_time, client_state)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        userId,
        subscriptionId,
        resource,
        changeTypes,
        expirationTime,
        clientState,
      ]
    );
  },

  updateExpiration(subscriptionId: string, expirationTime: string) {
    db.run(
      "UPDATE webhook_subscriptions SET expiration_time = ?, updated_at = datetime('now') WHERE subscription_id = ?",
      [expirationTime, subscriptionId]
    );
  },

  delete(subscriptionId: string) {
    db.run("DELETE FROM webhook_subscriptions WHERE subscription_id = ?", [
      subscriptionId,
    ]);
  },

  deleteByUser(userId: string) {
    db.run("DELETE FROM webhook_subscriptions WHERE user_id = ?", [userId]);
  },
};

// ============================================
// CUSTOM THREAD QUERIES
// ============================================

export const threadQueries = {
  create(userId: string, title?: string) {
    const id = crypto.randomUUID();
    db.run("INSERT INTO threads (id, user_id, title) VALUES (?, ?, ?)", [
      id,
      userId,
      title || null,
    ]);
    return this.getById(id);
  },

  getById(threadId: string) {
    return db.query("SELECT * FROM threads WHERE id = ?").get(threadId) as any;
  },

  getByUser(userId: string) {
    return db
      .query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.removed_at IS NULL) as item_count,
        (SELECT COUNT(*) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.item_type = 'email' AND ti.removed_at IS NULL) as email_count,
        (SELECT MAX(ti.item_date) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.removed_at IS NULL) as last_activity
      FROM threads t
      WHERE t.user_id = ?
      ORDER BY t.updated_at DESC
    `)
      .all(userId) as any[];
  },

  updateTitle(threadId: string, title: string) {
    db.run(
      "UPDATE threads SET title = ?, updated_at = datetime('now') WHERE id = ?",
      [title, threadId]
    );
    return this.getById(threadId);
  },

  delete(threadId: string) {
    db.run("DELETE FROM threads WHERE id = ?", [threadId]);
  },

  getWithItems(threadId: string, includeRemoved = false) {
    const thread = this.getById(threadId);
    if (!thread) return null;

    const query = includeRemoved
      ? `
        SELECT ti.*, e.from_email, e.from_name, e.subject, e.body_preview, e.received_at as email_received_at,
               e.to_emails, e.cc_emails, e.is_read, e.has_attachments, e.outlook_id
        FROM thread_items ti
        LEFT JOIN emails e ON ti.email_id = e.id
        WHERE ti.thread_id = ?
        ORDER BY ti.item_date ASC
      `
      : `
        SELECT ti.*, e.from_email, e.from_name, e.subject, e.body_preview, e.received_at as email_received_at,
               e.to_emails, e.cc_emails, e.is_read, e.has_attachments, e.outlook_id
        FROM thread_items ti
        LEFT JOIN emails e ON ti.email_id = e.id
        WHERE ti.thread_id = ? AND ti.removed_at IS NULL
        ORDER BY ti.item_date ASC
      `;

    const items = db.query(query).all(threadId) as any[];
    const parsedItems = items.map((item: any) => ({
      ...item,
      to_emails: fromJson(item.to_emails),
      cc_emails: fromJson(item.cc_emails),
      is_read: !!item.is_read,
      has_attachments: !!item.has_attachments,
    }));

    return { ...thread, items: parsedItems };
  },
};

export const threadItemQueries = {
  addEmail(
    threadId: string,
    userId: string,
    emailId: string,
    itemDate: string
  ) {
    // Check if already exists
    const existing = db
      .query(
        "SELECT * FROM thread_items WHERE thread_id = ? AND email_id = ? AND removed_at IS NULL"
      )
      .get(threadId, emailId);
    if (existing) return null;

    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO thread_items (id, thread_id, user_id, item_type, email_id, item_date)
      VALUES (?, ?, ?, 'email', ?, ?)
    `,
      [id, threadId, userId, emailId, itemDate]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(id);
  },

  addComment(threadId: string, userId: string, content: string) {
    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO thread_items (id, thread_id, user_id, item_type, content, item_date)
      VALUES (?, ?, ?, 'comment', ?, datetime('now'))
    `,
      [id, threadId, userId, content]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(id);
  },

  addNote(threadId: string, userId: string, content: string) {
    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO thread_items (id, thread_id, user_id, item_type, content, item_date)
      VALUES (?, ?, ?, 'note', ?, datetime('now'))
    `,
      [id, threadId, userId, content]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(id);
  },

  addDivider(threadId: string, userId: string, content?: string) {
    const id = crypto.randomUUID();
    db.run(
      `
      INSERT INTO thread_items (id, thread_id, user_id, item_type, content, item_date)
      VALUES (?, ?, ?, 'divider', ?, datetime('now'))
    `,
      [id, threadId, userId, content || null]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(id);
  },

  remove(itemId: string, removedBy: string) {
    db.run(
      "UPDATE thread_items SET removed_at = datetime('now'), removed_by = ? WHERE id = ?",
      [removedBy, itemId]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(itemId);
  },

  restore(itemId: string) {
    db.run(
      "UPDATE thread_items SET removed_at = NULL, removed_by = NULL WHERE id = ?",
      [itemId]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(itemId);
  },

  permanentDelete(itemId: string) {
    db.run("DELETE FROM thread_items WHERE id = ?", [itemId]);
  },

  updateContent(itemId: string, content: string) {
    db.run(
      "UPDATE thread_items SET content = ?, updated_at = datetime('now') WHERE id = ?",
      [content, itemId]
    );
    return db.query("SELECT * FROM thread_items WHERE id = ?").get(itemId);
  },

  getThreadsContainingEmail(emailId: string) {
    return db
      .query(`
      SELECT t.* FROM threads t
      JOIN thread_items ti ON t.id = ti.thread_id
      WHERE ti.email_id = ? AND ti.removed_at IS NULL
    `)
      .all(emailId) as any[];
  },
};

// ============================================
// SEARCH QUERIES
// ============================================

export const searchQueries = {
  searchEmails(userId: string, query: string, limit = 50, offset = 0) {
    // Simple LIKE search for now, could be upgraded to FTS5
    const searchPattern = `%${query}%`;
    const emails = db
      .query(`
      SELECT * FROM emails
      WHERE user_id = ? AND (subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR body_preview LIKE ?)
      ORDER BY received_at DESC
      LIMIT ? OFFSET ?
    `)
      .all(
        userId,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        limit,
        offset
      ) as any[];
    return emails.map(parseEmail);
  },

  searchEmailsCount(userId: string, query: string) {
    const searchPattern = `%${query}%`;
    const result = db
      .query(`
      SELECT COUNT(*) as count FROM emails
      WHERE user_id = ? AND (subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR body_preview LIKE ?)
    `)
      .get(
        userId,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      ) as any;
    return result?.count || 0;
  },
};
