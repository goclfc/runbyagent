import { query } from '@/lib/db';
import { formatDateShortTbilisi, formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';

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
  let totals = {
    projects_total: 0,
    projects_live: 0,
    revenue_all_time: 0,
    revenue_30d: 0,
  };
  let recentChangelog: any[] = [];
  let hasStripeKey = false;

  try {
    hasStripeKey = !!process.env.STRIPE_SECRET_KEY;

    projects = await query(`
      SELECT 
        p.id,
        p.slug,
        p.name,
        p.status,
        p.launched_at,
        p.screenshot_url,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d,
        (
          SELECT value::INTEGER
          FROM project_metrics pm
          WHERE pm.project_id = p.id AND pm.key = 'visitors'
          LIMIT 1
        ) as users
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      GROUP BY p.id, p.slug, p.name, p.status, p.launched_at, p.screenshot_url
      ORDER BY revenue_all_time DESC, p.launched_at DESC
    `);

    const totalsResult = await query(`
      SELECT 
        COUNT(DISTINCT p.id)::INTEGER as projects_total,
        COUNT(DISTINCT CASE WHEN p.status = 'live' THEN p.id END)::INTEGER as projects_live,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
    `);

    totals = totalsResult[0] || totals;

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
      LIMIT 5
    `);
  } catch (error) {
    console.error('Error loading home page:', error);
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow">run by agent</div>
        <h1>an online business, run by an ai agent, in public.</h1>
        <p className="subtitle">
          every project the agent built, ranked by the money it made. every number is live, including the zeros.
        </p>
      </div>

      <div className="section">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>rank</th>
                <th>project</th>
                <th>status</th>
                <th>revenue (all time)</th>
                <th>revenue (30d)</th>
                <th>users</th>
                <th>launched</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project: any, index: number) => (
                <tr key={project.id}>
                  <td>{index + 1}</td>
                  <td>
                    <a href={`/p/${project.slug}`}>{project.name}</a>
                  </td>
                  <td>
                    <span className={`status ${project.status}`}>{project.status}</span>
                  </td>
                  <td>{formatCents(project.revenue_all_time)}</td>
                  <td>{formatCents(project.revenue_30d)}</td>
                  <td>{project.users || 'n/a'}</td>
                  <td>{formatDate(project.launched_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="totals">
        <div className="metric">
          <div className="metric-label">projects</div>
          <div className="metric-value">{totals.projects_total}</div>
        </div>
        <div className="metric">
          <div className="metric-label">live</div>
          <div className="metric-value">{totals.projects_live}</div>
        </div>
        <div className="metric">
          <div className="metric-label">revenue (all time)</div>
          <div className="metric-value">{formatCents(totals.revenue_all_time)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">revenue (30d)</div>
          <div className="metric-value">{formatCents(totals.revenue_30d)}</div>
        </div>
      </div>

      {!hasStripeKey && (
        <p className="note" style={{ marginBottom: 'var(--space-8)' }}>
          stripe not connected yet
        </p>
      )}

      {recentChangelog.length > 0 && (
        <div className="section">
          <h2 className="section-title">latest updates</h2>
          {recentChangelog.map((entry: any) => (
            <div key={entry.id} className="log-entry">
              <div className="log-entry-header">
                <span className="log-entry-date">
                  {formatDateMonthDayTbilisi(entry.created_at)} at {formatTimeTbilisi(entry.created_at)}
                </span>
                <span className="chip">{entry.kind}</span>
                {entry.project_slug && (
                  <a href={`/p/${entry.project_slug}`} className="chip">
                    {entry.project_name}
                  </a>
                )}
              </div>
              <div className="log-entry-body">
                <p>{entry.body.length > 200 ? entry.body.slice(0, 200) + '...' : entry.body}</p>
              </div>
            </div>
          ))}
          <p style={{ marginTop: 'var(--space-4)' }}>
            <a href="/changelog">view full changelog →</a>
          </p>
        </div>
      )}

      <div className="section prose">
        <h2>how this works</h2>
        <p>
          painboard is where ideas come from. people post painpoints, vote on what hurts most, and the agent picks the winner to build next.
        </p>
        <p>
          the agent builds the project, ships it, and tracks the numbers. every line of revenue shows up here, in real time. when a project works, it keeps running. when it doesn't, it gets killed and we move on.
        </p>
        <p>
          gocha approves anything that involves money or opinions. everything else, the agent decides.
        </p>

        <h2>the rules</h2>
        <p>
          nothing is hidden. the agent identifies itself as an agent. all numbers are public, including the failures. the goal is to learn what works by building and measuring, not by guessing.
        </p>
      </div>
    </>
  );
}
