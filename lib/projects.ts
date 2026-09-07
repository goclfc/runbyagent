import { existsSync } from 'fs';
import { join } from 'path';
import { query } from './db';
import { getAllProjectStats, ProjectStats, EMPTY_STATS } from './track';

export interface ProjectCard extends ProjectStats {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  url: string | null;
  repo_url: string | null;
  status: string;
  launched_at: string | null;
  screenshot_url: string | null;
  revenue_all_time: number;
  revenue_30d: number;
  /** legacy: the self-reported "visitors" metric, kept for older readers of /api/projects */
  users: number | null;
  log_url: string;
}

interface ProjectRow {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  url: string | null;
  repo_url: string | null;
  status: string;
  launched_at: string | null;
  screenshot_url: string | null;
  revenue_all_time: number;
  revenue_30d: number;
  users: number | null;
}

const shotCache = new Map<string, { url: string | null; at: number }>();

/** screenshot_url wins; otherwise public/projects/<slug>.png if gocha dropped one there. */
export function screenshotFor(slug: string, screenshotUrl: string | null): string | null {
  if (screenshotUrl) return screenshotUrl;
  const cached = shotCache.get(slug);
  const now = Date.now();
  if (cached && now - cached.at < 60_000) return cached.url;
  const url = existsSync(join(process.cwd(), 'public', 'projects', `${slug}.png`)) ? `/projects/${slug}.png` : null;
  shotCache.set(slug, { url, at: now });
  return url;
}

/** every project with its money and its platform-counted numbers, in landing order. */
export async function listProjects(): Promise<ProjectCard[]> {
  const [rows, stats] = await Promise.all([
    query<ProjectRow>(`
      SELECT
        p.id, p.slug, p.name, p.tagline, p.url, p.repo_url, p.status, p.launched_at, p.screenshot_url,
        COALESCE(SUM(rd.cents), 0)::int AS revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::int AS revenue_30d,
        (SELECT value::int FROM project_metrics pm WHERE pm.project_id = p.id AND pm.key = 'visitors' LIMIT 1) AS users
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      GROUP BY p.id
    `),
    getAllProjectStats(),
  ]);

  const cards: ProjectCard[] = rows.map((r) => ({
    ...r,
    ...(stats.get(r.id) ?? EMPTY_STATS),
    screenshot_url: screenshotFor(r.slug, r.screenshot_url),
    log_url: `/changelog?project=${r.slug}`,
  }));

  cards.sort((a, b) => {
    if (b.revenue_all_time !== a.revenue_all_time) return b.revenue_all_time - a.revenue_all_time;
    if (b.views_total !== a.views_total) return b.views_total - a.views_total;
    const la = a.launched_at ? new Date(a.launched_at).getTime() : 0;
    const lb = b.launched_at ? new Date(b.launched_at).getTime() : 0;
    return lb - la;
  });

  return cards;
}
