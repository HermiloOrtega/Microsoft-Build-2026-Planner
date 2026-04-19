import { ScrapedSession, ScrapedSpeaker } from '../types';

const KNOWN_TYPES = new Set(['Keynote', 'Breakout', 'Lab', 'Demo', 'Lightning Talk']);
const CODE_RE     = /^(KEY|BRK|LAB|DEM|LTG)\d+$/;
const LEVEL_RE    = /^\(\d+\)/;
const MODALITY_RE = /san francisco|online|virtual/i;
const RECORDING_RE = /will (?:not )?be recorded/i;
const NOISE_RE    = /^(show\s+(less|more|results)|\d+\s+results?|order by|relevance|sessions\s*\(\d+\))$/i;
const PROFILE_RE  = /^profile picture of /i;
const INITIALS_RE = /^[A-Z]{1,3}$/;

/**
 * Parse raw copy-pasted text from build.microsoft.com/sessions.
 *
 * Expected per-session pattern (between "Save/Remove to/from favorites" markers):
 *   Type (Keynote / Breakout / Lab / Demo / Lightning Talk)
 *   (Level) Level Name           ← optional
 *   Category                     ← optional for Keynote
 *   Title
 *   Modality (In San Francisco … / Online)
 *   Will [NOT] be recorded
 *   CODE (KEY01 / BRK### / LAB### / DEM### / LTG###)
 *   Description…
 *   [Show less]
 *   [Profile picture of X / Initials]
 *   Speaker Name
 *   |
 *   Company
 *   …
 */
export function parseRawText(rawText: string): ScrapedSession[] {
  // ── Pre-process: insert newlines around known UI text fragments ─────────────
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/Show less/gi,           '\nShow less\n')
    .replace(/Show more/gi,           '\nShow more\n')
    .replace(/Show Results/gi,        '\nShow Results\n')
    .replace(/Save to favorites/gi,   '\nSave to favorites\n')
    .replace(/Remove from favorites/gi, '\nRemove from favorites\n');

  // ── Split into per-session chunks ───────────────────────────────────────────
  const chunks = normalized.split(/\n(?:Save to favorites|Remove from favorites)\n/i);

  const sessions: ScrapedSession[] = [];
  const seenCodes = new Set<string>();

  for (const chunk of chunks) {
    const lines = chunk
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !NOISE_RE.test(l));

    // ── Locate the session code line ──────────────────────────────────────────
    const codeIdx = lines.findIndex(l => CODE_RE.test(l));
    if (codeIdx === -1) continue;

    const code = lines[codeIdx];
    if (seenCodes.has(code)) continue; // deduplicate repeated pages
    seenCodes.add(code);

    const preLines  = lines.slice(0, codeIdx);
    const postLines = lines.slice(codeIdx + 1);

    // ── Parse structured metadata from pre-lines ──────────────────────────────
    let type  = '';
    let level: number | null = null;
    let modality   = '';
    let is_recorded = false;
    const metaRest: string[] = [];

    for (const line of preLines) {
      if (KNOWN_TYPES.has(line)) {
        type = line;
      } else if (LEVEL_RE.test(line)) {
        const m = line.match(/\((\d+)\)/);
        level = m ? parseInt(m[1], 10) : null;
      } else if (MODALITY_RE.test(line)) {
        const hasInPerson = /san francisco/i.test(line);
        const hasOnline   = /online/i.test(line);
        modality = hasInPerson && hasOnline ? 'In-Person + Online'
                 : hasInPerson              ? 'In-Person'
                 :                           'Online';
      } else if (RECORDING_RE.test(line)) {
        is_recorded = !/not/i.test(line);
      } else {
        metaRest.push(line);
      }
    }

    // metaRest = [category?, title]
    if (metaRest.length === 0) continue;
    const title    = metaRest[metaRest.length - 1];
    const category = metaRest.length > 1 ? metaRest.slice(0, -1).join(' ') : '';
    if (!title) continue;

    // ── Parse description + speakers from post-lines ──────────────────────────
    // Strip "Profile picture of X" and short initial tokens (e.g. "CH")
    const cleanedPost = postLines.filter(l => !PROFILE_RE.test(l) && !INITIALS_RE.test(l));

    // Find pipe separators ( Name / | / Company ) and mark their positions
    const pipePositions = new Set<number>();
    const speakers: ScrapedSpeaker[] = [];

    for (let i = 0; i < cleanedPost.length; i++) {
      if (cleanedPost[i] === '|') {
        const name = i > 0 ? cleanedPost[i - 1] : '';
        if (name) {
          speakers.push({ name, profile_url: '', photo_url: '' });
          pipePositions.add(i - 1);
          pipePositions.add(i);
          if (i + 1 < cleanedPost.length) pipePositions.add(i + 1);
        }
      }
    }

    // Description = everything before the first speaker-related line
    const firstSpeakerLine = cleanedPost.findIndex((_, i) => pipePositions.has(i));
    const descLines = firstSpeakerLine === -1 ? cleanedPost : cleanedPost.slice(0, firstSpeakerLine);
    const description = descLines.join(' ').trim();

    sessions.push({
      code, title, description,
      type, level, category,
      modality, is_recorded,
      session_url: '',
      speakers,
    });
  }

  return sessions;
}
