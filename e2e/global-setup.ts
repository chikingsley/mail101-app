import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Global setup for E2E tests
 * Handles authentication and saves session state for reuse across tests
 */

const authDir = "playwright/.auth";
const authFile = path.join(authDir, "user.json");

async function globalSetup(config: FullConfig) {
  // Skip auth if state already exists and is recent (less than 1 day old)
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

    if (ageInHours < 24) {
      console.log("✓ Using cached authentication state");
      return;
    }
  }

  console.log("🔐 Setting up authentication...");

  // Create auth directory
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to app
    await page.goto("http://localhost:5999");
    await page.waitForLoadState("networkidle");

    // Check if already logged in
    const isLoggedIn = await page
      .locator("text=/Sign out/i")
      .isVisible()
      .catch(() => false);

    if (isLoggedIn) {
      console.log("✓ Already authenticated");
      // Save current state
      const storageState = await page.context().storageState();
      fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
      await browser.close();
      return;
    }

    // Look for sign in button
    const signInBtn = page.locator("button:has-text('Sign in')");

    if (!(await signInBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(
        "⚠ Sign in button not found - app may not require authentication"
      );
      console.log("  Saving empty auth state");
      const storageState = await page.context().storageState();
      fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
      await browser.close();
      return;
    }

    console.log("📧 Clerk sign-in detected - attempting authentication");
    await signInBtn.click();

    // Wait for sign-in modal/page
    await page.waitForLoadState("networkidle");

    // Check for email input or sign-in options
    const emailInput = page.locator(
      "input[type='email'], input[placeholder*='email']"
    );

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Use test credentials from environment or prompt
      const testEmail = process.env.TEST_USER_EMAIL;
      const testPassword = process.env.TEST_USER_PASSWORD;

      if (testEmail && testPassword) {
        console.log(`🔑 Attempting login with ${testEmail}`);
        await emailInput.fill(testEmail);

        // Click continue or next
        const continueBtn = page.locator(
          "button:has-text('Continue'), button:has-text('Next')"
        );
        if (await continueBtn.isVisible()) {
          await continueBtn.click();
        }

        // Wait for password input
        const passwordInput = page.locator(
          "input[type='password'], input[placeholder*='password']"
        );

        if (
          await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)
        ) {
          await passwordInput.fill(testPassword);

          // Click sign in
          const signInSubmit = page.locator(
            "button:has-text('Sign in'), button:has-text('Continue')"
          );
          if (await signInSubmit.isVisible()) {
            await signInSubmit.click();
          }
        }

        // Wait for redirect to app
        await page.waitForURL("http://localhost:5999", { timeout: 10_000 });
        await page.waitForLoadState("networkidle");

        console.log("✓ Login successful");
      } else {
        console.warn(
          "⚠ Test user credentials not found in environment variables"
        );
        console.warn(
          "   Set TEST_USER_EMAIL and TEST_USER_PASSWORD to enable automated login"
        );
        console.warn(
          "   For manual testing, you can log in once and the session will be saved"
        );

        // Wait for manual login
        console.log("   Waiting 60 seconds for manual login...");
        await page.waitForTimeout(60_000);

        // Check if logged in
        const manualLoginCheck = await page
          .locator("text=/Sign out/i, text=/Signed in/i")
          .isVisible()
          .catch(() => false);

        if (manualLoginCheck) {
          console.log("✓ Manual login successful");
        } else {
          console.error("✗ Manual login timeout");
        }
      }
    } else {
      console.log(
        "⚠ Sign-in flow is different than expected - may require manual setup"
      );
      console.log("   Waiting 60 seconds for login...");
      await page.waitForTimeout(60_000);
    }

    // Save authentication state
    const storageState = await page.context().storageState();
    fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
    console.log(`✓ Auth state saved to ${authFile}`);
  } catch (error) {
    console.error("✗ Authentication setup failed:", error);
    // Continue anyway - tests may work without auth
  } finally {
    await browser.close();
  }
}

export default globalSetup;
