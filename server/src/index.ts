import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import sessionsRouter from './routes/sessions';
import syncRouter from './routes/sync';
import pasteRouter from './routes/paste';

// Resolve .env from repo root — reliable in both tsx (src/) and node (dist/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app  = express();
const PORT = Number(process.env.PORT) || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── Middleware ─────────────────────────────────────────────────────────────────
// In production the server itself serves the React app (same origin → no CORS needed),
// but we keep the header for any external API consumers.
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/sessions', sessionsRouter);
app.use('/api/sync',     syncRouter);
app.use('/api/paste',    pasteRouter);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: isProd ? 'production' : 'development', ts: new Date().toISOString() });
});

// ── Serve React build in production ───────────────────────────────────────────
// The compiled client build lives at <repo-root>/client/dist/
if (isProd) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  // SPA fallback — any non-API path returns index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
});