# Mail101 App - TODO

**Last Updated:** 2025-11-24

## Progress

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Foundation | ✅ Done | 100% |
| Phase 2: Email Client | 🚧 Active | ~35% |
| Phase 3: Database Migration | ⏳ Next | 0% |
| Phase 4-11: Future | 📋 Planned | 0% |

---

## 🔴 Current Sprint: Email Client Core

### Email Actions (Frontend)
- [ ] Connect mark as read/unread UI buttons
- [ ] Connect archive button to `POST /api/emails/:id/move`
- [ ] Connect delete button to `DELETE /api/emails/:id`
- [ ] Connect "move to junk" action
- [ ] Add confirmation dialogs for destructive actions

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

### Sync Improvements
- [ ] Add manual refresh button in UI
- [ ] Show sync status indicator
- [ ] Handle sync errors gracefully

---

## ⏳ Next Up: Phase 3 - Database Migration

### PostgreSQL Setup
- [ ] Set up PostgreSQL (local + hosted)
- [ ] Install Prisma ORM
- [ ] Migrate existing SQLite data
- [ ] Update all queries to use Prisma

### New Tables
- [ ] users, companies, contacts
- [ ] projects, tasks
- [ ] email_threads, email_attachments
- [ ] estimates, invoices
- [ ] files, activity_log

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
