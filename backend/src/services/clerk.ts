import { verifyToken } from "@clerk/backend";

/**
 * Get Microsoft access token from Clerk
 */
export async function getMicrosoftToken(clerkUserId: string): Promise<string> {
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

  if (!CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY not configured");
  }

  // Get OAuth access token from Clerk
  const response = await fetch(
    `https://api.clerk.com/v1/users/${clerkUserId}/oauth_access_tokens/oauth_microsoft`,
    {
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get Microsoft token: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    throw new Error("No Microsoft connection found for user");
  }

  return data[0].token;
}

/**
 * Verify Clerk JWT token
 */
export async function verifyClerkToken(token: string) {
  const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

  if (!CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY not configured");
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    });

    return payload.sub; // sub contains the user ID
  } catch (error) {
    throw new Error("Invalid session token");
  }
}
