import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { initDatabase } from "./db";
import { emailRoutes } from "./routes/emails";

// Initialize database on startup
initDatabase();

const app = new Elysia()
  .use(swagger({
    documentation: {
      info: {
        title: "Mail App API",
        version: "1.0.0",
        description: "API documentation for the Mail application"
      }
    }
  }))
  .use(cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
  }))
  .get("/", () => "Hello Elysia", {
    detail: {
      tags: ["General"],
      summary: "Welcome endpoint",
      description: "Returns a simple greeting"
    }
  })
  .use(emailRoutes)
  .listen(process.env.BACKEND_URL ? parseInt(process.env.BACKEND_URL.split(":").pop() || "3001") : 3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
