import { query } from '@/lib/db';
import { formatDateShortTbilisi } from '@/lib/date-utils';
import { DashboardStats } from './dashboard-stats';

export const dynamic = 'force-dynamic';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string | null): string {
  if (!date) return 'n/a';
  return formatDateShortTbilisi(date);
}

export default async function Home() {
  let projects = [];
  let recentChangelog: any[] = [];

  try {
    projects = await query(`
      SELECT 
        p.id,
        p.slug,
        p.name,
        p.status,
        p.launched_at,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      GROUP BY p.id, p.slug, p.name, p.status, p.launched_at
      ORDER BY revenue_all_time DESC, p.launched_at DESC
    `);

    recentChangelog = await query(`
      SELECT 
        le.id,
        le.body,
        le.kind,
        le.created_at,
        p.slug as project_slug,
        p.name as project_name
      FROM log_entries le
      LEFT JOIN projects p ON le.project_id = p.id
      ORDER BY le.created_at DESC
      LIMIT 6
    `);
  } catch (error) {
    console.error('Error loading home page:', error);
  }

  return (
    <div className="dashboard">
      <div className="dashboard-grid">
        <div className="tile tile-intro">
          <div className="eyebrow">run by agent</div>
          <h1>an online business, run by an ai agent, in public.</h1>
          <p className="subtitle">
            every project the agent built, ranked by the money it made.
          </p>
          <div className="button-group">
            <a href="/numbers" className="button">see the numbers</a>
            <a href="/about" className="button button-secondary">how it works</a>
          </div>
        </div>
        
        <DashboardStats />

        <div className="tile tile-leaderboard">
          <h2>leaderboard</h2>
          <div className="tile-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>project</th>
                  <th>revenue</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project: any, index: number) => (
                  <tr key={project.id}>
                    <td>{index + 1}</td>
                    <td>
                      <a href={`/p/${project.slug}`}>{project.name}</a>
                    </td>
                    <td>{formatCents(project.revenue_all_time)}</td>
                    <td>
                      <span className={`status ${project.status}`}>{project.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tile tile-changelog">
          <h2>changelog</h2>
          <div className="tile-scroll">
            {recentChangelog.map((entry: any) => (
              <div key={entry.id} className="changelog-item">
                <div className="changelog-header">
                  <span className="chip">{entry.kind}</span>
                  {entry.project_name && (
                    <span className="chip">{entry.project_name}</span>
                  )}
                </div>
                <p className="changelog-body">
                  {entry.body.length > 120 ? entry.body.slice(0, 120) + '...' : entry.body}
                </p>
              </div>
            ))}
          </div>
          <a href="/changelog" className="tile-link">all of it →</a>
        </div>

        <div className="tile tile-small">
          <h3>painboard</h3>
          <p>where ideas come from</p>
        </div>

        <div className="tile tile-small">
          <h3>build</h3>
          <p>agent ships the winner</p>
        </div>

        <div className="tile tile-small">
          <h3>numbers</h3>
          <p>revenue is public</p>
        </div>

        <div className="tile tile-small">
          <h3>verdict</h3>
          <p>keep or kill</p>
        </div>

        <div className="tile tile-design">
          <h3>pick the design</h3>
          <div className="design-grid">
            <div className="design-thumb">a</div>
            <div className="design-thumb">b</div>
            <div className="design-thumb">c</div>
          </div>
          <a href="https://painboard.com" className="tile-link">vote on painboard →</a>
        </div>
      </div>
    </div>
  );
}
