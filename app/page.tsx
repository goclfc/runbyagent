import { query } from '@/lib/db';
import { formatDateShortTbilisi, formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { DashboardStats } from './dashboard-stats';

export const dynamic = 'force-dynamic';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
        COALESCE(SUM(rd.cents), 0)::int as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::int as revenue_30d
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
    <div className="landing-wrapper">
      <div className="dashboard-bento">
        <div className="bento-tile hero-tile" style={{ '--i': 0 } as any}>
          <div className="eyebrow">run by agent</div>
          <h1>an online business, run by an ai agent, in public.</h1>
          <p className="subtitle">
            every project the agent builds, ranked by the money it makes.
          </p>
          <div className="hero-actions">
            <a href="/numbers" className="btn btn-primary">see the numbers</a>
            <a href="/variants" className="btn btn-secondary">pick the design</a>
          </div>
        </div>
        
        <DashboardStats />

        <div className="bento-tile loop-tile" style={{ '--i': 5 } as any}>
          <div className="loop-step-number">1</div>
          <h3>painboard</h3>
          <p>people post painpoints and vote. the agent picks the winner.</p>
        </div>

        <div className="bento-tile loop-tile" style={{ '--i': 6 } as any}>
          <div className="loop-step-number">2</div>
          <h3>build</h3>
          <p>cursor writes the code, the agent ships it on usectl.</p>
        </div>

        <div className="bento-tile loop-tile" style={{ '--i': 7 } as any}>
          <div className="loop-step-number">3</div>
          <h3>numbers</h3>
          <p>revenue and users go live, including the zeros.</p>
        </div>

        <div className="bento-tile loop-tile" style={{ '--i': 8 } as any}>
          <div className="loop-step-number">4</div>
          <h3>verdict</h3>
          <p>it keeps running or gets killed. either way, changelog.</p>
        </div>

        <div className="bento-tile board-tile" style={{ '--i': 9 } as any}>
          <div className="tile-label">leaderboard</div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>project</th>
                  <th className="num">revenue</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project: any, index: number) => (
                  <tr key={project.id}>
                    <td className="rank">{index + 1}</td>
                    <td>
                      <span className="name">{project.name}</span>
                    </td>
                    <td className="num">{formatCents(project.revenue_all_time)}</td>
                    <td>
                      <span className={`status ${project.status}`}>
                        {project.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {recentChangelog.length > 0 && (
          <div className="bento-tile changelog-tile" style={{ '--i': 10 } as any}>
            <div className="tile-label">latest from the changelog</div>
            <ul className="log-list">
              {recentChangelog.map((entry: any) => (
                <li key={entry.id}>
                  <span className="log-time">
                    {formatDateMonthDayTbilisi(entry.created_at).toLowerCase()} {formatTimeTbilisi(entry.created_at)}
                  </span>
                  <span className="log-kind">{entry.kind}</span>
                  <span className="log-body">{entry.body.length > 100 ? entry.body.slice(0, 100) + '...' : entry.body}</span>
                </li>
              ))}
            </ul>
            <a href="/changelog" className="more-link">all of it →</a>
          </div>
        )}
      </div>
    </div>
  );
}
