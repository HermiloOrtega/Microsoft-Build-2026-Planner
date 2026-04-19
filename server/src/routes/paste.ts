import { Router, Request, Response } from 'express';
import { upsertSession } from '../services/scraper';
import { parseRawText } from '../services/textParser';
import { SyncResult } from '../types';

const router = Router();

// ── POST /api/paste ───────────────────────────────────────────────────────────
// Accepts raw copy-pasted text from the Build sessions page and imports it.
router.post('/', async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  const result: SyncResult = { inserted: 0, updated: 0, total: 0, errors: [] };

  try {
    const sessions = parseRawText(text);
    console.log(`[paste] Parsed ${sessions.length} sessions from pasted text`);
    result.total = sessions.length;

    for (const s of sessions) {
      try {
        await upsertSession(s, result);
      } catch (err: any) {
        result.errors.push(`${s.code}: ${err.message}`);
      }
    }

    console.log(`[paste] Done — inserted: ${result.inserted}, updated: ${result.updated}, errors: ${result.errors.length}`);
    res.json(result);
  } catch (err: any) {
    console.error('[paste] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
