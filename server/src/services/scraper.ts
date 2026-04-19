import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import pool from '../db';
import { ScrapedSession, ScrapedSpeaker, SyncResult } from '../types';

const BASE_HOST = 'https://build.microsoft.com';

const PAGES_TO_SCRAPE = [
  `${BASE_HOST}/en-US/sessions`,
  `${BASE_HOST}/en-US/sessions?currentPage=2`,
];

// ── API RESPONSE PARSER ────────────────────────────────────────────────────────
// Handles various JSON shapes the Build SPA might return for session data.
function parseApiData(json: any): ScrapedSession[] {
  const arr: any[] =
    Array.isArray(json)            ? json :
    Array.isArray(json?.sessions)  ? json.sessions :
    Array.isArray(json?.data)      ? json.data :
    Array.isArray(json?.items)     ? json.items :
    Array.isArray(json?.results)   ? json.results :
    null as any;

  if (!arr || arr.length === 0) return [];

  const sessions: ScrapedSession[] = [];

  for (const item of arr) {
    try {
      const code  = String(item.sessionCode || item.code || item.sessionId || item.id || '').trim();
      const title = String(item.title || item.name || item.sessionTitle || '').trim();
      if (!code || !title) continue;

      const description = String(item.description || item.abstract || item.summary || '').trim();
      const type     = String(item.type || item.sessionType || item.format || '').trim();
      const rawLevel = item.level || item.audienceLevel || item.levelCode || 0;
      const level    = parseInt(String(rawLevel)) || null;
      const category = String(
        item.category || item.track || item.topic ||
        (Array.isArray(item.tags) ? item.tags[0] : '') || ''
      ).trim();
      const modality = String(item.modality || item.deliveryFormat || '').trim();
      const is_recorded = Boolean(item.isRecorded ?? item.recorded ?? item.willBeRecorded);
      const session_url = String(item.sessionUrl || item.url || item.link || '').trim();

      const rawSpeakers: any[] = item.speakers || item.presenters || item.presenter || [];
      const speakers: ScrapedSpeaker[] = (Array.isArray(rawSpeakers) ? rawSpeakers : [rawSpeakers])
        .map((sp: any) => ({
          name:        String(sp.name || sp.fullName || sp.displayName || '').trim(),
          profile_url: String(sp.profileUrl || sp.url || sp.link || '').trim(),
          photo_url:   String(sp.photoUrl || sp.imageUrl || sp.avatar || sp.thumbnailUrl || '').trim(),
        }))
        .filter(sp => sp.name);

      sessions.push({ code, title, description, type, level, category, modality, is_recorded, session_url, speakers });
    } catch { /* skip malformed items */ }
  }

  return sessions;
}

// ── MAIN ENTRY ─────────────────────────────────────────────────────────────────
export async function runScraper(): Promise<SyncResult> {
  const result: SyncResult = { inserted: 0, updated: 0, total: 0, errors: [] };
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900',
      ],
    });

    const seenCodes   = new Set<string>();
    const allSessions: ScrapedSession[] = [];

    for (let i = 0; i < PAGES_TO_SCRAPE.length; i++) {
      const pageUrl = PAGES_TO_SCRAPE[i];
      console.log(`[scraper] ── Page ${i + 1}: ${pageUrl}`);

      const sessions = await scrapePage(browser, pageUrl, i + 1);

      const newSessions = sessions.filter(s => s.code && !seenCodes.has(s.code));
      newSessions.forEach(s => seenCodes.add(s.code));
      allSessions.push(...newSessions);
      console.log(`[scraper] Page ${i + 1}: ${newSessions.length} new sessions (running total: ${allSessions.length})`);

      if (i < PAGES_TO_SCRAPE.length - 1) await sleep(1500);
    }

    result.total = allSessions.length;
    console.log(`[scraper] Scraping complete — ${allSessions.length} unique sessions. Upserting to DB…`);

    for (const s of allSessions) {
      try {
        await upsertSession(s, result);
      } catch (err: any) {
        result.errors.push(`${s.code}: ${err.message}`);
      }
    }

    console.log(`[scraper] DB upsert done — inserted: ${result.inserted}, updated: ${result.updated}, errors: ${result.errors.length}`);
  } finally {
    if (browser) await browser.close();
  }

  return result;
}

// ── SCRAPE ONE PAGE ─────────────────────────────────────────────────────────────
async function scrapePage(browser: Browser, url: string, pageNum: number): Promise<ScrapedSession[]> {
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    // ── API Interception (primary path) ──────────────────────────────────────
    // The Build site is an SPA that calls internal APIs; intercept those before
    // they are consumed, so we don't depend on fragile DOM selectors.
    const responsePromises: Promise<void>[] = [];
    const capturedApiSessions: ScrapedSession[] = [];

    const responseHandler = (response: any) => {
      const p = (async () => {
        try {
          if (response.status() < 200 || response.status() >= 300) return;
          const ct: string = response.headers()['content-type'] || '';
          if (!ct.includes('json')) return;
          const urlStr: string = response.url();
          if (!/session|schedule|agenda|catalog|speaker|event/i.test(urlStr)) return;

          const text = await response.text();
          const json = JSON.parse(text);
          const parsed = parseApiData(json);
          if (parsed.length > 0) {
            capturedApiSessions.push(...parsed);
            console.log(`[scraper] API intercept: ${parsed.length} sessions from ${urlStr}`);
          }
        } catch { /* ignore non-JSON or unrelated responses */ }
      })();
      responsePromises.push(p);
    };

    page.on('response', responseHandler);

    // Navigate — networkidle2 waits for SPA to finish its API calls
    console.log(`[scraper] Navigating to ${url}…`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90_000 });

    // Wait for all async response handlers to finish, then stop intercepting
    await Promise.allSettled(responsePromises);
    page.off('response', responseHandler);

    if (capturedApiSessions.length > 0) {
      console.log(`[scraper] Using ${capturedApiSessions.length} sessions from API interception on page ${pageNum}`);
      return capturedApiSessions;
    }

    console.log(`[scraper] No API data captured — falling back to DOM scraping on page ${pageNum}`);

    // ── Dismiss cookie / consent banner ─────────────────────────────────────
    await dismissCookieBanner(page);

    // ── Wait for the results container, then for actual session blocks ──────
    console.log('[scraper] Waiting for results container…');
    await page.waitForSelector('[data-cy="content-container"]', { timeout: 30_000 })
      .catch(() => console.warn('[scraper] content-container not found after 30s'));

    console.log('[scraper] Waiting for session blocks…');
    await page.waitForSelector('[data-cy="session-block"]', { timeout: 30_000 })
      .catch(() => console.warn('[scraper] session-block not found after 30s'));

    // ── Scroll to trigger any lazy-loaded content ────────────────────────────
    await autoScroll(page);

    // ── Debug: screenshot so we can see what Puppeteer loaded ────────────────
    const screenshotPath = path.join(process.cwd(), `debug-page${pageNum}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[scraper] Screenshot saved: ${screenshotPath}`);

    // ── Count blocks before extracting ──────────────────────────────────────
    const blockCount = await page.evaluate(() =>
      document.querySelectorAll('[data-cy="session-block"]').length
    );
    console.log(`[scraper] Found ${blockCount} session-block elements in DOM`);

    if (blockCount === 0) {
      const snippet = await page.evaluate(() => document.body?.innerHTML?.slice(0, 800) ?? '');
      console.warn('[scraper] Page body snippet (first 800 chars):', snippet);
      return [];
    }

    // Debug: log the outerHTML of the first block so we can verify selectors
    const firstBlockHtml = await page.evaluate(() => {
      const b = document.querySelector('[data-cy="session-block"]');
      return b ? b.outerHTML.slice(0, 1500) : 'null';
    });
    console.log('[scraper] First block HTML (first 1500 chars):\n', firstBlockHtml);

    // ── Extract all session data ─────────────────────────────────────────────
    const sessions = await page.evaluate((baseHost: string) => {
      const results: any[]    = [];
      const blockErrors: string[] = [];
      const blocks = Array.from(document.querySelectorAll('[data-cy="session-block"]'));

      for (const block of blocks) {
        try {
          // ── Session code ─────────────────────────────────────────────────
          // Primary: text node(s) inside .session-block__session-code (after the SVG icon div)
          const codeEl   = block.querySelector('.session-block__session-code');
          const codeText = codeEl
            ? Array.from(codeEl.childNodes)
                .filter(n => n.nodeType === 3 /* TEXT_NODE */)
                .map(n => (n.textContent ?? '').trim())
                .filter(Boolean)
                .join('')
            : '';

          // Fallback: h3 id attribute (e.g. <h3 id="BRK202">)
          const h3El    = block.querySelector('h3[id]');
          const h3Code  = h3El?.getAttribute('id') ?? '';

          // Fallback: parse from href  /en-US/sessions/BRK202?source=...
          const titleLink = block.querySelector('a.session-block__title') as HTMLAnchorElement | null;
          const hrefParts = titleLink?.getAttribute('href')?.split('?')[0].split('/') ?? [];
          const hrefCode  = hrefParts[hrefParts.length - 1] ?? '';

          const code = codeText || h3Code || hrefCode;

          // ── Title ─────────────────────────────────────────────────────────
          const title = titleLink?.textContent?.trim() ?? '';
          if (!title) continue;

          // ── Session URL ───────────────────────────────────────────────────
          const rawHref     = titleLink?.getAttribute('href') ?? '';
          const session_url = rawHref
            ? `${baseHost}${rawHref.split('?')[0]}`
            : '';

          // ── Pills ─────────────────────────────────────────────────────────
          // The title column has exactly 2 .session-block__pills divs:
          //   pillGroups[0] = type / level / category  (each is a .dv-badge)
          //   pillGroups[1] = modality + recorded       (each is a .dv-badge)
          const titleCol   = block.querySelector('.session-block__title-column');
          const pillGroups = titleCol
            ? Array.from(titleCol.querySelectorAll(':scope > .session-block__pills'))
            : [];

          // Row 1 pills — get direct-child span of each .dv-badge to skip icon spans
          const row1Badges = pillGroups[0]
            ? Array.from(pillGroups[0].querySelectorAll(':scope > .dv-badge'))
            : [];

          const getBadgeText = (badge: Element): string => {
            // Prefer direct child span (skips icon spans nested inside .dvglyph__react-glyph-container)
            const directSpan = badge.querySelector(':scope > span');
            return (directSpan?.textContent ?? badge.textContent ?? '').trim();
          };

          const typeRaw     = getBadgeText(row1Badges[0] ?? document.createElement('div')); // "Breakout"
          const levelRaw    = getBadgeText(row1Badges[1] ?? document.createElement('div')); // "(300) Advanced"
          const categoryRaw = getBadgeText(row1Badges[2] ?? document.createElement('div')); // "Developer Tools & Frameworks"

          // Level: extract number from "(300) Advanced"
          const levelMatch = levelRaw.match(/\((\d+)\)/);
          const level      = levelMatch ? parseInt(levelMatch[1], 10) : null;

          // Row 2 pills — modality + recorded
          const row2Badges  = pillGroups[1]
            ? Array.from(pillGroups[1].querySelectorAll('.dv-badge'))
            : [];
          const row2Texts   = row2Badges.map(el => (el.textContent ?? '').trim());

          const modalityRaw = row2Texts.find(t => /san francisco|online|in.person|virtual/i.test(t)) ?? '';
          const is_recorded = row2Texts.some(t => /will be recorded/i.test(t));

          let modality = '';
          if (/san francisco/i.test(modalityRaw) && /online/i.test(modalityRaw)) {
            modality = 'In-Person + Online';
          } else if (/san francisco/i.test(modalityRaw) || /in.person/i.test(modalityRaw)) {
            modality = 'In-Person';
          } else if (/online/i.test(modalityRaw) || /virtual/i.test(modalityRaw)) {
            modality = 'Online';
          }

          // ── Description ───────────────────────────────────────────────────
          const descEl      = block.querySelector('.dv-content-toggle__content');
          const description = (descEl?.textContent ?? '').trim();

          // ── Speakers ──────────────────────────────────────────────────────
          const speakerEls = Array.from(block.querySelectorAll('.person-badge'));
          const speakers   = speakerEls.map(sp => {
            const nameEl      = sp.querySelector('a.person-badge__name') as HTMLAnchorElement | null;
            const imgEl       = sp.querySelector('img.thumbnail__image') as HTMLImageElement | null;
            const companyEl   = sp.querySelector('span.person-badge__detail:last-of-type');

            const rawSpHref   = nameEl?.getAttribute('href') ?? '';
            const profile_url = rawSpHref
              ? `${baseHost}${rawSpHref.split('?')[0]}`
              : '';

            return {
              name:        (nameEl?.textContent ?? '').trim(),
              profile_url,
              photo_url:   imgEl?.src ?? '',
              company:     (companyEl?.textContent ?? '').trim(),
            };
          }).filter(s => s.name);

          // ── Is Favorite ───────────────────────────────────────────────────
          const is_favorite = block.querySelector('button.backpack-button--remove') !== null;

          results.push({
            code, title, description,
            type: typeRaw, level, category: categoryRaw,
            modality, is_recorded, session_url,
            speakers, is_favorite,
          });
        } catch (e: any) {
          blockErrors.push(e?.message ?? String(e));
        }
      }

      return { results, blockErrors };
    }, BASE_HOST);

    const { results: extracted, blockErrors } = sessions as any;
    if (blockErrors?.length) {
      console.warn(`[scraper] ${blockErrors.length} block errors on page ${pageNum}:`, blockErrors.slice(0, 5));
    }
    const sessionList = extracted as ScrapedSession[];
    console.log(`[scraper] Extracted ${sessionList.length} sessions from page ${pageNum}`);
    return sessionList;

  } catch (err: any) {
    console.error(`[scraper] Failed on page ${pageNum}: ${err.message}`);
    return [];
  } finally {
    await page.close();
  }
}

// ── COOKIE / CONSENT BANNER DISMISSAL ─────────────────────────────────────────
async function dismissCookieBanner(page: Page): Promise<void> {
  // Give the banner a moment to appear
  await sleep(1500);

  const clicked = await page.evaluate(() => {
    // Selectors for common consent banners (OneTrust, Microsoft, generic)
    const candidates = [
      '#onetrust-accept-btn-handler',             // OneTrust "Accept All"
      'button[id*="accept-all"]',
      'button[id*="acceptAll"]',
      'button[aria-label*="accept all" i]',
      'button[aria-label*="accept cookies" i]',
      'button[data-telemetry-id*="cookie" i]',
      '[class*="cookie"] button[class*="accept" i]',
      '[class*="consent"] button[class*="accept" i]',
      // Microsoft-specific patterns
      '#ms-consent-btn-accept',
      'button[data-cy="accept-cookies"]',
      '.ms-Consent button',
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el) {
        el.click();
        return `clicked: ${sel}`;
      }
    }
    return null;
  });

  if (clicked) {
    console.log(`[scraper] Cookie banner dismissed — ${clicked}`);
    await sleep(1000); // let the banner animate away
  } else {
    console.log('[scraper] No cookie banner detected (or already accepted)');
  }
}

// ── AUTO-SCROLL to trigger lazy-loaded content ─────────────────────────────────
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const distance = 500;
      let scrolled   = 0;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        scrolled += distance;
        if (scrolled >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);

      // Safety: resolve after 15s regardless
      setTimeout(() => { clearInterval(timer); resolve(); }, 15_000);
    });
  });

  // Scroll back to top and let the page settle
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
}

// ── UPSERT SESSION ─────────────────────────────────────────────────────────────
export async function upsertSession(s: ScrapedSession, result: SyncResult): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query<any[]>(
      'SELECT id FROM sessions WHERE code = ?',
      [s.code]
    );
    let sessionId: number;

    if (existing.length > 0) {
      sessionId = existing[0].id;
      await conn.query(
        `UPDATE sessions
         SET title=?, description=?, type=?, level=?, category=?, modality=?, is_recorded=?, session_url=?
         WHERE id=?`,
        [
          s.title,
          s.description || null,
          s.type        || null,
          s.level       ?? null,
          s.category    || null,
          s.modality    || null,
          s.is_recorded ? 1 : 0,
          s.session_url || null,
          sessionId,
        ]
      );
      result.updated++;
    } else {
      const [ins] = await conn.query<any>(
        `INSERT INTO sessions
           (code, title, description, type, level, category, modality, is_recorded, session_url, is_favorite, prio)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'good')`,
        [
          s.code,
          s.title,
          s.description || null,
          s.type        || null,
          s.level       ?? null,
          s.category    || null,
          s.modality    || null,
          s.is_recorded ? 1 : 0,
          s.session_url || null,
          (s as any).is_favorite ? 1 : 0,
        ]
      );
      sessionId = ins.insertId;
      result.inserted++;
    }

    // ── Re-link speakers ────────────────────────────────────────────────────
    await conn.query('DELETE FROM session_speakers WHERE session_id = ?', [sessionId]);

    for (const sp of s.speakers) {
      if (!sp.name) continue;

      await conn.query(
        `INSERT INTO speakers (name, profile_url, photo_url)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           profile_url = COALESCE(VALUES(profile_url), profile_url),
           photo_url   = COALESCE(VALUES(photo_url),   photo_url)`,
        [sp.name, sp.profile_url || null, sp.photo_url || null]
      );

      const [spRow] = await conn.query<any[]>(
        'SELECT id FROM speakers WHERE name = ?',
        [sp.name]
      );

      if (spRow.length > 0) {
        await conn.query(
          'INSERT IGNORE INTO session_speakers (session_id, speaker_id) VALUES (?, ?)',
          [sessionId, spRow[0].id]
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
