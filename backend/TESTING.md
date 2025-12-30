# Backend Testing Guide

## Unit Tests

Run unit tests with Bun:

```bash
cd backend
bun test
```

Run with coverage:

```bash
bun test --coverage
```

Watch mode:

```bash
bun test --watch
```

## Integration Tests - Graph API

The backend includes integration tests for the Microsoft Graph API. These tests verify actual functionality against the real API.

### Prerequisites

To run Graph API integration tests, you need:
1. A Microsoft/Outlook account
2. A delegated access token (with Mail.Read, Mail.ReadWrite permissions)
3. (Optional) Email ID for testing specific operations

### Important: Authentication Method

The Graph API endpoints used in testing require **delegated authentication** (user context), not app-only authentication. The Azure app credentials in `.env` are configured for app-only access and **cannot directly call the Mail API endpoints**.

### Getting a Delegated Access Token

#### Option 1: Graph Explorer (Recommended for Testing)

This is the fastest way to test:

1. Go to [Microsoft Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
2. Sign in with your Microsoft account
3. You'll be automatically granted Mail.Read permissions
4. Open Developer Tools (F12) → Console tab
5. Run this to copy the token:
   ```javascript
   localStorage.getItem('access_token')
   ```
6. Copy the token and set as environment variable:
   ```bash
   export GRAPH_API_TEST_TOKEN="eyJ0eXAiOiJKV1QiLC..."
   ```

#### Option 2: Reconfigure Azure App for Delegated Flow

For production use or persistent testing:

1. Go to [Azure Portal](https://portal.azure.com) → App registrations
2. Select your application
3. Go to "API permissions" and add:
   - Mail.Read (for reading emails)
   - Mail.ReadWrite (for updating emails)
   - Mail.Send (for sending emails)
4. Configure authentication for **user login** (OAuth 2.0 authorization code flow)
5. Get a token through the OAuth flow
6. Set as `GRAPH_API_TEST_TOKEN` environment variable

### Running Graph API Tests

**Step 1: Authenticate once**

```bash
cd backend
bun run auth
```

This will:
1. Show you a code like `F5HXVQ9AW`
2. Open https://microsoft.com/devicelogin in your browser
3. Enter the code and approve
4. Token is automatically cached in `.graph-token-cache`

**Step 2: Run tests**

Now tests will use the cached token automatically:

```bash
bun test
```

**Token reuse:**
- Cached token is valid for ~1 hour
- Run `bun auth` again if token expires
- Or set `GRAPH_API_TEST_TOKEN` env var with a delegated token

### What Gets Tested

With a valid token, the integration tests verify:

1. **Email Fetching**
   - Fetch emails from inbox
   - Fetch email body content
   - Pagination (next/delta links)

2. **Email Operations**
   - Mark emails as read/unread
   - Flag/unflag emails
   - Move emails between folders (inbox, archive, junk, etc)
   - Delete emails

3. **Email Sync**
   - Delta sync (incremental changes)
   - Multi-folder sync
   - Handling new, updated, deleted emails

4. **Webhook Subscriptions**
   - Create subscriptions for mail changes
   - List active subscriptions
   - Renew subscriptions
   - Delete subscriptions

5. **Error Handling**
   - Invalid email IDs
   - Invalid tokens
   - API error responses

### Expected Results

```
src/services/graph.test.ts:
✓ should fetch emails from inbox
✓ should fetch email body
✓ should update email read status
✓ should update email flag status
✓ should get delta emails for sync
✓ should support delta pagination
✓ should move email between folders
✓ should delete email
✓ should handle multiple folders
✓ should create webhook subscription
✓ should list subscriptions
✓ should renew subscription
✓ should handle API errors gracefully
✓ Invalid token handling working
```

### Coverage Goals

**Current Coverage:**
- Database operations: 17%
- Graph API: 21%
- Email routes: 15%
- Clerk auth: 5%

**Target Coverage:**
- Core email sync: 70%+
- Email CRUD operations: 80%+
- Error handling: 90%+

### Continuous Testing

For development, run tests in watch mode:

```bash
bun test --watch
```

This automatically re-runs tests as you modify code.

### CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
# .github/workflows/test.yml
env:
  GRAPH_API_TEST_TOKEN: ${{ secrets.GRAPH_API_TEST_TOKEN }}
  GRAPH_API_TEST_EMAIL_ID: ${{ secrets.GRAPH_API_TEST_EMAIL_ID }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: cd backend && bun install
      - run: bun test --coverage
```

### Notes

- Tests that require a valid token are automatically skipped if `GRAPH_API_TEST_TOKEN` is not set
- No test data is created permanently - all operations are reversible (move to archive, unread, unflag, etc)
- Token expires after ~1 hour - get a new one if tests fail with auth errors
- Real emails in your mailbox are tested and modified - use a dedicated test email account if possible
