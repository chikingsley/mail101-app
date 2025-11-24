# Complete Architecture Plan

**Date:** 2025-11-21
**Status:** Final Architecture Design

---

## 📊 **Database Choice: PostgreSQL** ✅

### **PostgreSQL vs SQLite vs MongoDB**

| Feature | PostgreSQL | SQLite | MongoDB |
|---------|-----------|---------|----------|
| **Multi-user** | ✅ Excellent | ❌ Single process | ✅ Good |
| **Complex queries** | ✅ Full SQL | ✅ SQL but limited | ❌ Weak joins |
| **Relations** | ✅ Native joins | ✅ Joins | ❌ Manual |
| **Geospatial (Maps)** | ✅ PostGIS extension | 🟡 Limited | ✅ Good |
| **Scalability** | ✅ Millions of rows | ❌ <2GB practical | ✅ Horizontal scaling |
| **ACID compliance** | ✅ Full | ✅ Full | 🟡 Eventually consistent |
| **Prisma support** | ✅ Excellent | ✅ Good | ✅ Good |
| **Production ready** | ✅ Yes | ❌ Dev only | ✅ Yes |

### **Your Requirements:**

| Need | Why PostgreSQL? |
|------|----------------|
| **Emails ↔ Projects ↔ Contacts** | ✅ Complex joins are fast |
| **Map integration (sales locations)** | ✅ PostGIS extension (built for maps!) |
| **Estimates, Invoices, Surveys** | ✅ Relational data with foreign keys |
| **Filter/search across tables** | ✅ Powerful SQL queries |
| **Multi-user (sales team)** | ✅ Built for concurrent users |
| **Grow to 100k+ emails** | ✅ Scales easily |

### **Decision: PostgreSQL** ✅

**Why:**
1. ✅ PostGIS for map features (show nearby accounts on map)
2. ✅ Complex joins (emails + projects + contacts + companies)
3. ✅ Production-ready for multi-user app
4. ✅ Excellent Prisma support
5. ✅ Industry standard for SaaS apps

**NOT MongoDB because:**
- ❌ Weak at complex relationships
- ❌ No native joins (everything is manual)
- ❌ Your data is highly relational

**NOT SQLite because:**
- ❌ Single-process (can't handle multiple sales people)
- ❌ Not for production

---

## 🗄️ **Complete Database Schema**

### **Overview of All Tables**

```
Core Entities:
├── users (sales people, admins)
├── companies (customer companies)
├── contacts (people at companies)
├── projects (active work)
└── locations (for map feature)

Email System:
├── emails (metadata)
├── email_threads (conversations)
├── email_attachments
└── email_labels/tags

Project Management:
├── projects
├── tasks (kanban items)
├── estimates
├── invoices
└── surveys

Inspection/Field Work:
├── inspections
├── inspection_photos
└── inspection_reports

Files:
├── files (PDFs, docs)
└── file_versions

System:
├── sync_state (email sync tracking)
├── activity_log (audit trail)
└── webhooks (Microsoft subscriptions)
```

---

### **1. Users & Auth**

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,

  -- Auth
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,

  -- Microsoft OAuth
  outlook_access_token TEXT,  -- Encrypted
  outlook_refresh_token TEXT,  -- Encrypted
  outlook_token_expires_at TIMESTAMP,
  outlook_subscription_id VARCHAR(255),

  -- Role
  role VARCHAR(50) DEFAULT 'user',  -- 'admin', 'sales', 'user'

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

---

### **2. Companies (Customer Organizations)**

```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  phone VARCHAR(50),
  industry VARCHAR(100),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'US',

  -- Geolocation (for map feature!)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT),  -- PostGIS for map queries

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'prospect'

  -- Owner
  assigned_to INTEGER REFERENCES users(id),

  -- Metadata
  notes TEXT,
  tags VARCHAR(50)[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_assigned_to ON companies(assigned_to);
CREATE INDEX idx_companies_status ON companies(status);

-- PostGIS spatial index for map queries
CREATE INDEX idx_companies_location ON companies USING GIST(location);
```

---

### **3. Contacts (People at Companies)**

```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,

  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

  -- Basic info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),

  -- Job info
  job_title VARCHAR(100),
  department VARCHAR(100),

  -- Communication
  preferred_contact_method VARCHAR(50),  -- 'email', 'phone', 'both'

  -- Status
  is_primary_contact BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  notes TEXT,
  tags VARCHAR(50)[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_name ON contacts(first_name, last_name);
```

---

### **4. Emails (Enhanced Schema)**

```sql
CREATE TABLE emails (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- Outlook identifiers
  outlook_id VARCHAR(255) UNIQUE NOT NULL,
  conversation_id VARCHAR(255),
  internet_message_id VARCHAR(255),
  thread_id INTEGER REFERENCES email_threads(id),

  -- Routing info
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  to_emails JSONB,  -- Array of {name, email}
  cc_emails JSONB,
  bcc_emails JSONB,

  -- Content
  subject TEXT,
  body_preview TEXT,  -- First 255 chars
  has_attachments BOOLEAN DEFAULT false,

  -- Dates
  received_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status
  is_read BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  importance VARCHAR(20) DEFAULT 'normal',  -- 'low', 'normal', 'high'

  -- Relationships (YOUR custom fields!)
  company_id INTEGER REFERENCES companies(id),
  contact_id INTEGER REFERENCES contacts(id),
  project_id INTEGER REFERENCES projects(id),

  -- Classification
  category VARCHAR(50),  -- 'project', 'estimate', 'invoice', 'general'
  tags VARCHAR(50)[],

  -- Metadata
  notes TEXT,

  -- Sync
  outlook_folder_id VARCHAR(255) DEFAULT 'inbox',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes (critical for performance!)
CREATE INDEX idx_emails_outlook_id ON emails(outlook_id);
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_company_id ON emails(company_id);
CREATE INDEX idx_emails_contact_id ON emails(contact_id);
CREATE INDEX idx_emails_project_id ON emails(project_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_from_email ON emails(from_email);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_emails_conversation_id ON emails(conversation_id);

-- Full-text search
CREATE INDEX idx_emails_subject_search ON emails USING GIN(to_tsvector('english', subject));
```

---

### **5. Email Threads (Conversations)**

```sql
CREATE TABLE email_threads (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id),
  conversation_id VARCHAR(255) UNIQUE,

  -- Thread info
  subject TEXT,
  participant_emails JSONB,  -- All people in thread
  message_count INTEGER DEFAULT 1,

  -- Latest message
  latest_message_at TIMESTAMP,
  latest_from_email VARCHAR(255),

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  project_id INTEGER REFERENCES projects(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_email_threads_conversation_id ON email_threads(conversation_id);
CREATE INDEX idx_email_threads_company_id ON email_threads(company_id);
```

---

### **6. Email Attachments**

```sql
CREATE TABLE email_attachments (
  id SERIAL PRIMARY KEY,

  email_id INTEGER REFERENCES emails(id) ON DELETE CASCADE,

  -- Outlook info
  outlook_attachment_id VARCHAR(255),
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100),
  size_bytes INTEGER,
  is_inline BOOLEAN DEFAULT false,

  -- Storage location
  storage_type VARCHAR(20),  -- 'outlook', 's3', 'sharepoint'
  s3_key VARCHAR(500),
  s3_bucket VARCHAR(100),
  sharepoint_url TEXT,

  -- Processing status
  virus_scanned BOOLEAN DEFAULT false,
  ocr_processed BOOLEAN DEFAULT false,  -- For PDF text extraction

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);
CREATE INDEX idx_email_attachments_filename ON email_attachments(filename);
```

---

### **7. Projects**

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_number VARCHAR(50) UNIQUE,  -- e.g., "PRJ-2025-001"

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  assigned_to INTEGER REFERENCES users(id),

  -- Status
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'on-hold', 'completed', 'cancelled'
  priority VARCHAR(20) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'urgent'

  -- Dates
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMP,

  -- Financial
  estimated_value DECIMAL(10, 2),
  actual_value DECIMAL(10, 2),

  -- Metadata
  tags VARCHAR(50)[],
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_project_number ON projects(project_number);
```

---

### **8. Tasks (Kanban Board Items)**

```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,

  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,

  -- Task info
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Kanban position
  status VARCHAR(50) DEFAULT 'todo',  -- 'todo', 'in-progress', 'review', 'done'
  position INTEGER,  -- For drag-drop ordering

  -- Assignment
  assigned_to INTEGER REFERENCES users(id),

  -- Priority
  priority VARCHAR(20) DEFAULT 'medium',

  -- Dates
  due_date DATE,
  completed_at TIMESTAMP,

  -- Relationships
  email_id INTEGER REFERENCES emails(id),  -- Created from email

  -- Metadata
  tags VARCHAR(50)[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_email_id ON tasks(email_id);
```

---

### **9. Estimates**

```sql
CREATE TABLE estimates (
  id SERIAL PRIMARY KEY,

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  project_id INTEGER REFERENCES projects(id),
  created_by INTEGER REFERENCES users(id),

  -- Estimate info
  estimate_number VARCHAR(50) UNIQUE,  -- e.g., "EST-2025-001"
  title VARCHAR(255),
  description TEXT,

  -- Financial
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  total DECIMAL(10, 2),

  -- Status
  status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'accepted', 'rejected'

  -- Dates
  valid_until DATE,
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,

  -- Files
  pdf_url TEXT,  -- Generated PDF in S3

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE estimate_line_items (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER REFERENCES estimates(id) ON DELETE CASCADE,

  description TEXT,
  quantity DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  total DECIMAL(10, 2),

  position INTEGER
);
```

---

### **10. Invoices**

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  project_id INTEGER REFERENCES projects(id),
  estimate_id INTEGER REFERENCES estimates(id),  -- Link to accepted estimate
  created_by INTEGER REFERENCES users(id),

  -- Invoice info
  invoice_number VARCHAR(50) UNIQUE,  -- e.g., "INV-2025-001"

  -- Financial
  subtotal DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  total DECIMAL(10, 2),
  paid_amount DECIMAL(10, 2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'

  -- Dates
  issue_date DATE,
  due_date DATE,
  paid_at TIMESTAMP,

  -- Files
  pdf_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,

  description TEXT,
  quantity DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  total DECIMAL(10, 2),

  position INTEGER
);
```

---

### **11. Inspections (Field Work)**

```sql
CREATE TABLE inspections (
  id SERIAL PRIMARY KEY,

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  project_id INTEGER REFERENCES projects(id),
  inspector_id INTEGER REFERENCES users(id),

  -- Inspection info
  inspection_number VARCHAR(50) UNIQUE,
  inspection_type VARCHAR(100),  -- 'initial', 'follow-up', 'final'

  -- Location
  location_address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT),

  -- Status
  status VARCHAR(50) DEFAULT 'scheduled',  -- 'scheduled', 'in-progress', 'completed'

  -- Dates
  scheduled_date TIMESTAMP,
  completed_at TIMESTAMP,

  -- Findings
  notes TEXT,
  findings JSONB,  -- Structured inspection data

  -- Report
  report_pdf_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inspection_photos (
  id SERIAL PRIMARY KEY,
  inspection_id INTEGER REFERENCES inspections(id) ON DELETE CASCADE,

  s3_key VARCHAR(500),
  s3_bucket VARCHAR(100),
  caption TEXT,

  -- Photo metadata
  taken_at TIMESTAMP,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **12. Surveys**

```sql
CREATE TABLE surveys (
  id SERIAL PRIMARY KEY,

  -- Relationships
  company_id INTEGER REFERENCES companies(id),
  project_id INTEGER REFERENCES projects(id),
  contact_id INTEGER REFERENCES contacts(id),

  -- Survey info
  survey_type VARCHAR(100),
  title VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'completed'

  -- Dates
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Responses
  responses JSONB,  -- Flexible survey answers

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### **13. Files (Unified File Management)**

```sql
CREATE TABLE files (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id),

  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  content_type VARCHAR(100),
  size_bytes INTEGER,

  -- Storage
  storage_type VARCHAR(20),  -- 's3', 'sharepoint'
  s3_key VARCHAR(500),
  s3_bucket VARCHAR(100),
  sharepoint_url TEXT,

  -- Relationships (polymorphic)
  related_type VARCHAR(50),  -- 'project', 'company', 'email', 'inspection'
  related_id INTEGER,

  -- PDF-specific
  is_pdf BOOLEAN DEFAULT false,
  pdf_page_count INTEGER,
  pdf_text_extracted BOOLEAN DEFAULT false,

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_file_id INTEGER REFERENCES files(id),

  -- Metadata
  tags VARCHAR(50)[],
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_related ON files(related_type, related_id);
CREATE INDEX idx_files_user_id ON files(user_id);
```

---

### **14. Sync State (Email Sync Tracking)**

```sql
CREATE TABLE sync_state (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id),
  folder_id VARCHAR(255),  -- 'inbox', 'sent', etc.

  -- Delta sync
  delta_link TEXT,
  last_sync TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'idle',  -- 'idle', 'syncing', 'error'
  error_message TEXT,

  -- Stats
  total_emails_synced INTEGER DEFAULT 0,
  last_email_count INTEGER,

  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_state_user_id ON sync_state(user_id);
```

---

### **15. Activity Log (Audit Trail)**

```sql
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,

  user_id INTEGER REFERENCES users(id),

  -- Action
  action VARCHAR(100),  -- 'email.created', 'project.updated', etc.
  entity_type VARCHAR(50),  -- 'email', 'project', 'company'
  entity_id INTEGER,

  -- Details
  description TEXT,
  changes JSONB,  -- Old/new values

  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
```

---

## 🗺️ **Map Feature: PostGIS**

### **Enable PostGIS Extension**

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### **Query Nearby Companies (Sales Feature!)**

```sql
-- Find companies within 10 miles of a location
SELECT
  c.id,
  c.name,
  c.address_line1,
  c.city,
  ST_Distance(
    c.location,
    ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography
  ) / 1609.34 AS distance_miles
FROM companies c
WHERE ST_DWithin(
  c.location,
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
  16093.4  -- 10 miles in meters
)
ORDER BY distance_miles;
```

**Use case:** Sales person is at a client, opens map, sees all nearby companies they should visit!

---

## 🎨 **State Management: Stick with Zustand** ✅

### **Legend State vs Zustand vs Jotai**

| Library | Size | Performance | Complexity | Your Fit |
|---------|------|-------------|------------|----------|
| **Zustand** | 3KB | Fast | ⭐ Simple | ✅ **Best** |
| **Legend State** | 4KB | ⚡ Fastest | ⭐⭐ Moderate | 🟡 Overkill |
| **Jotai** | ~3KB | ⚡ Very fast | ⭐⭐⭐ Complex | 🟡 Too atomic |

### **Recommendation: Zustand** ✅

**Why:**
1. ✅ You're already using it for mail state
2. ✅ Simple, minimal boilerplate
3. ✅ Handles your complexity well
4. ✅ Great Devtools
5. ✅ 90% of apps don't need more

**When to use Legend State:**
- Only if you hit performance issues with Zustand
- Very large lists (10,000+ items re-rendering)
- Real-time collaborative editing

**When to use Jotai:**
- Complex atomic state (not your case)
- Need Suspense integration

**Your case:** Email + Projects is perfect for Zustand's centralized stores.

---

## 💾 **Redis: YES, You Need It** ✅

### **What Redis Does for You**

```
┌─────────────────────────────────────┐
│  Redis (In-Memory Cache)            │
│                                     │
│  1. Cache email bodies (1 hour)    │
│  2. Session management              │
│  3. Job queues (email sync)         │
│  4. Rate limiting                   │
│  5. Real-time pub/sub               │
└─────────────────────────────────────┘
```

### **Use Cases:**

#### **1. Cache Email Bodies**
```typescript
// Check Redis first (fast!)
const cached = await redis.get(`email:${emailId}:body`);
if (cached) return cached;

// Fetch from Outlook (slow)
const body = await fetchFromOutlook(emailId);

// Cache for 1 hour
await redis.setex(`email:${emailId}:body`, 3600, body);
```

**Why:** Email bodies don't change. No need to fetch from Outlook every time.

#### **2. Job Queues (BullMQ)**
```typescript
// Queue email sync job (don't block user)
await emailSyncQueue.add('sync-inbox', { userId });

// Process in background
emailSyncQueue.process(async (job) => {
  await incrementalSync(job.data.userId);
});
```

**Why:** Email syncing takes time. Queue it!

#### **3. Rate Limiting**
```typescript
// Limit API calls per user
const calls = await redis.incr(`ratelimit:${userId}:${minute}`);
if (calls > 100) throw new Error('Rate limit exceeded');
await redis.expire(`ratelimit:${userId}:${minute}`, 60);
```

**Why:** Prevent abuse, avoid Microsoft API throttling.

### **Redis Setup (Simple)**

```bash
# Install Redis
bun install ioredis bullmq

# Or use Upstash (serverless Redis)
# No server management!
```

**Cost:** Free tier covers development, ~$10/month production.

---

## 🧪 **Testing Strategy**

### **1. Bun Test (Unit & Integration)**

```typescript
// tests/email-sync.test.ts
import { test, expect } from "bun:test";
import { syncEmails } from "../src/email-sync";

test("syncs new emails from Outlook", async () => {
  const result = await syncEmails(testUserId);

  expect(result.newEmails).toBeGreaterThan(0);
  expect(result.errors).toHaveLength(0);
});

test("handles deleted emails", async () => {
  const result = await syncEmails(testUserId);

  // Verify deleted email removed from DB
  const email = await db.get('emails', deletedEmailId);
  expect(email).toBeNull();
});
```

**Run:** `bun test`

**Use for:**
- ✅ Email sync logic
- ✅ Database queries
- ✅ API endpoints
- ✅ Business logic

---

### **2. Playwright (E2E Tests)**

```typescript
// e2e/email-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('user can view and reply to email', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.click('text=Sign in with Microsoft');

  // View email list
  await page.goto('/mail');
  await expect(page.locator('.email-list')).toBeVisible();

  // Click email
  await page.click('.email-item:first-child');
  await expect(page.locator('.email-body')).toBeVisible();

  // Reply
  await page.click('button:has-text("Reply")');
  await page.fill('textarea', 'Test reply');
  await page.click('button:has-text("Send")');

  await expect(page.locator('text=Sent successfully')).toBeVisible();
});
```

**Run:** `bunx playwright test`

**Use for:**
- ✅ Critical user flows (login, send email, create project)
- ✅ Email sync UI updates
- ✅ Kanban drag-drop
- ✅ Map interactions

---

### **Testing Priority:**

| Test Type | Coverage | When |
|-----------|----------|------|
| **Bun tests** | 70-80% | Every commit (fast!) |
| **Playwright E2E** | 20-30% | Critical flows only (slow) |
| **Manual testing** | 10% | Edge cases, UI polish |

**Don't over-test!** Focus on critical paths.

---

## 🚀 **Next Steps Roadmap**

### **Phase 1: Foundation (Week 1-2)** 🏗️

#### **Week 1: Backend Setup**

```
Day 1-2: Database & Auth
├── Set up PostgreSQL (local + hosted)
├── Initialize Prisma
├── Create initial schema (users, emails, companies)
├── Set up Redis (local or Upstash)
└── Test database connections

Day 3-4: Microsoft OAuth
├── Register app in Azure Portal
├── Implement OAuth flow (ElysiaJS)
├── Store tokens securely (encrypted)
└── Test login flow

Day 5-7: Initial Email Sync
├── Implement delta query sync
├── Store email metadata in database
├── Handle attachments metadata
└── Test with test Outlook account
```

#### **Week 2: Frontend Basics**

```
Day 1-2: Email List UI
├── Create email list component (already mostly done?)
├── Connect to backend API
├── Display emails from database
└── Add loading states

Day 3-4: Email Detail View
├── Fetch email body on-demand
├── Display email content
├── Show attachments
└── Cache in Redis

Day 5-7: Basic Actions
├── Mark as read/unread
├── Star emails
├── Delete emails
└── Link email to company/project
```

---

### **Phase 2: Core Features (Week 3-4)** ⚙️

#### **Week 3: Projects & Companies**

```
Day 1-2: Companies CRUD
├── Create company form
├── List view
├── Detail view
└── Link contacts to companies

Day 3-4: Projects CRUD
├── Create project form
├── Link to company
├── Link emails to projects
└── Project detail view

Day 5-7: Email ↔ Project Linking
├── Auto-suggest company from email domain
├── Link email to project from UI
├── Filter emails by project
└── Project activity feed (emails + tasks)
```

#### **Week 4: Kanban Board**

```
Day 1-3: Kanban UI
├── Create board view (table → kanban toggle)
├── Drag-drop tasks
├── Update task status
└── Real-time updates (WebSocket or polling)

Day 4-5: Task Management
├── Create task from email
├── Assign to user
├── Set due dates
└── Add notes/comments

Day 6-7: Search & Filters
├── Search emails by subject/sender
├── Filter by project/company
├── Filter by date range
└── Full-text search (PostgreSQL)
```

---

### **Phase 3: Files & Attachments (Week 5-6)** 📎

```
Week 5:
├── S3 bucket setup
├── Upload PDF attachments to S3
├── PDF viewer component
└── Download attachments

Week 6:
├── PDF markup (annotations)
├── File versioning
├── SharePoint integration (optional)
└── File search
```

---

### **Phase 4: Estimates & Invoices (Week 7-8)** 💰

```
Week 7:
├── Estimate builder UI
├── Line items
├── PDF generation
└── Send via email

Week 8:
├── Invoice builder
├── Link to estimate
├── Payment tracking
└── Overdue notifications
```

---

### **Phase 5: Inspections & Maps (Week 9-10)** 🗺️

```
Week 9:
├── Inspection form
├── Photo upload (mobile-friendly)
├── Location capture (GPS)
└── Inspection reports

Week 10:
├── Map view (Mapbox or Google Maps)
├── Show companies on map
├── "Find nearby" feature for sales
└── Route planning
```

---

### **Phase 6: Polish & Production (Week 11-12)** ✨

```
Week 11:
├── Performance optimization
├── E2E tests (Playwright)
├── Error handling & logging
└── User permissions (admin/sales/user)

Week 12:
├── Deployment setup (Railway, Fly.io)
├── Monitoring (Sentry)
├── Documentation
└── User training/onboarding
```

---

## 🎯 **Immediate First Steps (This Week)**

### **Step 1: Set Up Database**

```bash
# Install Prisma
bun install prisma @prisma/client

# Initialize Prisma
bunx prisma init

# Edit prisma/schema.prisma (copy from above)

# Create migration
bunx prisma migrate dev --name init

# Generate Prisma Client
bunx prisma generate
```

### **Step 2: Set Up ElysiaJS Backend**

```bash
# Create backend folder
mkdir backend
cd backend

# Initialize Elysia
bun create elysia .

# Install dependencies
bun install @elysiajs/cors @elysiajs/jwt
bun install @microsoft/microsoft-graph-client
bun install ioredis bullmq
```

### **Step 3: Test Microsoft OAuth**

```typescript
// backend/src/auth.ts
import { Elysia } from 'elysia';

export const auth = new Elysia()
  .get('/auth/microsoft', () => {
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
      client_id=${process.env.MICROSOFT_CLIENT_ID}&
      response_type=code&
      redirect_uri=${process.env.REDIRECT_URI}&
      scope=openid profile email Mail.Read Mail.Send`;

    return Response.redirect(authUrl);
  })
  .get('/auth/callback', async ({ query }) => {
    // Exchange code for tokens
    // Store tokens
    // Redirect to app
  });
```

### **Step 4: Test Email Sync**

```typescript
// backend/src/email-sync.ts
export async function syncEmails(userId: number) {
  const user = await db.get('users', userId);

  const client = Client.init({
    authProvider: (done) => done(null, user.outlook_access_token)
  });

  const messages = await client
    .api('/me/messages/delta')
    .top(10)
    .get();

  for (const message of messages.value) {
    await db.upsert('emails', {
      outlook_id: message.id,
      subject: message.subject,
      // ...
    });
  }
}
```

---

## 📚 **Summary**

### **Tech Stack (Final)**

```
Frontend:
├── React
├── React Router (Declarative Mode)
├── Zustand (state management)
├── TanStack Query (server state)
└── Bun (runtime)

Backend:
├── ElysiaJS (framework)
├── Bun (runtime)
├── PostgreSQL + PostGIS (database)
├── Prisma (ORM)
├── Redis (cache + queues)
└── S3 (file storage)

Auth & APIs:
├── Microsoft OAuth 2.0
├── Microsoft Graph API
└── ElysiaJS JWT

Testing:
├── Bun Test (unit/integration)
└── Playwright (E2E)

Infrastructure:
├── Railway/Fly.io (hosting)
├── Upstash (Redis)
├── AWS S3 (files)
└── Sentry (monitoring)
```

### **Database:**
- ✅ PostgreSQL (with PostGIS for maps)
- ✅ ~15 core tables (see above)
- ✅ Prisma for type-safe queries

### **State:**
- ✅ Zustand (what you're using, perfect!)
- ❌ Not Legend State (overkill)

### **Redis:**
- ✅ Yes, for caching + queues
- ✅ Upstash for easy setup

### **Testing:**
- ✅ Bun tests for backend logic
- ✅ Playwright for critical flows

---

**Next:** Want me to help you:
1. Set up the database schema with Prisma?
2. Implement Microsoft OAuth?
3. Build the email sync?

Let me know where you want to start!

---

**Last Updated:** 2025-11-21
**Status:** Ready to build! 🚀
