# Mail101

A unified workspace application for email, project management, and CRM - built with Bun, React, and Microsoft Graph API.

## Features

### Email Client (Outlook Integration)
- **Multi-folder sync** - Inbox, Sent, Drafts, Trash, Junk, Archive
- **Delta sync** - Efficient incremental updates from Microsoft Graph API
- **Dynamic folder counts** - Real-time unread counts per folder
- **Folder navigation** - Click to switch between folders
- **Email actions** (backend ready) - Archive, delete, move, mark as read

### Authentication
- **Clerk authentication** - Sign in/sign up with email or OAuth
- **Microsoft OAuth** - Connect your Outlook/Microsoft 365 account
- **Secure token handling** - Backend validates all requests

### UI/UX
- **3-panel layout** - Resizable sidebar, email list, and email detail
- **Responsive design** - Desktop and mobile variants
- **Modern components** - Built with shadcn/ui and Tailwind CSS

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | [Bun](https://bun.sh) |
| **Frontend** | React 19, Tailwind CSS, shadcn/ui |
| **Backend** | [Elysia.js](https://elysiajs.com) |
| **Database** | SQLite (dev) → PostgreSQL (planned) |
| **Auth** | [Clerk](https://clerk.com) + Microsoft OAuth |
| **Email API** | Microsoft Graph API |

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- Microsoft 365 account (for email sync)
- Clerk account (for authentication)

### Environment Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/mail101-app.git
   cd mail101-app
   ```

2. Create environment files:

   **Backend** (`backend/.env`):
   ```env
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   CLERK_SECRET_KEY=sk_test_...
   CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

   **Frontend** (`frontend/.env`):
   ```env
   BUN_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   BUN_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

3. Configure Clerk:
   - Create a Clerk application at [clerk.com](https://clerk.com)
   - Enable Microsoft OAuth provider
   - Add required scopes: `Mail.Read`, `Mail.ReadWrite`, `Mail.Send`, `User.Read`

### Running with Docker

```bash
# Start both frontend and backend
docker compose up

# Or rebuild and start
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/swagger |

### Running Locally (without Docker)

```bash
# Backend
cd backend
bun install
bun run src/index.ts

# Frontend (separate terminal)
cd frontend
bun install
bun run src/index.ts
```

## Project Structure

```
mail101-app/
├── backend/
│   ├── src/
│   │   ├── db/           # Database schema and queries
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Clerk, Microsoft Graph
│   │   └── index.ts      # Elysia server
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── mail-app/ # Email client UI
│   │   │   └── ui/       # shadcn/ui components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities
│   │   ├── App.tsx       # Main app component
│   │   └── index.ts      # Bun server
│   └── Dockerfile
├── docs/
│   └── TODO.md           # Development roadmap
├── docker-compose.yml
└── CLAUDE.md             # AI assistant instructions
```

## API Endpoints

### Emails

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/emails/sync` | Sync emails from Outlook (all folders) |
| `GET` | `/api/emails` | Get emails (optional `?folder=` filter) |
| `GET` | `/api/emails/counts` | Get unread counts per folder |
| `GET` | `/api/emails/:id/body` | Get full email body |
| `PATCH` | `/api/emails/:id/read` | Mark email as read |
| `POST` | `/api/emails/:id/move` | Move email to folder |
| `DELETE` | `/api/emails/:id` | Permanently delete email |
| `POST` | `/api/emails/send` | Send new email |

## Development

### Code Style
- Use Bun instead of Node.js (see `CLAUDE.md`)
- Prefer `Bun.serve()` over Express
- Use `bun:sqlite` for database

### Hot Reload
Docker volumes are configured for hot reload:
- Backend: `./backend/src` → `/app/src`
- Frontend: `./frontend/src` → `/app/src`

## Roadmap

See [docs/TODO.md](docs/TODO.md) for the development roadmap.

**Current focus:** Connecting frontend email action buttons to backend APIs.

## License

Private - All rights reserved.
