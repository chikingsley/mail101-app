# Architecture Decisions

**Project:** Monday.com/Notion-style Project Management with Email Integration
**Date:** 2025-11-21
**Status:** Initial Planning

---

## 🎯 Project Overview

Building a unified workspace application combining:
- Email client (Outlook integration)
- Project management (table/kanban views)
- File management (PDFs with markup)
- Real-time collaboration

Similar to: Monday.com, Notion, with deep email integration

---

## 📊 Recommended Stack

### **Frontend**
```
Technology: React SPA
Runtime: Bun
Routing: React Router (Declarative Mode/BrowserRouter)
```

**Why:**
- Client-side SPA for smooth navigation between views
- No page reloads when switching Mail → Projects → Kanban → Files
- Simple routing - no need for Data Mode or Framework Mode complexity
- Bun for fast development and package management

---

### **Backend**
```
Framework: ElysiaJS
Runtime: Bun
API Style: REST
```

**Why ElysiaJS over Bun.serve:**

| Feature | Bun.serve | ElysiaJS |
|---------|-----------|----------|
| Routing | Manual | Built-in, Express-like |
| Middleware | Write yourself | CORS, JWT, auth, logging |
| Validation | Manual | Zod, TypeBox built-in |
| Database plugins | None | Prisma, Drizzle, Mongoose |
| OAuth | Build yourself | JWT/Bearer plugins |
| OpenAPI docs | None | Auto-generated |
| WebSockets | Manual | Built-in |
| File uploads | Manual | Built-in |
| Type safety | No | End-to-end TypeScript |
| Performance | Fast | 21x faster than Express, 6x faster than Fastify |

**ElysiaJS provides:**
- End-to-end type safety
- Built-in validation (crucial for file uploads, user input)
- Middleware ecosystem (auth, CORS, logging)
- OpenAPI documentation generation
- WebSocket support (for real-time features later)
- Designed specifically for Bun

---

### **Database**
```
Primary Options: PostgreSQL or MongoDB
ORM: Prisma (Postgres) or Mongoose (MongoDB)
```

**Choose based on:**
- **PostgreSQL** - If you need relational data, complex queries, ACID compliance
- **MongoDB** - If you need flexible schemas, document storage

For this project, **PostgreSQL + Prisma** recommended because:
- Email metadata, projects, tasks have relationships
- Need complex queries (filter emails by project, date, sender)
- ACID compliance for data integrity

---

### **Authentication**
```
Provider: Microsoft OAuth 2.0
Implementation: Azure App Registration + ElysiaJS JWT plugin
```

**Flow:**
1. User clicks "Sign in with Microsoft"
2. Redirects to Microsoft OAuth
3. User grants permissions (Mail.Read, Mail.Send, Files.Read)
4. App receives access token
5. Store token securely (encrypted in database)
6. Use token for all Microsoft Graph API calls

---

### **Email Integration**
```
Provider: Microsoft Graph API
Permissions: Mail.Read, Mail.Send, Mail.ReadWrite
```

**What you GET:**
✅ Send emails from user's Outlook account
✅ Read emails, folders, attachments
✅ Create/update/delete emails
✅ Search emails
✅ Access calendar, contacts (if needed later)

**What you DON'T need:**
❌ Resend, SendGrid, Mailgun
❌ React Email (unless you want HTML templates)
❌ Your own SMTP server
❌ Custom email infrastructure

**Example API call:**
```typescript
// ElysiaJS endpoint
app.post('/api/send-email', async ({ body, user }) => {
  const accessToken = user.outlookToken;

  await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: body.subject,
        body: { content: body.content },
        toRecipients: [{ emailAddress: { address: body.to } }]
      }
    })
  });
});
```

---

### **File Storage**
```
Hybrid Approach: SharePoint + AWS S3
Access: Microsoft Graph API (SharePoint) + AWS SDK (S3)
```

**Why BOTH?**

| Use Case | Storage | Reason |
|----------|---------|--------|
| Files from Outlook/365 | SharePoint | Native integration, expected by users |
| PDFs for markup/viewing | S3 | Faster access, cheaper for frequent reads |
| Large file processing | S3 | Better for compute, transformations |
| Compliance/Enterprise | SharePoint | Often required by organizations |
| Backups | Both | Redundancy |

**Implementation:**
```typescript
async function handleFile(file, context) {
  if (context === 'outlook-attachment') {
    // Save to SharePoint via Graph API
    await saveToSharePoint(file);
  }

  if (context === 'pdf-markup') {
    // Save to S3 for fast access
    await saveToS3(file);

    // Also sync to SharePoint for backup
    await syncToSharePoint(file);
  }
}
```

**SharePoint Access:**
- Microsoft Graph API: `/drive/items/{id}/content`
- Native integration with Microsoft 365

**S3 Access:**
- AWS SDK for JavaScript
- CDN in front for faster delivery
- Cheaper for high-volume access

---

## 🏛️ Complete Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│  FRONTEND (React SPA)                           │
│  - React Router (Declarative Mode)              │
│  - PDF viewer component                         │
│  - Kanban/Table views (like Monday/Notion)      │
│  - Mail UI (existing components)                │
│  - File management interface                    │
└─────────────┬───────────────────────────────────┘
              │
              │ HTTP/REST API calls
              │
              ▼
┌─────────────────────────────────────────────────┐
│  BACKEND (ElysiaJS on Bun)                      │
│                                                  │
│  API Routes:                                     │
│  - /api/auth/*        → Microsoft OAuth         │
│  - /api/mail/*        → Graph API proxy         │
│  - /api/projects/*    → CRUD operations         │
│  - /api/files/*       → Upload/download         │
│                                                  │
│  Middleware:                                     │
│  - JWT authentication                           │
│  - CORS handling                                │
│  - Request validation (Zod)                     │
│  - Error handling                               │
│  - Logging                                      │
└───┬─────────┬──────────────┬────────────────────┘
    │         │              │
    │         │              │
    ▼         ▼              ▼
┌────────────────┐  ┌────────────────┐  ┌──────────────────┐
│   Database     │  │ Microsoft      │  │  File Storage    │
│  (PostgreSQL)  │  │ Graph API      │  │                  │
│                │  │                │  │  - SharePoint    │
│  Tables:       │  │ - Outlook Mail │  │    (Graph API)   │
│  - users       │  │ - OneDrive     │  │                  │
│  - projects    │  │ - Calendar     │  │  - AWS S3        │
│  - tasks       │  │ - Contacts     │  │    (SDK)         │
│  - emails_meta │  │                │  │                  │
│  - files_meta  │  │                │  │                  │
└────────────────┘  └────────────────┘  └──────────────────┘
```

---

## 📦 Dependencies

### Frontend
```bash
bun install react-router-dom
bun install @microsoft/microsoft-graph-client  # If calling Graph API directly
bun install react-pdf                          # For PDF viewing
bun install @tanstack/react-query             # For data fetching
```

### Backend
```bash
# Create ElysiaJS project
bun create elysia backend
cd backend

# Core dependencies
bun install @elysiajs/jwt          # JWT authentication
bun install @elysiajs/cors         # CORS handling
bun install @elysiajs/swagger      # API documentation
bun install @elysiajs/bearer       # Bearer token auth

# Database
bun install prisma @prisma/client  # ORM

# Microsoft Graph API
bun install @microsoft/microsoft-graph-client
bun install @azure/identity

# AWS S3
bun install @aws-sdk/client-s3
bun install @aws-sdk/s3-request-presigner

# Validation
bun install zod

# Utilities
bun install dotenv                 # Not needed - Bun loads .env automatically
```

---

## 🔐 Security Considerations

### OAuth Tokens
- Store Microsoft access tokens encrypted in database
- Implement token refresh logic (tokens expire)
- Never expose tokens to frontend

### API Security
- JWT authentication for all API routes
- Rate limiting on sensitive endpoints
- Input validation on all user data
- File type validation (PDFs only where expected)
- File size limits

### File Security
- Signed URLs for S3 (temporary access)
- SharePoint permissions follow Microsoft 365 settings
- Virus scanning on uploaded files

---

## 🚀 Deployment Strategy

### Development
```bash
# Frontend
bun run dev          # Vite dev server

# Backend
bun run index.ts     # ElysiaJS with --hot flag
```

### Production
```bash
# Frontend
bun run build        # Build static assets
Deploy to: Vercel, Netlify, or Cloudflare Pages

# Backend
bun run start        # Production server
Deploy to: Railway, Fly.io, or AWS EC2 with Bun
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up ElysiaJS backend with basic routes
- [ ] Configure Microsoft OAuth in Azure Portal
- [ ] Implement authentication flow
- [ ] Set up PostgreSQL + Prisma
- [ ] Basic React Router setup

### Phase 2: Email Integration (Week 3-4)
- [ ] Microsoft Graph API integration
- [ ] Email list view
- [ ] Email detail view
- [ ] Send email functionality
- [ ] Email metadata storage

### Phase 3: Project Management (Week 5-6)
- [ ] Projects CRUD
- [ ] Table view (like Notion)
- [ ] Kanban view (like Monday)
- [ ] Link emails to projects

### Phase 4: File Management (Week 7-8)
- [ ] S3 bucket setup
- [ ] File upload/download
- [ ] PDF viewer
- [ ] PDF markup functionality
- [ ] SharePoint integration

### Phase 5: Polish & Real-time (Week 9+)
- [ ] WebSocket for real-time updates
- [ ] Notifications
- [ ] Search functionality
- [ ] Performance optimization

---

## ❓ Open Questions

1. **Real-time collaboration** - Do multiple users need to see updates instantly?
   - If yes, consider WebSockets or Server-Sent Events
   - ElysiaJS has built-in WebSocket support

2. **Offline support** - Should the app work offline?
   - If yes, implement service workers and local storage

3. **Mobile app** - Future requirement?
   - If yes, consider React Native + same backend

4. **Payment processing** - Which provider?
   - Stripe recommended for simplicity
   - Can add later as needed

---

## 📚 Resources

- [ElysiaJS Documentation](https://elysiajs.com/)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/)
- [React Router](https://reactrouter.com/)
- [Bun Documentation](https://bun.sh/)
- [Prisma Documentation](https://www.prisma.io/)
- [AWS S3 SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)

---

**Last Updated:** 2025-11-21
**Next Review:** After Convex research
