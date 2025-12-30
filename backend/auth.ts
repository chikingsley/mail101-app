/**
 * Graph API Authentication Script
 * Run once to get a token and cache it: bun run auth
 * Then tests will use the cached token automatically
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { getAccessTokenDeviceFlow } from "./src/services/graph-auth";

async function authenticate() {
  try {
    console.log("🔐 Authenticating with Microsoft Graph API...\n");
    const response = await getAccessTokenDeviceFlow();

    // Save token to cache file
    const tokenCacheFile = join(process.cwd(), ".graph-token-cache");
    const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
    writeFileSync(
      tokenCacheFile,
      JSON.stringify({ token: response.access_token, expiresAt }, null, 2)
    );

    console.log("\n✅ Authentication successful! Token cached.\n");
    console.log("Now you can run: bun test");
  } catch (error) {
    console.error("❌ Authentication failed:", error);
    process.exit(1);
  }
}

authenticate();
