# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Client (React + TypeScript, port 5173)
```bash
cd client
npm install
npm run dev       # Vite dev server
npm run build     # Production build to client/dist/
npm run preview
```

### Server (Node.js + Express + TypeScript, port 3001)
```bash
cd server
npm install
npm run dev       # tsx watch mode
npm run build     # tsc → dist/
npm start         # node dist/index.js
```

### Database
```bash
mysql -u root -p < database/schema.sql   # Create MS_Build_26 DB + all tables
```

Copy `.env.example` to `.env` in the repo root and fill in DB credentials before starting the server.

## Architecture

Full-stack monorepo: `client/` (Vite + React 18 + TypeScript) + `server/` (Express + TypeScript) + `database/`.

### Data model
Three MySQL tables in `MS_Build_26`: `sessions`, `speakers`, `session_speakers` (junction).

Key fields on `sessions`: `code` (unique key from Build site), `title`, `description`, `type`, `level`, `category`, `modality`, `is_recorded`, `session_url`, `is_favorite`, `prio` (enum: must/high/good/skip), `why` (personal notes). **`prio`, `why`, and `is_favorite` are user-managed** — the Sync operation never overwrites them.

### Server (`server/src/`)
- `db.ts` — mysql2 connection pool, reads `DB_*` env vars
- `routes/sessions.ts` — full CRUD: `GET /api/sessions`, `GET /api/sessions/:id`, `POST`, `PUT`, `DELETE`
- `routes/sync.ts` — `POST /api/sync` → runs scraper, returns `{ inserted, updated, total, errors }`
- `services/scraper.ts` — Puppeteer-based scraper that:
  1. Intercepts JSON API responses on `build.microsoft.com` (primary path — the site is a SPA that calls internal APIs)
  2. Falls back to DOM scraping if no API is detected
  3. Auto-paginates (`?currentPage=N`) until a page returns 0 results
  4. Upserts all sessions + speakers into DB

### Client (`client/src/`)
- `api/sessions.ts` — typed `fetch` wrapper for all server endpoints
- `App.tsx` — loads all sessions once; filtering/sorting is done client-side with `useMemo`
- `components/FilterSidebar.tsx` — filter by prio, type, category, recorded
- `components/SessionTable.tsx` — sortable table, click row to open modal
- `components/SessionModal.tsx` — view/edit all fields (prio dropdown, why textarea, favorite toggle), Save + Delete
- `components/SyncButton.tsx` — calls `POST /api/sync`, shows spinner + result
- `components/Badges.tsx` — `TypeBadge`, `PrioBadge`, `RecBadge`
- `types/index.ts` — `Session`, `Speaker`, `SessionFilters` interfaces (shared shape with server)

### Scraper notes
The Microsoft Build site renders via JavaScript. The scraper intercepts XHR/fetch responses matching `/api/session`, `/sessions/`, `sessionize`, etc. If the API shape changes, update `parseApiData()` in `scraper.ts` — field name aliases are already handled for common variants (`sessionCode`, `code`, `sessionId`; `track`, `category`, `topic`; etc.). DOM fallback selectors are in the `page.evaluate()` block.
