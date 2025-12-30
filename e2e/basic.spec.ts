import { expect, test } from "@playwright/test";

test.describe("Mail101 E2E Tests", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");
    // Check that the page loaded
    expect(page.url()).toContain("localhost");
  });

  test("can access API endpoint", async ({ page }) => {
    const response = await page.request.get("/api/hello");
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.message).toBe("Hello, world!");
  });

  test("can access API with parameter", async ({ page }) => {
    const response = await page.request.get("/api/hello/World");
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.message).toContain("World");
  });
});
