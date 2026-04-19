# Microsoft Build 2026 · Session Planner

A personal planning tool for [Microsoft Build 2026](https://build.microsoft.com) that lets you browse, prioritize, and annotate conference sessions. Built as a full-stack web app with a React frontend, Express API, and MySQL database.

> **Adapt it to any year** — update the scraper URL and re-sync.

---

## Features

- **Browse all sessions** — table and card views with sortable columns
- **Filter** by priority, session type, track, and recording availability
- **Search** across session codes, titles, tracks, and your personal notes
- **Prioritize** each session: `must-attend`, `high`, `good if time`, or `skip`
- **Personal notes** (`why` field) on every session — never overwritten by a sync
- **Favorites** toggle — imported from the Build site if you've saved them there
- **Sync sessions** — Puppeteer-based scraper that fetches directly from build.microsoft.com
- **Paste import** — copy-paste the raw page text as a browser-free alternative to the scraper
- **Speakers** — linked to each session, imported automatically

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL 8 |
| Scraper | Puppeteer (headless Chromium) |

---

## Architecture

```
Microsoft-Build-2026-Planner/
├── client/                   # React app (Vite)
│   └── src/
│       ├── api/sessions.ts   # Typed fetch wrappers for all endpoints
│       ├── components/       # FilterSidebar, SessionTable, SessionModal,
│       │                     # SyncButton, PasteImportButton, Badges
│       ├── types/index.ts    # Shared TypeScript interfaces
│       └── App.tsx           # Root: loads sessions, client-side filter/sort
│
├── server/                   # Express API
│   └── src/
│       ├── routes/
│       │   ├── sessions.ts   # CRUD  GET / POST / PUT / DELETE /api/sessions
│       │   ├── sync.ts       # POST /api/sync  → runs Puppeteer scraper
│       │   └── paste.ts      # POST /api/paste → parses raw pasted text
│       ├── services/
│       │   ├── scraper.ts    # Puppeteer scraper + JSON API interception
│       │   └── textParser.ts # Plain-text parser for the paste import feature
│       ├── db.ts             # mysql2 connection pool
│       └── index.ts          # Express app, static serving in production
│
├── database/
│   └── schema.sql            # Creates DB + tables
│
└── .env.example              # Environment variable template
```

### Data model

Three tables in the `MS_Build_26` database:

```
sessions          — one row per session code (KEY01, BRK###, LAB###, DEM###, LTG###)
speakers          — one row per speaker (unique by name)
session_speakers  — junction table
```

Key `sessions` fields:

| Field | Description |
|---|---|
| `code` | Unique session ID from the Build site (e.g. `BRK244`) |
| `title`, `description` | Session content |
| `type` | Keynote / Breakout / Lab / Demo / Lightning Talk |
| `level` | 100 / 200 / 300 / 400 |
| `category` | Track (e.g. "Developer Tools & Frameworks") |
| `modality` | In-Person / Online / In-Person + Online |
| `is_recorded` | Whether the session will be recorded |
| `session_url` | Link to the session on the Build site |
| `prio` | **User-managed** — `must` / `high` / `good` / `skip` |
| `why` | **User-managed** — personal notes |
| `is_favorite` | **User-managed** — starred sessions |

> `prio`, `why`, and `is_favorite` are **never overwritten** by a sync or paste import.

---

## Prerequisites

- **Node.js** 18+ and npm
- **MySQL** 8+
- Chrome/Chromium — only required for the **Sync** button (Puppeteer downloads its own). The **Paste import** feature works without it.

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/yourhandle/Microsoft-Build-2026-Planner.git
cd Microsoft-Build-2026-Planner

cd client && npm install
cd ../server && npm install
```

### 2. Create the database

```bash
mysql -u root -p < database/schema.sql
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your local values:

```env
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_password
DB_NAME=MS_Build_26
```

### 4. Start both servers

```bash
# Terminal 1 — API server (port 3001, hot-reload)
cd server && npm run dev

# Terminal 2 — React dev server (port 5173, HMR)
cd client && npm run dev
```

Open **http://localhost:5173**

---

## Loading sessions

### Option A — Sync button (uses Puppeteer)

Click **Sync sessions** in the app. A headless browser navigates to `build.microsoft.com/en-US/sessions`, intercepts the API responses, and upserts all sessions into the database.

### Option B — Paste import (no browser required)

1. Go to [build.microsoft.com/en-US/sessions](https://build.microsoft.com/en-US/sessions) in your browser
2. Select all (Ctrl+A) and copy
3. Click **Paste import** in the app
4. Paste and click **Import sessions**

Repeat for each page. Duplicates are automatically skipped.

---

## Production deployment

### Build

```bash
cd client  && npm run build     # → client/dist/
cd ../server && npm run build   # → server/dist/
```

In production mode (`NODE_ENV=production`), the Express server serves the React build directly — no separate static server needed.

### Environment

Create `.env` at the repo root on the server:

```env
NODE_ENV=production
PORT=3001

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=MS_Build_26

# Optional: your public domain for CORS headers
CORS_ORIGIN=https://yourdomain.com
```

### Run with PM2

```bash
cd server
pm2 start dist/index.js --name ms-build-planner
pm2 save && pm2 startup
```

### Nginx reverse proxy (optional)

```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass         http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }
}
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/sessions` | List sessions (supports `prio`, `type`, `category`, `recorded`, `search`, `sort`, `direction`) |
| `GET` | `/api/sessions/:id` | Get one session with speakers |
| `POST` | `/api/sessions` | Create a session manually |
| `PUT` | `/api/sessions/:id` | Update a session |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `POST` | `/api/sync` | Run scraper, upsert all sessions → returns `{ inserted, updated, total, errors }` |
| `POST` | `/api/paste` | Parse pasted text, upsert sessions → same response shape as sync |
| `GET` | `/api/health` | Health check |

---

## License

MIT — free to use, fork, and adapt for any conference or event.
