import { query } from './db';

/** per-project counting. see migrations/018_project_hits.sql and public/rba.js. */

/** runbyagent's own pages count as this project id in project_hits / project_presence. */
export const PLATFORM_PROJECT_ID = 0;

/** the day counting went live. cards say "since <date>" for the first month after it. */
export const COUNTING_SINCE = '2026-09-08';

export const ONLINE_WINDOW_SECONDS = 90;

export const BOT_PATTERNS = [
  'runbyagent-claude',
  'bot',
  'spider',
  'crawler',
  'scraper',
  'headless',
  'lighthouse',
  'pagespeed',
  'googlebot',
  'bingbot',
  'slackbot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'whatsapp',
  'telegrambot',
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
];

export function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  if (!ua) return true;
  return BOT_PATTERNS.some((p) => ua.includes(p));
}

/** rba.js makes 32 hex chars; the platform cookie is a uuid or 32 hex. anything in that shape is fine. */
export function isValidVid(vid: unknown): vid is string {
  return typeof vid === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(vid);
}

export interface ProjectStats {
  online: number;
  views_total: number;
  visitors_total: number;
  returning_total: number;
  views_7d: number;
}

export const EMPTY_STATS: ProjectStats = {
  online: 0,
  views_total: 0,
  visitors_total: 0,
  returning_total: 0,
  views_7d: 0,
};

// ---- beacon plumbing shared by /api/track and /api/track/ping ----

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
};

export const BEACON_MAX_BYTES = 1024;

export type BeaconBody = { project?: unknown; vid?: unknown; path?: unknown; ref?: unknown };

/** sendBeacon posts text/plain, so read the raw text and parse it ourselves. */
export async function readBeacon(req: Request): Promise<{ body: BeaconBody } | { error: string; status: number }> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > BEACON_MAX_BYTES) return { error: 'body too large', status: 413 };
  const text = await req.text();
  if (text.length > BEACON_MAX_BYTES) return { error: 'body too large', status: 413 };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object') return { error: 'invalid body', status: 400 };
    return { body };
  } catch {
    return { error: 'invalid json', status: 400 };
  }
}

// ---- rate limit: 60 beacons a minute per vid, in memory (one process per deploy) ----

const BEACONS_PER_MINUTE = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

export function allowBeacon(vid: string, now = Date.now()): boolean {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(vid);
  if (!b || b.resetAt <= now) {
    buckets.set(vid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  b.count += 1;
  return b.count <= BEACONS_PER_MINUTE;
}

// ---- project lookup, cached a minute ----

const slugCache = new Map<string, { id: number | null; at: number }>();

/** "runbyagent" (or "0") is the platform itself. unknown slugs resolve to null. */
export async function resolveProjectId(slug: unknown): Promise<number | null> {
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  if (slug === 'runbyagent' || slug === '0') return PLATFORM_PROJECT_ID;
  const cached = slugCache.get(slug);
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.id;
  const rows = await query<{ id: number }>('SELECT id FROM projects WHERE slug = $1', [slug]);
  const id = rows[0]?.id ?? null;
  slugCache.set(slug, { id, at: now });
  return id;
}

// ---- writes ----

export async function recordView(projectId: number, vid: string): Promise<void> {
  await query(
    `INSERT INTO project_hits (project_id, vid, day, first_seen, last_seen, views)
     VALUES ($1, $2, CURRENT_DATE, NOW(), NOW(), 1)
     ON CONFLICT (project_id, vid, day)
     DO UPDATE SET views = project_hits.views + 1, last_seen = NOW()`,
    [projectId, vid],
  );
  await recordPing(projectId, vid);
}

let lastPresenceSweep = 0;

export async function recordPing(projectId: number, vid: string): Promise<void> {
  await query(
    `INSERT INTO project_presence (project_id, vid, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (project_id, vid) DO UPDATE SET last_seen = NOW()`,
    [projectId, vid],
  );
  const now = Date.now();
  if (now - lastPresenceSweep > 5 * 60_000) {
    lastPresenceSweep = now;
    await query(`DELETE FROM project_presence WHERE last_seen < NOW() - INTERVAL '1 day'`);
  }
}

// ---- reads ----

/** stats for every project id that has rows, keyed by project id. */
export async function getAllProjectStats(): Promise<Map<number, ProjectStats>> {
  const [totals, returning, online] = await Promise.all([
    query<{ project_id: number; views_total: number; visitors_total: number; views_7d: number }>(`
      SELECT project_id,
             COALESCE(SUM(views), 0)::int AS views_total,
             COUNT(DISTINCT vid)::int AS visitors_total,
             COALESCE(SUM(CASE WHEN day >= CURRENT_DATE - 6 THEN views ELSE 0 END), 0)::int AS views_7d
      FROM project_hits
      GROUP BY project_id
    `),
    query<{ project_id: number; returning_total: number }>(`
      SELECT project_id, COUNT(*)::int AS returning_total
      FROM (
        SELECT project_id, vid
        FROM project_hits
        GROUP BY project_id, vid
        HAVING COUNT(DISTINCT day) >= 2
      ) r
      GROUP BY project_id
    `),
    query<{ project_id: number; online: number }>(`
      SELECT project_id, COUNT(DISTINCT vid)::int AS online
      FROM project_presence
      WHERE last_seen >= NOW() - ($1 || ' seconds')::interval
      GROUP BY project_id
    `, [String(ONLINE_WINDOW_SECONDS)]),
  ]);

  const out = new Map<number, ProjectStats>();
  const get = (id: number) => {
    let s = out.get(id);
    if (!s) {
      s = { ...EMPTY_STATS };
      out.set(id, s);
    }
    return s;
  };
  for (const t of totals) {
    const s = get(t.project_id);
    s.views_total = t.views_total;
    s.visitors_total = t.visitors_total;
    s.views_7d = t.views_7d;
  }
  for (const r of returning) get(r.project_id).returning_total = r.returning_total;
  for (const o of online) get(o.project_id).online = o.online;
  return out;
}

export async function getProjectStats(projectId: number): Promise<ProjectStats> {
  const all = await getAllProjectStats();
  return all.get(projectId) ?? { ...EMPTY_STATS };
}

export interface LiveProjectNumbers {
  slug: string;
  online: number;
  views_total: number;
}

/** the two numbers that move while someone watches the landing; /api/live sends them in every metrics event. */
export async function getLiveProjectNumbers(): Promise<LiveProjectNumbers[]> {
  return query<LiveProjectNumbers>(`
    SELECT p.slug,
           COALESCE(o.online, 0)::int AS online,
           COALESCE(h.views_total, 0)::int AS views_total
    FROM projects p
    LEFT JOIN (
      SELECT project_id, COUNT(DISTINCT vid) AS online
      FROM project_presence
      WHERE last_seen >= NOW() - ($1 || ' seconds')::interval
      GROUP BY project_id
    ) o ON o.project_id = p.id
    LEFT JOIN (
      SELECT project_id, SUM(views) AS views_total FROM project_hits GROUP BY project_id
    ) h ON h.project_id = p.id
    ORDER BY p.slug
  `, [String(ONLINE_WINDOW_SECONDS)]);
}

/** "since september 8" for the first month of counting, then nothing. */
export function countingSinceNote(now = new Date()): string | null {
  const since = new Date(`${COUNTING_SINCE}T00:00:00Z`);
  const days = (now.getTime() - since.getTime()) / 86_400_000;
  if (days > 31) return null;
  const label = since.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).toLowerCase();
  return `counting since ${label}`;
}
