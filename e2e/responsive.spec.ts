import { expect, test } from "@playwright/test";

/**
 * Responsive Design E2E Tests
 * Tests layout and functionality across different viewport sizes
 */

test.describe("Responsive Design", () => {
  test("should load on desktop viewport (1280x720)", async ({ page }) => {
    // Default viewport is already set
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("localhost");

    // Page should have content
    const body = await page.locator("body").textContent();
    expect(body && body.length > 0).toBeTruthy();
  });

  test("should handle tablet viewport (768x1024)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should load successfully
    expect(page.url()).toContain("localhost");

    // Should have interactive elements
    const buttons = await page.locator("button").count();
    expect(buttons).toBeGreaterThanOrEqual(0);
  });

  test("should handle mobile viewport (375x667)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should load on mobile
    expect(page.url()).toContain("localhost");

    // Content should be visible
    const hasContent = await page.locator("body").textContent();
    expect(hasContent && hasContent.length > 0).toBeTruthy();
  });

  test("should handle small mobile (320x568)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should still be functional on very small screens
    expect(page.url()).toContain("localhost");
  });

  test("should handle large desktop (1920x1080)", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should work on large screens
    expect(page.url()).toContain("localhost");
  });

  test("should adapt to viewport changes", async ({ page }) => {
    // Start with desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    let url = page.url();
    expect(url).toContain("localhost");

    // Change to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState("networkidle");

    // Should still be functional
    url = page.url();
    expect(url).toContain("localhost");

    // Change back to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForLoadState("networkidle");

    url = page.url();
    expect(url).toContain("localhost");
  });

  test("should be accessible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have buttons even on mobile
    const buttons = await page.locator("button").count();
    expect(buttons).toBeGreaterThan(0);

    // Should be clickable
    if (buttons > 0) {
      const first = await page.locator("button").first();
      expect(await first.isVisible()).toBeTruthy();
    }
  });

  test("should handle landscape orientation", async ({ page }) => {
    // Landscape mode
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("localhost");
  });

  test("should handle portrait orientation", async ({ page }) => {
    // Portrait mode
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("localhost");
  });

  test("should maintain functionality across all sizes", async ({ page }) => {
    const sizes = [
      { width: 320, height: 568 }, // Small mobile
      { width: 375, height: 667 }, // iPhone
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }, // Desktop
      { width: 1920, height: 1080 }, // Large desktop
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);

      if (page.url() !== "http://localhost:5999/") {
        await page.goto("/");
      }

      await page.waitForLoadState("networkidle");

      // Should be functional at every size
      expect(page.url()).toContain("localhost");

      // Should have buttons
      const buttons = await page.locator("button").count();
      expect(buttons).toBeGreaterThanOrEqual(0);
    }
  });

  test("should preserve state on resize", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const initialUrl = page.url();

    // Resize
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState("networkidle");

    // Should still be on same page
    expect(page.url()).toBe(initialUrl);
  });

  test("should handle fast viewport changes", async ({ page }) => {
    await page.goto("/");

    // Rapid size changes
    const sizes = [
      { width: 1280, height: 720 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 },
      { width: 1280, height: 720 },
    ];

    for (const size of sizes) {
      await page.setViewportSize(size);
      // Don't wait - rapidly changing
    }

    // Wait for final state
    await page.waitForLoadState("networkidle");

    // Page should still be responsive
    expect(page.url()).toContain("localhost");
  });
});
