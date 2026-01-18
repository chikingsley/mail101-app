import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { initDatabase } from "./db/db";
import { composeRoutes } from "./routes/compose";
import { emailRoutes } from "./routes/emails";
import { searchRoutes, threadRoutes } from "./routes/threads";
import { webhookRoutes } from "./routes/webhook";
import { initMeilisearch } from "./services/meilisearch";
import { createSyncWorker } from "./services/sync-queue";

// Initialize database and search on startup
await initDatabase();
await initMeilisearch().catch((err) => {
  console.warn("⚠️ Meilisearch initialization failed (search may be unavailable):", err.message);
});

// Start the sync worker in the same process
const worker = createSyncWorker();
console.log("✅ Sync worker started (in-process)");

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Mail App API",
          version: "1.0.0",
          description: "API documentation for the Mail application",
        },
      },
    })
  )
  .use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    })
  )
  .get("/", () => "Hello Elysia", {
    detail: {
      tags: ["General"],
      summary: "Welcome endpoint",
      description: "Returns a simple greeting",
    },
  })
  .use(emailRoutes)
  .use(webhookRoutes)
  .use(threadRoutes)
  .use(searchRoutes)
  .use(composeRoutes)
  .listen({
    port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8000,
    hostname: "0.0.0.0",
  });

console.log(`🦊 Elysia is running at http://localhost:${app.server?.port}`);
console.log(`🚀 Swagger docs at http://localhost:${app.server?.port}/swagger`);

// Graceful shutdown
const shutdown = async () => {
  console.log("\n🛑 Shutting down...");
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
