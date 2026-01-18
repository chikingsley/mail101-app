import { createSyncWorker } from "./services/sync-queue";
import { initDatabase } from "./db/db";

async function main() {
  console.log("🚀 Starting sync worker...");

  // Initialize database
  await initDatabase();

  // Create and start the worker
  const worker = createSyncWorker();

  console.log("✅ Sync worker running");
  console.log("   Concurrency: 5 jobs");
  console.log("   Rate limit: 10 jobs/second");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down worker...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
