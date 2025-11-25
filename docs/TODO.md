# Mail101 App - TODO

**Last Updated:** 2025-11-25

## Progress

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✅ Done | 100% |
| Phase 2: Email Client | 🚧 Active | ~70% |
| Phase 3: Database Migration | ✅ Done | 100% |
| Phase 4-11: Future | 📋 Planned | 0% |

---

## ✅ Recently Completed

### Supabase/Postgres Migration (Phase 3)
- [x] Migrated from SQLite to Supabase Postgres
- [x] Using Bun.SQL with connection pooling (max: 10, idleTimeout: 20s)
- [x] Tables: users, emails, sync_state, webhook_subscriptions
- [x] Direct connection (DIRECT_URL) for prepared statement support

### Email Actions (Frontend)
- [x] Mark as read/unread with optimistic updates
- [x] Archive emails (move to archive folder)
- [x] Delete emails (move to Deleted Items)
- [x] Move to junk/spam
- [x] Flag emails with colors (red, orange, yellow, green, blue, purple)
- [x] Framer Motion animations for email list (slide in/out)
- [x] React.memo optimization for email items

### Real-time Updates
- [x] Microsoft Graph webhook subscriptions
- [x] Delta sync for incremental updates
- [x] 30-second polling fallback
- [x] Window focus refresh
- [x] Removed unreliable Supabase Realtime (replaced with polling)

### Multi-folder Support
- [x] Inbox, Sent, Drafts, Deleted Items, Junk, Archive
- [x] Folder counts (total/unread)
- [x] Folder navigation in sidebar

---

## 🔴 Current Sprint: Email Client Polish

### Email Display
- [ ] Implement full email body display with HTML rendering
- [ ] Add email compose modal/page
- [ ] Implement reply and reply-all
- [ ] Add forward email feature

### Email Search & Filter
- [ ] Implement email search (subject, sender, content)
- [ ] Add filtering (read/unread, has attachments, date range)
- [ ] Add sorting options
- [ ] Add bulk actions (select multiple, mark read, delete)

### Known Issues
- [ ] Permanent delete from Deleted Items folder not working (Graph API issue)
- [ ] Thread view not fully implemented (conversation grouping exists but not expanded)

---

## 📋 Future Phases (Backlog)

### Phase 4: Project Management
- Companies & contacts CRUD
- Projects with Kanban board
- Task management
- Link emails to projects/companies

### Phase 5: File Management
- S3 file storage
- PDF viewer with annotations
- File linking to entities

### Phase 6: Estimates & Invoices
- Estimate/invoice builder
- PDF generation
- Payment tracking

### Phase 7: Inspections & Maps
- Inspection forms with photos
- PostGIS mapping
- Route planning

### Phase 8: Real-time & Collaboration
- WebSocket notifications
- Comments & mentions
- Activity feeds

### Phase 9: Testing
- Unit tests (Bun test)
- E2E tests (Playwright)
- Performance testing

### Phase 10: Production
- CI/CD pipeline
- Hosting setup
- Monitoring & logging

### Phase 11: Polish
- Loading states & skeletons
- Keyboard shortcuts
- Dark mode
- Mobile optimization

---

## 💡 Ideas (Someday/Maybe)

- Email templates/canned responses
- AI-powered categorization & smart replies
- Calendar integration
- Slack/Zapier integrations
- Mobile apps (React Native)
