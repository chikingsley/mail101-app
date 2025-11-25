/**
 * Supabase/Postgres database connection using Bun.sql
 */
import { SQL } from "bun";

// MUST use DIRECT_URL (direct connection, not pgbouncer)
// pgbouncer doesn't support prepared statements which Bun.SQL uses
const DATABASE_URL = process.env.DIRECT_URL;

if (!DATABASE_URL) {
	throw new Error("DIRECT_URL not set - required for Bun.SQL prepared statements");
}

// Create connection with pooling configuration
// Supabase closes idle connections after ~60s, so we set idleTimeout lower
export const sql = new SQL({
	url: DATABASE_URL,
	max: 10, // Max connections in pool
	idleTimeout: 20, // Close idle connections after 20s (before Supabase does)
	connectionTimeout: 30, // 30s to establish connection
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
// USER QUERIES
// ============================================

export const userQueries = {
	async getByClerkId(clerkUserId: string) {
		const [user] = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
    `;
		return user;
	},

	async getOrCreate(clerkUserId: string, email: string, name?: string) {
		// Try to get existing user
		let [user] = await sql`
      SELECT * FROM users WHERE clerk_user_id = ${clerkUserId}
    `;

		if (!user) {
			// Create new user
			[user] = await sql`
        INSERT INTO users (clerk_user_id, email, name)
        VALUES (${clerkUserId}, ${email}, ${name || null})
        RETURNING *
      `;
		}

		return user;
	},

	async update(
		clerkUserId: string,
		data: { email?: string; name?: string; avatar_url?: string },
	) {
		const [user] = await sql`
      UPDATE users
      SET
        email = COALESCE(${data.email || null}, email),
        name = COALESCE(${data.name || null}, name),
        avatar_url = COALESCE(${data.avatar_url || null}, avatar_url)
      WHERE clerk_user_id = ${clerkUserId}
      RETURNING *
    `;
		return user;
	},
};

// ============================================
// EMAIL QUERIES
// ============================================

// Helper to parse JSONB fields that Bun.sql returns as strings
function parseEmailJson(email: any) {
	if (!email) return email;
	return {
		...email,
		to_emails:
			typeof email.to_emails === "string"
				? JSON.parse(email.to_emails)
				: email.to_emails || [],
		cc_emails:
			typeof email.cc_emails === "string"
				? JSON.parse(email.cc_emails)
				: email.cc_emails || [],
	};
}

export const emailQueries = {
	async getByFolder(userId: string, folder: MailFolder) {
		const emails = await sql`
      SELECT e.*,
        (SELECT COUNT(*) FROM emails e2
         WHERE e2.conversation_id = e.conversation_id
         AND e2.user_id = e.user_id) as thread_count
      FROM emails e
      WHERE e.user_id = ${userId} AND e.folder = ${folder}
      ORDER BY e.received_at DESC
    `;
		return emails.map(parseEmailJson);
	},

	async getById(id: string) {
		const [email] = await sql`
      SELECT * FROM emails WHERE id = ${id}
    `;
		return parseEmailJson(email);
	},

	async getByOutlookId(userId: string, outlookId: string) {
		const [email] = await sql`
      SELECT * FROM emails WHERE user_id = ${userId} AND outlook_id = ${outlookId}
    `;
		return parseEmailJson(email);
	},

	async getByConversationId(userId: string, conversationId: string) {
		const emails = await sql`
      SELECT * FROM emails
      WHERE user_id = ${userId} AND conversation_id = ${conversationId}
      ORDER BY received_at ASC
    `;
		return emails.map(parseEmailJson);
	},

	async insert(
		userId: string,
		email: {
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
			is_read: boolean;
			has_attachments: boolean;
			importance?: string;
			received_at: string;
			sent_at?: string;
		},
	) {
		const [result] = await sql`
      INSERT INTO emails (
        user_id, outlook_id, conversation_id, internet_message_id,
        folder, from_email, from_name, subject, body_preview,
        to_emails, cc_emails, is_read, has_attachments, importance,
        received_at, sent_at
      ) VALUES (
        ${userId}, ${email.outlook_id}, ${email.conversation_id || null}, ${email.internet_message_id || null},
        ${email.folder}, ${email.from_email}, ${email.from_name || null}, ${email.subject || null}, ${email.body_preview || null},
        ${JSON.stringify(email.to_emails || [])}, ${JSON.stringify(email.cc_emails || [])},
        ${email.is_read}, ${email.has_attachments}, ${email.importance || "normal"},
        ${email.received_at}, ${email.sent_at || null}
      )
      ON CONFLICT (user_id, outlook_id) DO NOTHING
      RETURNING *
    `;
		return result;
	},

	async updateReadStatus(id: string, isRead: boolean) {
		await sql`
      UPDATE emails SET is_read = ${isRead} WHERE id = ${id}
    `;
	},

	async updateFlag(id: string, flagStatus: string, flagColor?: string) {
		await sql`
      UPDATE emails SET flag_status = ${flagStatus}, flag_color = ${flagColor || null} WHERE id = ${id}
    `;
	},

	async updateFolder(id: string, folder: string) {
		await sql`
      UPDATE emails SET folder = ${folder} WHERE id = ${id}
    `;
	},

	async updateFromSync(userId: string, outlookId: string, isRead: boolean) {
		await sql`
      UPDATE emails SET is_read = ${isRead} WHERE user_id = ${userId} AND outlook_id = ${outlookId}
    `;
	},

	async delete(id: string) {
		await sql`DELETE FROM emails WHERE id = ${id}`;
	},

	async deleteByOutlookId(userId: string, outlookId: string) {
		await sql`DELETE FROM emails WHERE user_id = ${userId} AND outlook_id = ${outlookId}`;
	},

	async getCounts(userId: string) {
		const counts = await sql`
      SELECT folder, COUNT(*) as total, SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread
      FROM emails
      WHERE user_id = ${userId}
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
      SELECT * FROM sync_state WHERE user_id = ${userId} AND folder = ${folder}
    `;
		return state;
	},

	async upsert(userId: string, folder: string, deltaLink: string) {
		await sql`
      INSERT INTO sync_state (user_id, folder, delta_link, last_sync)
      VALUES (${userId}, ${folder}, ${deltaLink}, NOW())
      ON CONFLICT (user_id, folder)
      DO UPDATE SET delta_link = ${deltaLink}, last_sync = NOW()
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
		return sub;
	},

	async getByUser(userId: string) {
		return sql`
      SELECT * FROM webhook_subscriptions WHERE user_id = ${userId}
    `;
	},

	async insert(
		userId: string,
		subscriptionId: string,
		resource: string,
		changeTypes: string,
		expirationTime: string,
		clientState: string,
	) {
		await sql`
      INSERT INTO webhook_subscriptions (user_id, subscription_id, resource, change_types, expiration_time, client_state)
      VALUES (${userId}, ${subscriptionId}, ${resource}, ${changeTypes}, ${expirationTime}, ${clientState})
    `;
	},

	async updateExpiration(subscriptionId: string, expirationTime: string) {
		await sql`
      UPDATE webhook_subscriptions SET expiration_time = ${expirationTime} WHERE subscription_id = ${subscriptionId}
    `;
	},

	async delete(subscriptionId: string) {
		await sql`DELETE FROM webhook_subscriptions WHERE subscription_id = ${subscriptionId}`;
	},

	async deleteByUser(userId: string) {
		await sql`DELETE FROM webhook_subscriptions WHERE user_id = ${userId}`;
	},
};

// ============================================
// INITIALIZATION
// ============================================

export async function initDatabase() {
	try {
		// Test connection
		await sql`SELECT 1`;
		console.log("✅ Supabase/Postgres connected");
	} catch (err) {
		console.error("❌ Failed to connect to Supabase:", err);
		throw err;
	}
}

// Export for backwards compatibility during migration
export { sql as db };
