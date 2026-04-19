import { Router, Request, Response } from 'express';
import { runScraper } from '../services/scraper';

const router = Router();

// ── POST /api/sync ────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('[sync] Starting scrape…');
    const result = await runScraper();
    console.log('[sync] Done:', result);
    res.json(result);
  } catch (err: any) {
    console.error('[sync] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;