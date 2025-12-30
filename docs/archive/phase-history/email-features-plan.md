# Email Features Implementation Plan

## Overview

Implementing complete email client functionality in 4 phases:
- **Phase A:** Email Actions (quick wins) ✅ COMPLETE
- **Phase B:** HTML Email Rendering ✅ COMPLETE
- **Phase C:** Thread/Conversation View ✅ COMPLETE
- **Phase D:** Inline Reply with Simple Compose

---

## Phase A: Email Actions ✅ COMPLETE

### Backend Updates

1. ✅ **Update mark as read endpoint to support toggle**
   - `PATCH /api/emails/:id/read` → accepts `{ read: boolean }`

2. ✅ **Add flag/star support**
   - Added `flag_status` and `flag_color` columns to emails table
   - Added `PATCH /api/emails/:id/flag` endpoint
   - Colors: red, orange, yellow, green, blue, purple

### Frontend Implementation

| Button | Icon | Action | Status |
|--------|------|--------|--------|
| Read/Unread | `Mail`/`MailOpen` | Toggle read status | ✅ |
| Flag | `Flag` | Set flag color (dropdown) | ✅ |
| Archive | `Archive` | Move to archive | ✅ |
| Junk | `ArchiveX` | Move to junk | ✅ |
| Trash | `Trash2` | Move to trash | ✅ |
| Delete | `Trash2` (red) | Permanent delete with confirmation | ✅ |

### Files Changed
- `backend/src/routes/emails.ts` - Updated read endpoint, added flag endpoint
- `backend/src/db/index.ts` - Added migrations and queries for flag_status/flag_color
- `backend/src/services/graph.ts` - Added updateEmailReadStatus, updateEmailFlag
- `frontend/src/hooks/use-email-actions.ts` - NEW: All email action functions
- `frontend/src/components/mail-app/components/mail-display.tsx` - Functional toolbar
- `frontend/src/components/mail-app/components/mail-list.tsx` - Flag indicators
- `frontend/src/components/ui/alert-dialog.tsx` - NEW: Delete confirmation

---

## Phase B: HTML Email Rendering ✅ COMPLETE

### Implementation

1. ✅ Installed DOMPurify for HTML sanitization
2. ✅ Created `EmailBody` component that:
   - Fetches full body on demand (lazy load)
   - Shows loading state while fetching
   - Sanitizes HTML with DOMPurify
   - Renders in styled container
3. ✅ Added proper styling for email content (max-width, font, links)
4. ✅ Handle plain text emails (preserve whitespace)

### Security
- ✅ Sanitizes all HTML (prevents XSS)
- ✅ Removes script tags, event handlers
- ✅ Opens links in new tab with noopener noreferrer

### Files Changed
- `frontend/src/components/mail-app/components/email-body.tsx` - NEW: HTML renderer
- `frontend/src/components/mail-app/components/mail-display.tsx` - Uses EmailBody
- `frontend/src/components/mail-app/components/mail-display-mobile.tsx` - Uses EmailBody

---

## Phase C: Thread/Conversation View ✅ COMPLETE

### Implementation

1. ✅ Backend: Added `GET /api/emails/thread/:conversationId` endpoint
2. ✅ Backend: Added `getByConversationId` and `getThreadCounts` queries
3. ✅ Backend: Updated GET /api/emails to include thread_count
4. ✅ Frontend: Created `ThreadView` component with collapsible emails
5. ✅ Frontend: Latest email expanded by default
6. ✅ Frontend: Show participant count and message count in thread header
7. ✅ Frontend: Thread count badge shown in email list
8. ✅ Frontend: Auto-switch to ThreadView when email has threadCount > 1

### Files Changed
- `backend/src/db/index.ts` - Added getByConversationId, getThreadCounts queries
- `backend/src/routes/emails.ts` - Added thread endpoint, thread counts in list
- `frontend/src/components/mail-app/components/thread-view.tsx` - NEW: Thread display
- `frontend/src/components/mail-app/components/mail-display.tsx` - ThreadView integration
- `frontend/src/components/mail-app/components/mail-list.tsx` - Thread count badge
- `frontend/src/components/ui/collapsible.tsx` - NEW: Collapsible component
- `frontend/src/App.tsx` - Added conversationId and threadCount to type

### UI Layout
```
┌─────────────────────────────────────┐
│ Subject: Re: Project Update         │
│ 5 messages in this conversation     │
├─────────────────────────────────────┤
│ [▼] John Doe - Nov 20, 10:00 AM     │ ← Collapsed
│     "Thanks for the update..."      │
├─────────────────────────────────────┤
│ [▼] Jane Smith - Nov 20, 11:30 AM   │ ← Collapsed
│     "I have a few questions..."     │
├─────────────────────────────────────┤
│ [▶] You - Nov 20, 2:00 PM           │ ← EXPANDED
│     [Full HTML email body]          │
│     ┌─────────────────────────────┐ │
│     │ [Reply box - Phase D]       │ │
│     └─────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Phase D: Inline Reply with Simple Compose

### Features

1. **Inline Reply** (within thread view)
   - Appears at bottom of expanded email
   - Quote previous message
   - Simple formatting (bold, italic, lists)
   - Send / Discard buttons

2. **New Email Compose** (modal or panel)
   - To / Cc / Bcc fields
   - Subject field
   - Same simple editor
   - Draft auto-save (future)

### Editor: TipTap (Recommended)

```bash
bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-link
```

**Simple toolbar:**
- Bold, Italic, Underline
- Bullet list, Numbered list
- Link
- (No fonts, colors, tables for simple version)

### Implementation Steps

1. [ ] Install TipTap packages
2. [ ] Create `EmailEditor` component with simple toolbar
3. [ ] Create `InlineReply` component (for thread view)
4. [ ] Create `ComposeEmail` modal/panel (for new emails)
5. [ ] Add quoted content for replies (blockquote styling)
6. [ ] Connect to `POST /api/emails/send` endpoint
7. [ ] Handle reply vs reply-all vs forward
8. [ ] Add recipient input with validation

### UI - Inline Reply
```
┌─────────────────────────────────────┐
│ From: chi@desertservices.net        │
│ To: jd@lgedesignbuild.com           │
├─────────────────────────────────────┤
│ [B] [I] [U] │ [•] [1.] │ [🔗]       │
├─────────────────────────────────────┤
│                                     │
│ Hi JD,                              │
│                                     │
│ |                                   │
│                                     │
│ ────── Original Message ──────      │
│ > From: JD Wright                   │
│ > I will be out of office...        │
│                                     │
├─────────────────────────────────────┤
│ [Send ▼] [Discard]                  │
└─────────────────────────────────────┘
```

---

## Progress Summary

| Phase | Status | Files Changed |
|-------|--------|---------------|
| A: Actions | ✅ Complete | 7 |
| B: HTML Render | ✅ Complete | 3 |
| C: Thread View | ✅ Complete | 7 |
| D: Compose/Reply | ⏳ Pending | - |

---

## Dependencies Installed

```bash
# Frontend
bun add dompurify @types/dompurify          # ✅ HTML sanitization
bun add @radix-ui/react-alert-dialog        # ✅ Delete confirmation dialog
bun add @radix-ui/react-collapsible         # ✅ Thread view collapsible
# bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-link  # Phase D
```
