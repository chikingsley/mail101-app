import { beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { emailRoutes } from "./routes/emails";

describe("Mail101 Backend API", () => {
  let app: Elysia;

  beforeAll(() => {
    // Create test app instance
    app = new Elysia().get("/", () => "Hello Elysia").use(emailRoutes);
  });

  test("GET / returns welcome message", async () => {
    const response = await app.handle(new Request("http://localhost/"));
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toBe("Hello Elysia");
  });

  test("returns correct status codes", async () => {
    const response = await app.handle(
      new Request("http://localhost/nonexistent", { method: "GET" })
    );
    expect(response.status).toBe(404);
  });
});
