/**
 * Graph API Authentication Helper
 * Gets access token using Azure AD Device Flow (interactive) or delegated token
 */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface DeviceFlowResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
}

/**
 * Get delegated access token using Device Flow
 * User enters the code in browser, token is cached automatically
 */
export async function getAccessTokenDeviceFlow(): Promise<string> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!(clientId && tenantId)) {
    throw new Error(
      "Missing Azure credentials: AZURE_CLIENT_ID, AZURE_TENANT_ID"
    );
  }

  // Step 1: Request device code
  const deviceFlowUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`;

  const deviceParams = new URLSearchParams({
    client_id: clientId,
    scope: "Mail.Read Mail.ReadWrite Calendars.Read offline_access",
  });

  const deviceResponse = await fetch(deviceFlowUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: deviceParams.toString(),
  });

  if (!deviceResponse.ok) {
    const error = await deviceResponse.text();
    throw new Error(
      `Failed to get device code: ${deviceResponse.status} ${error}`
    );
  }

  const deviceData = (await deviceResponse.json()) as DeviceFlowResponse;

  // Display to user
  console.log("\n📱 Device Flow Authentication");
  console.log(`Enter this code: ${deviceData.user_code}`);
  console.log(`Or visit: ${deviceData.verification_uri}\n`);

  // Step 2: Poll for token
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const pollInterval = (deviceData.interval || 5) * 1000;
  const maxWait = Math.min(deviceData.expires_in * 1000, 30 * 60 * 1000); // 30 min max
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const tokenParams = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: deviceData.device_code,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();

    // Check for authorization pending
    if (tokenData.error === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }

    if (tokenData.error) {
      throw new Error(
        `Device flow error: ${tokenData.error} - ${tokenData.error_description}`
      );
    }

    if (tokenData.access_token) {
      console.log("\n✓ Successfully authenticated!");
      return {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in || 3600,
      } as TokenResponse;
    }
  }

  throw new Error("Device flow timeout - user did not authenticate in time");
}

/**
 * Get an access token - tries cached token first, then device flow
 */
export async function getAccessToken(): Promise<string> {
  // Check if delegated token is provided
  const delegatedToken = process.env.GRAPH_API_TEST_TOKEN;
  if (delegatedToken) {
    return delegatedToken;
  }

  // Use device flow for interactive authentication
  return getAccessTokenDeviceFlow();
}

/**
 * Cache token with expiration
 * Persists to file so you only authenticate once
 */
let cachedToken: {
  token: string;
  expiresAt: number;
} | null = null;

const tokenCacheFile = `${process.cwd()}/.graph-token-cache`;

function loadCachedToken(): string | null {
  try {
    const fs = require("fs");
    if (fs.existsSync(tokenCacheFile)) {
      const data = JSON.parse(fs.readFileSync(tokenCacheFile, "utf-8"));
      const now = Date.now();
      // Return if still valid (with 1 minute buffer)
      if (data.expiresAt > now + 60_000) {
        return data.token;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
}

function saveCachedToken(token: string, expiresIn: number): void {
  try {
    const fs = require("fs");
    const expiresAt = Date.now() + expiresIn * 1000;
    fs.writeFileSync(
      tokenCacheFile,
      JSON.stringify({ token, expiresAt }, null, 2)
    );
  } catch {
    // Ignore save errors
  }
}

export async function getCachedAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  // Try loading from file
  const fileToken = loadCachedToken();
  if (fileToken) {
    cachedToken = {
      token: fileToken,
      expiresAt: now + 3_600_000,
    };
    return fileToken;
  }

  // No cached token found
  throw new Error(
    "No cached token. Run 'bun auth' in the backend directory to authenticate."
  );
}
