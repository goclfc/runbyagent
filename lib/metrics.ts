import { query } from './db';
import { listProjects } from './projects';
import { getProjectStats, PLATFORM_PROJECT_ID } from './track';

export interface PlatformTotals {
  projects_total: number;
  projects_live: number;
  revenue_all_time: number;
  revenue_30d: number;
  views_today: number;
  views_total: number;
  uniques_today: number;
  uniques_total: number;
  online: number;
  returning_total: number;
}

export interface MetricsProject {
  slug: string;
  name: string;
  status: string;
  launched_at: string | null;
  tagline: string | null;
  screenshot_url: string | null;
  online: number;
  views_total: number;
  views_7d: number;
  visitors_total: number;
  returning_total: number;
  revenue_all_time: number;
  revenue_30d: number;
  log_url: string;
}

export type Metrics = PlatformTotals & { projects: MetricsProject[] };

export const EMPTY_TOTALS: PlatformTotals = {
  projects_total: 0,
  projects_live: 0,
  revenue_all_time: 0,
  revenue_30d: 0,
  views_today: 0,
  views_total: 0,
  uniques_today: 0,
  uniques_total: 0,
  online: 0,
  returning_total: 0,
};

/** the platform strip: projects, money, views, uniques, returning, online. */
export async function getPlatformTotals(): Promise<PlatformTotals> {
  const today = new Date().toISOString().split('T')[0];
  // views and uniques come from different tables; aggregate each on its own
  // (joining them multiplied every view by the number of visitor-day rows)
  const [money, views, uniques, platform] = await Promise.all([
    query<{ projects_total: number; projects_live: number; revenue_all_time: number; revenue_30d: number }>(`
      SELECT 
        COUNT(DISTINCT p.id)::INTEGER as projects_total,
        COUNT(DISTINCT CASE WHEN p.status = 'live' THEN p.id END)::INTEGER as projects_live,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
    `),
    query<{ views_today: number; views_total: number }>(`
      SELECT 
        COALESCE(SUM(CASE WHEN day = $1 THEN views ELSE 0 END), 0)::INTEGER as views_today,
        COALESCE(SUM(views), 0)::INTEGER as views_total
      FROM hits
    `, [today]),
    query<{ uniques_today: number; uniques_total: number }>(`
      SELECT 
        COALESCE(COUNT(DISTINCT CASE WHEN day = $1 THEN visitor_id END), 0)::INTEGER as uniques_today,
        COALESCE(COUNT(DISTINCT visitor_id), 0)::INTEGER as uniques_total
      FROM visitor_days
    `, [today]),
    getProjectStats(PLATFORM_PROJECT_ID),
  ]);

  return {
    ...EMPTY_TOTALS,
    ...money[0],
    ...views[0],
    ...uniques[0],
    online: platform.online,
    returning_total: platform.returning_total,
  };
}

/** everything /api/metrics returns: the platform strip and one row per project. */
export async function getMetrics(): Promise<Metrics> {
  const [totals, projects] = await Promise.all([getPlatformTotals(), listProjects()]);
  return {
    ...totals,
    projects: projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      status: p.status,
      launched_at: p.launched_at,
      tagline: p.tagline,
      screenshot_url: p.screenshot_url,
      online: p.online,
      views_total: p.views_total,
      views_7d: p.views_7d,
      visitors_total: p.visitors_total,
      returning_total: p.returning_total,
      revenue_all_time: p.revenue_all_time,
      revenue_30d: p.revenue_30d,
      log_url: p.log_url,
    })),
  };
}
