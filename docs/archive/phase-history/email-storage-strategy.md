# Email Storage & Sync Strategy

**Date:** 2025-11-21
**Status:** Architecture Planning

---

## 🎯 Core Questions Answered

### Q1: Do we store emails or fetch every time?
**Answer:** **Store metadata locally, fetch bodies on-demand**

### Q2: Do we fetch all emails every time?
**Answer:** **No - Initial sync once, then incremental updates**

### Q3: What type of data is an email?
**Answer:** **Structured metadata + text/HTML body + binary attachments**

### Q4: How are emails saved?
**Answer:** **Metadata in PostgreSQL, bodies cached, attachments in S3**

---

## 📊 Email Storage Architecture

### **Hybrid Approach: Store + Sync**

```
┌─────────────────────────────────────────────────┐
│  Microsoft Outlook (Source of Truth)            │
│  - User's actual mailbox                        │
│  - 10,000+ emails                               │
└─────────────┬───────────────────────────────────┘
              │
              │ Microsoft Graph API
              │
              ▼
┌─────────────────────────────────────────────────┐
│  Your App Database (PostgreSQL)                 │
│  - Email METADATA only                          │
│  - Custom fields (project links, tags, etc.)    │
│  - ~100 bytes per email                         │
└─────────────┬───────────────────────────────────┘
              │
              │ User opens email
              │
              ▼
┌─────────────────────────────────────────────────┐
│  Cache/S3 (Optional)                            │
│  - Email bodies (HTML/text)                     │
│  - Attachments (PDFs, images)                   │
└─────────────────────────────────────────────────┘
```

---

## 📧 What IS an Email?

### **Email Data Structure**

An email from Microsoft Graph API contains:

```json
{
  // IDENTIFIERS
  "id": "AAMkAGI2T...",
  "internetMessageId": "<abc123@mail.outlook.com>",
  "conversationId": "AAQkAGI2...",

  // ROUTING INFO
  "from": {
    "emailAddress": {
      "name": "John Doe",
      "address": "john@company.com"
    }
  },
  "toRecipients": [...],
  "ccRecipients": [...],
  "bccRecipients": [...],
  "replyTo": [...],

  // CONTENT
  "subject": "Project Update",
  "body": {
    "contentType": "html",
    "content": "<html>...</html>"  // Can be 100KB+
  },
  "bodyPreview": "First 255 chars...",

  // DATES
  "createdDateTime": "2025-11-21T10:30:00Z",
  "sentDateTime": "2025-11-21T10:30:00Z",
  "receivedDateTime": "2025-11-21T10:30:15Z",
  "lastModifiedDateTime": "2025-11-21T10:30:15Z",

  // STATUS
  "isRead": false,
  "isDraft": false,
  "hasAttachments": true,
  "importance": "normal",
  "flag": {...},

  // ATTACHMENTS (separate API call)
  "attachments": [
    {
      "id": "AAMk...",
      "name": "report.pdf",
      "contentType": "application/pdf",
      "size": 524288,  // bytes
      "isInline": false
    }
  ],

  // LOCATION
  "parentFolderId": "inbox",
  "webLink": "https://outlook.office.com/..."
}
```

### **Data Size Breakdown**

| Component | Size | Store Locally? |
|-----------|------|----------------|
| **Metadata** (subject, from, to, dates) | ~100-500 bytes | ✅ Yes (PostgreSQL) |
| **Body Preview** (first 255 chars) | ~255 bytes | ✅ Yes (PostgreSQL) |
| **Full Body** (HTML/text) | 1 KB - 1 MB+ | 🟡 Cache only (Redis/S3) |
| **Attachments** | 1 KB - 150 MB | ❌ Fetch on-demand or S3 |

**Example:**
- 10,000 emails × 500 bytes metadata = **5 MB** (very small!)
- 10,000 emails × 50 KB body avg = **500 MB** (too big!)
- Don't store full bodies - fetch when needed

---

## 🔄 Email Sync Strategy

### **Option 1: Always Fetch (❌ Not Recommended)**

```typescript
// BAD: Fetch from Outlook every time
app.get('/api/emails', async () => {
  const emails = await graphClient
    .api('/me/messages')
    .get();

  return emails;
});
```

**Problems:**
- ❌ Slow (500ms+ per request)
- ❌ Rate limits (Microsoft throttles at ~2000 requests/min)
- ❌ Can't add custom fields (project links, tags)
- ❌ Can't query efficiently
- ❌ Costs money (Microsoft Graph API calls)

---

### **Option 2: Store Metadata + Sync (✅ Recommended)**

#### **How It Works:**

**Step 1: Initial Sync (First Time)**
```typescript
// Fetch ALL emails from Outlook
const response = await graphClient
  .api('/me/mailFolders/inbox/messages/delta')
  .select('id,subject,from,receivedDateTime,hasAttachments,bodyPreview')
  .get();

// Store metadata in PostgreSQL
for (const email of response.value) {
  await db.insert('emails', {
    outlook_id: email.id,
    subject: email.subject,
    from_email: email.from.emailAddress.address,
    from_name: email.from.emailAddress.name,
    received_at: email.receivedDateTime,
    has_attachments: email.hasAttachments,
    body_preview: email.bodyPreview,
    is_read: email.isRead,

    // Your custom fields
    project_id: null,
    tags: [],
    notes: '',
  });
}

// Save the deltaLink for next sync
await db.update('sync_state', {
  delta_link: response['@odata.deltaLink']
});
```

**Step 2: Incremental Sync (Every 5 minutes)**
```typescript
// Get last deltaLink
const syncState = await db.get('sync_state');

// Fetch only CHANGES since last sync
const response = await fetch(syncState.delta_link);

// Process changes
for (const email of response.value) {
  if (email['@removed']) {
    // Email was deleted
    await db.delete('emails', { outlook_id: email.id });
  } else {
    // Email was added or updated
    await db.upsert('emails', {
      outlook_id: email.id,
      subject: email.subject,
      // ...
    });
  }
}

// Update deltaLink
await db.update('sync_state', {
  delta_link: response['@odata.deltaLink'],
  last_sync: new Date()
});
```

**Step 3: Real-time Updates (Optional)**
```typescript
// Subscribe to Outlook webhooks
await graphClient
  .api('/subscriptions')
  .post({
    changeType: 'created,updated,deleted',
    notificationUrl: 'https://yourapp.com/api/webhooks/outlook',
    resource: '/me/mailFolders/inbox/messages',
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
  });

// When webhook fires, run delta sync
app.post('/api/webhooks/outlook', async (req) => {
  // Microsoft notifies you of changes
  await runDeltaSync();
});
```

---

## 🗄️ Database Schema

### **emails table**

```sql
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,

  -- Outlook identifiers
  outlook_id VARCHAR(255) UNIQUE NOT NULL,
  conversation_id VARCHAR(255),
  internet_message_id VARCHAR(255),

  -- Routing info
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_emails JSONB,  -- Array of recipients
  cc_emails JSONB,

  -- Content metadata
  subject TEXT,
  body_preview TEXT,  -- First 255 chars
  has_attachments BOOLEAN DEFAULT false,

  -- Dates
  received_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  importance VARCHAR(20),

  -- YOUR custom fields
  project_id INTEGER REFERENCES projects(id),
  tags VARCHAR(50)[],
  notes TEXT,
  status VARCHAR(50),

  -- Sync metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_emails_outlook_id ON emails(outlook_id);
CREATE INDEX idx_emails_project_id ON emails(project_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_from_email ON emails(from_email);
```

### **email_attachments table**

```sql
CREATE TABLE email_attachments (
  id SERIAL PRIMARY KEY,
  email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,

  -- Outlook attachment info
  outlook_attachment_id VARCHAR(255),
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  size_bytes INTEGER,
  is_inline BOOLEAN DEFAULT false,

  -- Storage location
  storage_type VARCHAR(20),  -- 'outlook', 's3', 'sharepoint'
  s3_key VARCHAR(500),
  sharepoint_url TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

### **sync_state table**

```sql
CREATE TABLE sync_state (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  folder_id VARCHAR(255),  -- 'inbox', 'sent', etc.

  delta_link TEXT,  -- For incremental sync
  last_sync TIMESTAMP,
  status VARCHAR(50),

  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 📎 Attachment Handling

### **Strategy: Hybrid Approach**

#### **Option 1: Fetch on-demand (Small attachments)**
```typescript
// Don't download until user clicks
app.get('/api/emails/:id/attachments/:attachmentId', async (req) => {
  const attachment = await graphClient
    .api(`/me/messages/${req.params.id}/attachments/${req.params.attachmentId}`)
    .get();

  // Return contentBytes (base64)
  return {
    filename: attachment.name,
    contentType: attachment.contentType,
    data: attachment.contentBytes  // Base64
  };
});
```

**Pros:**
- ✅ No storage needed
- ✅ Always up-to-date
- ✅ Low database usage

**Cons:**
- ❌ Slow for users (500ms+ per download)
- ❌ Can't work offline
- ❌ Hits API rate limits

---

#### **Option 2: Download to S3 (Large/important attachments)**
```typescript
// Download attachment when email arrives
async function syncAttachment(emailId: string, attachment: any) {
  // Fetch from Outlook
  const response = await graphClient
    .api(`/me/messages/${emailId}/attachments/${attachment.id}`)
    .get();

  // Decode base64
  const buffer = Buffer.from(response.contentBytes, 'base64');

  // Upload to S3
  const s3Key = `attachments/${emailId}/${attachment.id}/${attachment.name}`;
  await s3Client.send(new PutObjectCommand({
    Bucket: 'your-bucket',
    Key: s3Key,
    Body: buffer,
    ContentType: attachment.contentType,
  }));

  // Save reference in database
  await db.insert('email_attachments', {
    email_id: emailId,
    outlook_attachment_id: attachment.id,
    filename: attachment.name,
    storage_type: 's3',
    s3_key: s3Key,
  });
}

// Later, serve from S3
app.get('/api/attachments/:id', async (req) => {
  const attachment = await db.get('email_attachments', req.params.id);

  // Generate presigned URL (temporary access)
  const url = await getSignedUrl(s3Client, new GetObjectCommand({
    Bucket: 'your-bucket',
    Key: attachment.s3_key,
  }), { expiresIn: 3600 });

  return { downloadUrl: url };
});
```

**Pros:**
- ✅ Fast for users (<50ms)
- ✅ Works offline
- ✅ No API rate limits
- ✅ Can process files (virus scan, OCR, etc.)

**Cons:**
- ❌ Storage costs (S3)
- ❌ Must sync when email arrives

---

#### **Recommended: Hybrid**

```typescript
// Small files: On-demand
// Large files (>1MB) or PDFs: Download to S3
async function handleAttachment(emailId: string, attachment: any) {
  const isPDF = attachment.contentType === 'application/pdf';
  const isLarge = attachment.size > 1_000_000; // 1MB

  if (isPDF || isLarge) {
    // Download to S3
    await downloadToS3(emailId, attachment);
  } else {
    // Just store metadata, fetch on-demand
    await db.insert('email_attachments', {
      email_id: emailId,
      outlook_attachment_id: attachment.id,
      filename: attachment.name,
      storage_type: 'outlook',  // Fetch when needed
    });
  }
}
```

---

## 🔄 Complete Sync Flow

### **Initial Setup (First Time)**

```typescript
async function initialSync(userId: number) {
  console.log('Starting initial email sync...');

  let deltaLink = null;
  let nextLink = `/me/mailFolders/inbox/messages/delta`;

  while (nextLink) {
    const response = await graphClient.api(nextLink)
      .select('id,subject,from,toRecipients,receivedDateTime,hasAttachments,bodyPreview,isRead')
      .top(100)  // Batch size
      .get();

    // Store emails in database
    for (const email of response.value) {
      await db.insert('emails', {
        user_id: userId,
        outlook_id: email.id,
        subject: email.subject,
        from_email: email.from.emailAddress.address,
        from_name: email.from.emailAddress.name,
        received_at: new Date(email.receivedDateTime),
        has_attachments: email.hasAttachments,
        body_preview: email.bodyPreview,
        is_read: email.isRead,
      });

      // Handle attachments if needed
      if (email.hasAttachments) {
        await syncEmailAttachments(userId, email.id);
      }
    }

    // Continue pagination or finish
    nextLink = response['@odata.nextLink'];
    deltaLink = response['@odata.deltaLink'];
  }

  // Save deltaLink for future syncs
  await db.insert('sync_state', {
    user_id: userId,
    folder_id: 'inbox',
    delta_link: deltaLink,
    last_sync: new Date(),
  });

  console.log('Initial sync complete!');
}
```

### **Incremental Sync (Every 5 minutes)**

```typescript
async function incrementalSync(userId: number) {
  const syncState = await db.get('sync_state', { user_id: userId });

  if (!syncState.delta_link) {
    throw new Error('No delta link - run initial sync first');
  }

  const response = await fetch(syncState.delta_link);
  const data = await response.json();

  for (const email of data.value) {
    if (email['@removed']) {
      // Email was deleted in Outlook
      await db.delete('emails', {
        user_id: userId,
        outlook_id: email.id
      });
    } else {
      // Email was created or updated
      await db.upsert('emails', {
        user_id: userId,
        outlook_id: email.id,
        subject: email.subject,
        // ... other fields
        updated_at: new Date(),
      });
    }
  }

  // Update delta link
  await db.update('sync_state', {
    user_id: userId,
    delta_link: data['@odata.deltaLink'],
    last_sync: new Date(),
  });
}

// Run every 5 minutes
setInterval(() => {
  incrementalSync(currentUserId);
}, 5 * 60 * 1000);
```

### **Real-time Sync (via Webhooks)**

```typescript
// Step 1: Subscribe to Outlook notifications
async function subscribeToOutlook(userId: number) {
  const subscription = await graphClient
    .api('/subscriptions')
    .post({
      changeType: 'created,updated,deleted',
      notificationUrl: 'https://yourapp.com/api/webhooks/outlook',
      resource: '/me/mailFolders/inbox/messages',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      clientState: userId.toString(),  // Verify webhook authenticity
    });

  // Save subscription ID to renew later
  await db.update('users', {
    id: userId,
    outlook_subscription_id: subscription.id,
  });
}

// Step 2: Handle webhook notifications
app.post('/api/webhooks/outlook', async (req) => {
  const notifications = req.body.value;

  for (const notification of notifications) {
    const userId = parseInt(notification.clientState);

    // Run incremental sync
    await incrementalSync(userId);
  }

  return { status: 'ok' };
});

// Step 3: Renew subscriptions (before 3 days expire)
setInterval(async () => {
  const users = await db.getAll('users', {
    outlook_subscription_id: { $ne: null }
  });

  for (const user of users) {
    await graphClient
      .api(`/subscriptions/${user.outlook_subscription_id}`)
      .patch({
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      });
  }
}, 24 * 60 * 60 * 1000); // Daily
```

---

## 📊 Storage Size Estimates

### **Example: User with 10,000 emails**

| Data | Size per Email | Total Size |
|------|----------------|------------|
| Metadata (in PostgreSQL) | 500 bytes | 5 MB |
| Body preview (255 chars) | 255 bytes | 2.5 MB |
| Full bodies (if cached) | 50 KB avg | 500 MB |
| Attachments (PDFs in S3) | 200 KB avg × 30% | 600 MB |

**Database:** ~7.5 MB (very manageable!)
**S3 Storage:** ~600 MB (if you cache bodies + attachments)

**For 1,000 users:**
- PostgreSQL: ~7.5 GB
- S3: ~600 GB

**Very reasonable!**

---

## ⚡ Performance Optimization

### **1. Selective Sync**
```typescript
// Only sync recent emails (last 30 days)
const response = await graphClient
  .api('/me/mailFolders/inbox/messages/delta')
  .filter(`receivedDateTime ge ${thirtyDaysAgo.toISOString()}`)
  .get();
```

### **2. Background Sync**
```typescript
// Don't block user - sync in background
app.post('/api/auth/outlook/callback', async (req) => {
  const userId = req.user.id;

  // Queue background job
  await jobQueue.add('initial-email-sync', { userId });

  // Let user into app immediately
  return { success: true, message: 'Syncing emails in background' };
});
```

### **3. Fetch Bodies on Demand**
```typescript
// User clicks email
app.get('/api/emails/:id/body', async (req) => {
  const email = await db.get('emails', req.params.id);

  // Check cache first
  const cached = await redis.get(`email:${email.outlook_id}:body`);
  if (cached) return { body: cached };

  // Fetch from Outlook
  const message = await graphClient
    .api(`/me/messages/${email.outlook_id}`)
    .select('body')
    .get();

  // Cache for 1 hour
  await redis.setex(`email:${email.outlook_id}:body`, 3600, message.body.content);

  return { body: message.body.content };
});
```

---

## 🎯 Recommended Implementation

### **Phase 1: Basic Sync**
1. ✅ Store email metadata in PostgreSQL
2. ✅ Implement delta sync (incremental updates)
3. ✅ Fetch bodies on-demand

### **Phase 2: Performance**
1. ✅ Add Redis cache for email bodies
2. ✅ Download PDF attachments to S3
3. ✅ Background job for initial sync

### **Phase 3: Real-time**
1. ✅ Subscribe to Outlook webhooks
2. ✅ Instant sync when emails arrive
3. ✅ WebSocket to notify frontend

---

## 📝 Summary

### **Email Storage Strategy:**

1. **Metadata** → PostgreSQL (fast queries, custom fields)
2. **Bodies** → Fetch on-demand, cache in Redis
3. **Attachments** → PDFs in S3, others on-demand
4. **Sync** → Delta query every 5 min + webhooks for real-time

### **What Outlook Desktop Does:**

- Downloads **everything** locally (headers, bodies, attachments)
- Stores in local `.ost` file (~5-10 GB)
- Syncs changes via Exchange protocol

### **What Outlook Web Does:**

- Fetches **nothing** locally (all remote)
- Loads emails on-demand from servers
- Slower but no storage needed

### **What You Should Do:**

**Hybrid approach** (best of both):
- Store **metadata** locally (fast queries)
- Fetch **bodies** on-demand (save space)
- Cache frequently accessed data (Redis)
- Download **important attachments** (S3)

---

**Last Updated:** 2025-11-21
**Next Steps:** Implement initial sync and database schema
