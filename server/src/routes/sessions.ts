import { Router, Request, Response } from 'express';
import pool from '../db';
import { SessionFilters } from '../types';

const router = Router();

// ── GET /api/sessions ─────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = req.query as SessionFilters;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.type && filters.type !== 'all') {
      conditions.push('s.type = ?');
      params.push(filters.type);
    }

    if (filters.category && filters.category !== 'all') {
      conditions.push('s.category = ?');
      params.push(filters.category);
    }

    if (filters.prio && filters.prio !== 'all') {
      conditions.push('s.prio = ?');
      params.push(filters.prio);
    }

    if (filters.recorded === 'yes') {
      conditions.push('s.is_recorded = 1');
    } else if (filters.recorded === 'no') {
      conditions.push('s.is_recorded = 0');
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = `%${filters.search.trim()}%`;
      conditions.push('(s.code LIKE ? OR s.title LIKE ? OR s.category LIKE ? OR s.type LIKE ? OR s.why LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSort: Record<string, string> = {
      prio:     "FIELD(s.prio,'must','high','good','skip')",
      level:    's.level',
      code:     's.code',
      title:    's.title',
      type:     's.type',
      category: 's.category',
    };

    const sortKey = (filters.sort && allowedSort[filters.sort]) ? filters.sort : 'prio';
    const sortExpr = allowedSort[sortKey];
    const sortDir  = filters.direction === 'desc' ? 'DESC' : 'ASC';

    const [rows] = await pool.query<any[]>(
      `SELECT s.*,
              GROUP_CONCAT(sp.id        ORDER BY sp.name SEPARATOR '||') AS sp_ids,
              GROUP_CONCAT(sp.name      ORDER BY sp.name SEPARATOR '||') AS sp_names,
              GROUP_CONCAT(COALESCE(sp.profile_url,'') ORDER BY sp.name SEPARATOR '||') AS sp_profiles,
              GROUP_CONCAT(COALESCE(sp.photo_url,'')   ORDER BY sp.name SEPARATOR '||') AS sp_photos
       FROM sessions s
       LEFT JOIN session_speakers ss ON ss.session_id = s.id
       LEFT JOIN speakers sp         ON sp.id = ss.speaker_id
       ${whereClause}
       GROUP BY s.id
       ORDER BY ${sortExpr} ${sortDir}, s.code ASC`,
      params
    );

    const sessions = rows.map(hydrate);
    res.json(sessions);
  } catch (err: any) {
    console.error('GET /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sessions/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT s.*,
              GROUP_CONCAT(sp.id        ORDER BY sp.name SEPARATOR '||') AS sp_ids,
              GROUP_CONCAT(sp.name      ORDER BY sp.name SEPARATOR '||') AS sp_names,
              GROUP_CONCAT(COALESCE(sp.profile_url,'') ORDER BY sp.name SEPARATOR '||') AS sp_profiles,
              GROUP_CONCAT(COALESCE(sp.photo_url,'')   ORDER BY sp.name SEPARATOR '||') AS sp_photos
       FROM sessions s
       LEFT JOIN session_speakers ss ON ss.session_id = s.id
       LEFT JOIN speakers sp         ON sp.id = ss.speaker_id
       WHERE s.id = ?
       GROUP BY s.id`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(hydrate(rows[0]));
  } catch (err: any) {
    console.error('GET /api/sessions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sessions ────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { code, title, description, type, level, category, modality,
            is_recorded, session_url, is_favorite, prio, why } = req.body;

    const [result] = await pool.query<any>(
      `INSERT INTO sessions (code, title, description, type, level, category, modality,
                             is_recorded, session_url, is_favorite, prio, why)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, title, description ?? null, type ?? null, level ?? null,
       category ?? null, modality ?? null, is_recorded ? 1 : 0,
       session_url ?? null, is_favorite ? 1 : 0, prio ?? 'good', why ?? null]
    );

    const [rows] = await pool.query<any[]>(
      `SELECT s.*,
              GROUP_CONCAT(sp.id        ORDER BY sp.name SEPARATOR '||') AS sp_ids,
              GROUP_CONCAT(sp.name      ORDER BY sp.name SEPARATOR '||') AS sp_names,
              GROUP_CONCAT(COALESCE(sp.profile_url,'') ORDER BY sp.name SEPARATOR '||') AS sp_profiles,
              GROUP_CONCAT(COALESCE(sp.photo_url,'')   ORDER BY sp.name SEPARATOR '||') AS sp_photos
       FROM sessions s
       LEFT JOIN session_speakers ss ON ss.session_id = s.id
       LEFT JOIN speakers sp         ON sp.id = ss.speaker_id
       WHERE s.id = ?
       GROUP BY s.id`,
      [result.insertId]
    );

    res.status(201).json(hydrate(rows[0]));
  } catch (err: any) {
    console.error('POST /api/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/sessions/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, type, level, category, modality,
            is_recorded, session_url, is_favorite, prio, why } = req.body;

    const [result] = await pool.query<any>(
      `UPDATE sessions SET
         title        = ?,
         description  = ?,
         type         = ?,
         level        = ?,
         category     = ?,
         modality     = ?,
         is_recorded  = ?,
         session_url  = ?,
         is_favorite  = ?,
         prio         = ?,
         why          = ?
       WHERE id = ?`,
      [title, description ?? null, type ?? null, level ?? null,
       category ?? null, modality ?? null, is_recorded ? 1 : 0,
       session_url ?? null, is_favorite ? 1 : 0, prio ?? 'good',
       why ?? null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT s.*,
              GROUP_CONCAT(sp.id        ORDER BY sp.name SEPARATOR '||') AS sp_ids,
              GROUP_CONCAT(sp.name      ORDER BY sp.name SEPARATOR '||') AS sp_names,
              GROUP_CONCAT(COALESCE(sp.profile_url,'') ORDER BY sp.name SEPARATOR '||') AS sp_profiles,
              GROUP_CONCAT(COALESCE(sp.photo_url,'')   ORDER BY sp.name SEPARATOR '||') AS sp_photos
       FROM sessions s
       LEFT JOIN session_speakers ss ON ss.session_id = s.id
       LEFT JOIN speakers sp         ON sp.id = ss.speaker_id
       WHERE s.id = ?
       GROUP BY s.id`,
      [req.params.id]
    );

    res.json(hydrate(rows[0]));
  } catch (err: any) {
    console.error('PUT /api/sessions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/sessions/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.query<any>(
      'DELETE FROM sessions WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /api/sessions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── HYDRATE helper ────────────────────────────────────────────────────────────
function hydrate(row: any) {
  const speakers: any[] = [];

  if (row.sp_ids) {
    const ids      = row.sp_ids.split('||');
    const names    = row.sp_names.split('||');
    const profiles = row.sp_profiles.split('||');
    const photos   = row.sp_photos.split('||');

    for (let i = 0; i < ids.length; i++) {
      if (ids[i]) {
        speakers.push({
          id:          Number(ids[i]),
          name:        names[i] || '',
          profile_url: profiles[i] || null,
          photo_url:   photos[i]   || null,
        });
      }
    }
  }

  const { sp_ids, sp_names, sp_profiles, sp_photos, ...session } = row;

  return {
    ...session,
    is_recorded: Boolean(session.is_recorded),
    is_favorite: Boolean(session.is_favorite),
    speakers,
  };
}

export default router;