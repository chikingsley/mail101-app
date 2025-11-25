/**
 * Database migration runner for Supabase
 * Run with: bun run src/db/migrate.ts
 */

import { SQL } from "bun";

const DIRECT_URL = process.env.DIRECT_URL;

if (!DIRECT_URL) {
	console.error("❌ DIRECT_URL not set in environment");
	process.exit(1);
}

// Use direct connection for migrations (not pooled)
const sql = new SQL(DIRECT_URL);

async function runMigrations() {
	console.log("🚀 Running migrations...\n");

	try {
		// Read migration file
		const migrationFile = Bun.file(
			`${import.meta.dir}/migrations/001_initial_schema.sql`,
		);
		const migrationSQL = await migrationFile.text();

		// Split by semicolons and run each statement
		const statements = migrationSQL
			.split(";")
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && !s.startsWith("--"));

		for (const statement of statements) {
			try {
				await sql.unsafe(statement);
				// Log first 50 chars of each statement
				const preview = statement.substring(0, 50).replace(/\n/g, " ");
				console.log(`✅ ${preview}...`);
			} catch (err: any) {
				// Ignore "already exists" errors
				if (
					err.message?.includes("already exists") ||
					err.message?.includes("duplicate")
				) {
					const preview = statement.substring(0, 50).replace(/\n/g, " ");
					console.log(`⏭️  Skipped (exists): ${preview}...`);
				} else {
					console.error(`❌ Failed: ${statement.substring(0, 100)}...`);
					console.error(`   Error: ${err.message}`);
				}
			}
		}

		console.log("\n✅ Migrations complete!");
	} catch (err) {
		console.error("❌ Migration failed:", err);
		process.exit(1);
	} finally {
		sql.close();
	}
}

runMigrations();
