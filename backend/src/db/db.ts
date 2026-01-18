import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://mail101:mail101dev@localhost:5432/mail101";

export const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

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

// ============================================
// INITIALIZATION
// ============================================

export async function initDatabase() {
  console.log("📂 Initializing Postgres database...");

  // Create Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_user_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create Emails table
  await sql`
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      outlook_id TEXT NOT NULL,
      conversation_id TEXT,
      internet_message_id TEXT,
      folder TEXT DEFAULT 'inbox',
      from_email TEXT NOT NULL,
      from_name TEXT,
      subject TEXT,
      body_preview TEXT,
      body_html TEXT,
      to_emails JSONB DEFAULT '[]',
      cc_emails JSONB DEFAULT '[]',
      is_read BOOLEAN DEFAULT FALSE,
      has_attachments BOOLEAN DEFAULT FALSE,
      importance TEXT DEFAULT 'normal',
      flag_status TEXT DEFAULT 'notFlagged',
      flag_color TEXT,
      received_at TIMESTAMPTZ NOT NULL,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, outlook_id)
    )
  `;

  // Create Sync State table
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      folder TEXT NOT NULL,
      delta_link TEXT,
      last_sync TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, folder)
    )
  `;

  // Create Webhook Subscriptions table
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      subscription_id TEXT UNIQUE NOT NULL,
      resource TEXT NOT NULL,
      change_types TEXT NOT NULL,
      expiration_time TIMESTAMPTZ NOT NULL,
      client_state TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create Threads table
  await sql`
    CREATE TABLE IF NOT EXISTS threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create Thread Items table
  await sql`
    CREATE TABLE IF NOT EXISTS thread_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('email', 'comment', 'note', 'divider')),
      email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
      content TEXT,
      position INTEGER DEFAULT 0,
      item_date TIMESTAMPTZ NOT NULL,
      removed_at TIMESTAMPTZ,
      removed_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_user ON emails(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(user_id, folder)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails(conversation_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_thread_items_thread ON thread_items(thread_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_thread_items_email ON thread_items(email_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sync_state_user_folder ON sync_state(user_id, folder)`;

  console.log("✅ Postgres database initialized");
}

// ============================================
// USER QUERIES
// ============================================

export const userQueries = {
  async getByClerkId(clerkUserId: string) {
    const [user] = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
    `;
    return user || null;
  },

  async getOrCreate(clerkUserId: string, email: string, name?: string) {
    let user = await this.getByClerkId(clerkUserId);
    if (!user) {
      const [newUser] = await sql`
        INSERT INTO users (clerk_user_id, email, name)
        VALUES (${clerkUserId}, ${email}, ${name || null})
        RETURNING *
      `;
      user = newUser;
    }
    return user;
  },

  async update(
    clerkUserId: string,
    data: { email?: string; name?: string; avatar_url?: string }
  ) {
    const [user] = await sql`
      UPDATE users SET
        email = COALESCE(${data.email || null}, email),
        name = COALESCE(${data.name || null}, name),
        avatar_url = COALESCE(${data.avatar_url || null}, avatar_url),
        updated_at = NOW()
      WHERE clerk_user_id = ${clerkUserId}
      RETURNING *
    `;
    return user || null;
  },
};

// ============================================
// EMAIL QUERIES
// ============================================

export const emailQueries = {
  async getByFolder(userId: string, folder: MailFolder) {
    const emails = await sql`
      SELECT e.*,
        (SELECT COUNT(*) FROM emails e2
         WHERE e2.conversation_id = e.conversation_id
         AND e2.user_id = e.user_id) as thread_count
      FROM emails e
      WHERE e.user_id = ${userId}::uuid AND e.folder = ${folder}
      ORDER BY e.received_at DESC
    `;
    return emails;
  },

  async getById(id: string) {
    const [email] = await sql`SELECT * FROM emails WHERE id = ${id}::uuid`;
    return email || null;
  },

  async getByOutlookId(userId: string, outlookId: string) {
    const [email] = await sql`
      SELECT * FROM emails WHERE user_id = ${userId}::uuid AND outlook_id = ${outlookId}
    `;
    return email || null;
  },

  async getByConversationId(userId: string, conversationId: string) {
    const emails = await sql`
      SELECT * FROM emails
      WHERE user_id = ${userId}::uuid AND conversation_id = ${conversationId}
      ORDER BY received_at ASC
    `;
    return emails;
  },

  async insert(userId: string, email: {
    outlook_id: string;
    conversation_id?: string;
    internet_message_id?: string;
    folder: string;
    from_email: string;
    from_name?: string;
    subject?: string;
    body_preview?: string;
    to_emails?: string[];
    cc_emails?: string[];
    is_read?: boolean;
    has_attachments?: boolean;
    importance?: string;
    received_at: string;
    sent_at?: string;
  }) {
    try {
      const [inserted] = await sql`
        INSERT INTO emails (
          user_id, outlook_id, conversation_id, internet_message_id,
          folder, from_email, from_name, subject, body_preview,
          to_emails, cc_emails, is_read, has_attachments, importance,
          received_at, sent_at
        ) VALUES (
          ${userId}::uuid,
          ${email.outlook_id},
          ${email.conversation_id || null},
          ${email.internet_message_id || null},
          ${email.folder},
          ${email.from_email},
          ${email.from_name || null},
          ${email.subject || null},
          ${email.body_preview || null},
          ${JSON.stringify(email.to_emails || [])}::jsonb,
          ${JSON.stringify(email.cc_emails || [])}::jsonb,
          ${email.is_read || false},
          ${email.has_attachments || false},
          ${email.importance || "normal"},
          ${email.received_at}::timestamptz,
          ${email.sent_at || null}::timestamptz
        )
        ON CONFLICT (user_id, outlook_id) DO NOTHING
        RETURNING *
      `;
      return inserted || null;
    } catch (err) {
      console.error("Insert email error:", err);
      return null;
    }
  },

  async updateReadStatus(id: string, isRead: boolean) {
    await sql`
      UPDATE emails SET is_read = ${isRead}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  },

  async updateFlag(id: string, flagStatus: string, flagColor?: string) {
    await sql`
      UPDATE emails SET
        flag_status = ${flagStatus},
        flag_color = ${flagColor || null},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  },

  async updateFolder(id: string, folder: string) {
    await sql`
      UPDATE emails SET folder = ${folder}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  },

  async updateFromSync(userId: string, outlookId: string, isRead: boolean) {
    await sql`
      UPDATE emails SET is_read = ${isRead}, updated_at = NOW()
      WHERE user_id = ${userId}::uuid AND outlook_id = ${outlookId}
    `;
  },

  async delete(id: string) {
    await sql`DELETE FROM emails WHERE id = ${id}::uuid`;
  },

  async deleteByOutlookId(userId: string, outlookId: string) {
    await sql`
      DELETE FROM emails WHERE user_id = ${userId}::uuid AND outlook_id = ${outlookId}
    `;
  },

  async getCounts(userId: string) {
    const counts = await sql`
      SELECT folder, COUNT(*) as total, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread
      FROM emails
      WHERE user_id = ${userId}::uuid
      GROUP BY folder
    `;
    return counts;
  },
};

// ============================================
// SYNC STATE QUERIES
// ============================================

export const syncQueries = {
  async getByUserAndFolder(userId: string, folder: string) {
    const [state] = await sql`
      SELECT * FROM sync_state WHERE user_id = ${userId}::uuid AND folder = ${folder}
    `;
    return state || null;
  },

  async upsert(userId: string, folder: string, deltaLink: string) {
    await sql`
      INSERT INTO sync_state (user_id, folder, delta_link, last_sync)
      VALUES (${userId}::uuid, ${folder}, ${deltaLink}, NOW())
      ON CONFLICT (user_id, folder)
      DO UPDATE SET delta_link = ${deltaLink}, last_sync = NOW(), updated_at = NOW()
    `;
  },
};

// ============================================
// WEBHOOK SUBSCRIPTION QUERIES
// ============================================

export const subscriptionQueries = {
  async getById(subscriptionId: string) {
    const [sub] = await sql`
      SELECT ws.*, u.clerk_user_id
      FROM webhook_subscriptions ws
      JOIN users u ON ws.user_id = u.id
      WHERE ws.subscription_id = ${subscriptionId}
    `;
    return sub || null;
  },

  async getByUser(userId: string) {
    const subs = await sql`
      SELECT * FROM webhook_subscriptions WHERE user_id = ${userId}::uuid
    `;
    return subs;
  },

  async insert(
    userId: string,
    subscriptionId: string,
    resource: string,
    changeTypes: string,
    expirationTime: string,
    clientState: string
  ) {
    await sql`
      INSERT INTO webhook_subscriptions (user_id, subscription_id, resource, change_types, expiration_time, client_state)
      VALUES (${userId}::uuid, ${subscriptionId}, ${resource}, ${changeTypes}, ${expirationTime}::timestamptz, ${clientState})
    `;
  },

  async updateExpiration(subscriptionId: string, expirationTime: string) {
    await sql`
      UPDATE webhook_subscriptions SET
        expiration_time = ${expirationTime}::timestamptz,
        updated_at = NOW()
      WHERE subscription_id = ${subscriptionId}
    `;
  },

  async delete(subscriptionId: string) {
    await sql`DELETE FROM webhook_subscriptions WHERE subscription_id = ${subscriptionId}`;
  },

  async deleteByUser(userId: string) {
    await sql`DELETE FROM webhook_subscriptions WHERE user_id = ${userId}::uuid`;
  },
};

// ============================================
// CUSTOM THREAD QUERIES
// ============================================

export const threadQueries = {
  async create(userId: string, title?: string) {
    const [thread] = await sql`
      INSERT INTO threads (user_id, title)
      VALUES (${userId}::uuid, ${title || null})
      RETURNING *
    `;
    return thread;
  },

  async getById(threadId: string) {
    const [thread] = await sql`SELECT * FROM threads WHERE id = ${threadId}::uuid`;
    return thread || null;
  },

  async getByUser(userId: string) {
    const threads = await sql`
      SELECT t.*,
        (SELECT COUNT(*) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.removed_at IS NULL) as item_count,
        (SELECT COUNT(*) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.item_type = 'email' AND ti.removed_at IS NULL) as email_count,
        (SELECT MAX(ti.item_date) FROM thread_items ti WHERE ti.thread_id = t.id AND ti.removed_at IS NULL) as last_activity
      FROM threads t
      WHERE t.user_id = ${userId}::uuid
      ORDER BY t.updated_at DESC
    `;
    return threads;
  },

  async updateTitle(threadId: string, title: string) {
    const [thread] = await sql`
      UPDATE threads SET title = ${title}, updated_at = NOW()
      WHERE id = ${threadId}::uuid
      RETURNING *
    `;
    return thread || null;
  },

  async delete(threadId: string) {
    await sql`DELETE FROM threads WHERE id = ${threadId}::uuid`;
  },

  async getWithItems(threadId: string, includeRemoved = false) {
    const thread = await this.getById(threadId);
    if (!thread) return null;

    const items = includeRemoved
      ? await sql`
          SELECT ti.*, e.from_email, e.from_name, e.subject, e.body_preview, e.received_at as email_received_at,
                 e.to_emails, e.cc_emails, e.is_read, e.has_attachments, e.outlook_id
          FROM thread_items ti
          LEFT JOIN emails e ON ti.email_id = e.id
          WHERE ti.thread_id = ${threadId}::uuid
          ORDER BY ti.item_date ASC
        `
      : await sql`
          SELECT ti.*, e.from_email, e.from_name, e.subject, e.body_preview, e.received_at as email_received_at,
                 e.to_emails, e.cc_emails, e.is_read, e.has_attachments, e.outlook_id
          FROM thread_items ti
          LEFT JOIN emails e ON ti.email_id = e.id
          WHERE ti.thread_id = ${threadId}::uuid AND ti.removed_at IS NULL
          ORDER BY ti.item_date ASC
        `;

    return { ...thread, items };
  },
};

export const threadItemQueries = {
  async addEmail(threadId: string, userId: string, emailId: string, itemDate: string) {
    // Check if already exists
    const [existing] = await sql`
      SELECT * FROM thread_items
      WHERE thread_id = ${threadId}::uuid AND email_id = ${emailId}::uuid AND removed_at IS NULL
    `;
    if (existing) return null;

    const [item] = await sql`
      INSERT INTO thread_items (thread_id, user_id, item_type, email_id, item_date)
      VALUES (${threadId}::uuid, ${userId}::uuid, 'email', ${emailId}::uuid, ${itemDate}::timestamptz)
      RETURNING *
    `;
    return item;
  },

  async addComment(threadId: string, userId: string, content: string) {
    const [item] = await sql`
      INSERT INTO thread_items (thread_id, user_id, item_type, content, item_date)
      VALUES (${threadId}::uuid, ${userId}::uuid, 'comment', ${content}, NOW())
      RETURNING *
    `;
    return item;
  },

  async addNote(threadId: string, userId: string, content: string) {
    const [item] = await sql`
      INSERT INTO thread_items (thread_id, user_id, item_type, content, item_date)
      VALUES (${threadId}::uuid, ${userId}::uuid, 'note', ${content}, NOW())
      RETURNING *
    `;
    return item;
  },

  async addDivider(threadId: string, userId: string, content?: string) {
    const [item] = await sql`
      INSERT INTO thread_items (thread_id, user_id, item_type, content, item_date)
      VALUES (${threadId}::uuid, ${userId}::uuid, 'divider', ${content || null}, NOW())
      RETURNING *
    `;
    return item;
  },

  async remove(itemId: string, removedBy: string) {
    const [item] = await sql`
      UPDATE thread_items SET removed_at = NOW(), removed_by = ${removedBy}::uuid
      WHERE id = ${itemId}::uuid
      RETURNING *
    `;
    return item || null;
  },

  async restore(itemId: string) {
    const [item] = await sql`
      UPDATE thread_items SET removed_at = NULL, removed_by = NULL
      WHERE id = ${itemId}::uuid
      RETURNING *
    `;
    return item || null;
  },

  async permanentDelete(itemId: string) {
    await sql`DELETE FROM thread_items WHERE id = ${itemId}::uuid`;
  },

  async updateContent(itemId: string, content: string) {
    const [item] = await sql`
      UPDATE thread_items SET content = ${content}, updated_at = NOW()
      WHERE id = ${itemId}::uuid
      RETURNING *
    `;
    return item || null;
  },

  async getThreadsContainingEmail(emailId: string) {
    const threads = await sql`
      SELECT t.* FROM threads t
      JOIN thread_items ti ON t.id = ti.thread_id
      WHERE ti.email_id = ${emailId}::uuid AND ti.removed_at IS NULL
    `;
    return threads;
  },
};

// ============================================
// SEARCH QUERIES
// ============================================

export const searchQueries = {
  async searchEmails(userId: string, query: string, limit = 50, offset = 0) {
    const searchPattern = `%${query}%`;
    const emails = await sql`
      SELECT * FROM emails
      WHERE user_id = ${userId}::uuid
        AND (subject ILIKE ${searchPattern}
             OR from_name ILIKE ${searchPattern}
             OR from_email ILIKE ${searchPattern}
             OR body_preview ILIKE ${searchPattern})
      ORDER BY received_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return emails;
  },

  async searchEmailsCount(userId: string, query: string) {
    const searchPattern = `%${query}%`;
    const [result] = await sql`
      SELECT COUNT(*) as count FROM emails
      WHERE user_id = ${userId}::uuid
        AND (subject ILIKE ${searchPattern}
             OR from_name ILIKE ${searchPattern}
             OR from_email ILIKE ${searchPattern}
             OR body_preview ILIKE ${searchPattern})
    `;
    return result?.count || 0;
  },
};

// Graceful shutdown
process.on("SIGINT", async () => {
  await sql.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await sql.end();
  process.exit(0);
});
