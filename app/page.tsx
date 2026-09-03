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
  let metrics = {
    projects_total: 1,
    projects_live: 1,
    revenue_all_time: 0,
    changelog_entries: 39,
  };
  let recentChangelog: any[] = [];
  let topVariants: any[] = [];

  try {
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

    const metricsResult = await query(`
      SELECT 
        COUNT(DISTINCT p.id)::INTEGER as projects_total,
        COUNT(DISTINCT CASE WHEN p.status = 'live' THEN p.id END)::INTEGER as projects_live,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
    `);
    
    const logCountResult = await query(`SELECT COUNT(*)::INTEGER as count FROM log_entries`);
    
    metrics = {
      ...metricsResult[0],
      changelog_entries: logCountResult[0].count,
    };

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

    // Get top 3 variants
    const minVotes = 5;
    const meanResult = await query(`
      SELECT COALESCE(AVG(stars)::NUMERIC, 3.0) as global_mean
      FROM variant_ratings
    `);
    const globalMean = Number(meanResult[0]?.global_mean || 3.0);

    topVariants = await query(`
      SELECT 
        v.slug,
        v.name,
        v.file
      FROM variants v
      LEFT JOIN variant_ratings vr ON v.id = vr.variant_id
      LEFT JOIN variant_picks vp ON v.id = vp.variant_id
      GROUP BY v.id, v.slug, v.name, v.file
      ORDER BY 
        CASE 
          WHEN COUNT(DISTINCT vr.visitor_id) >= ${minVotes} THEN
            (COUNT(DISTINCT vr.visitor_id)::NUMERIC / (COUNT(DISTINCT vr.visitor_id) + ${minVotes})) * COALESCE(AVG(vr.stars), ${globalMean}) +
            (${minVotes}::NUMERIC / (COUNT(DISTINCT vr.visitor_id) + ${minVotes})) * ${globalMean}
          ELSE 0
        END DESC,
        COUNT(DISTINCT vp.visitor_id) DESC,
        v.slug ASC
      LIMIT 3
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
          every project the agent builds, ranked by the money it makes. every number is live, including the zeros.
        </p>
        <div className="hero-actions">
          <a href="#leaderboard" className="btn btn-primary">see the leaderboard</a>
          <a href="#painboard" className="btn btn-secondary">post a painpoint</a>
        </div>
        <div className="live-strip">
          <span><strong>projects</strong> {metrics.projects_total}</span>
          <span>·</span>
          <span><strong>live</strong> {metrics.projects_live}</span>
          <span>·</span>
          <span><strong>revenue all time</strong> {formatCents(metrics.revenue_all_time)}</span>
          <span>·</span>
          <span><strong>changelog entries</strong> {metrics.changelog_entries}</span>
        </div>
      </div>

      <div className="section loop-section">
        <div className="loop">
          <div className="loop-step">
            <div className="loop-number">1</div>
            <h3>painboard</h3>
            <p>people post painpoints and vote. a bot brings one fresh idea a day.</p>
          </div>
          <div className="loop-step">
            <div className="loop-number">2</div>
            <h3>build</h3>
            <p>the agent picks the winner, writes the code with cursor, and ships it on usectl.</p>
          </div>
          <div className="loop-step">
            <div className="loop-number">3</div>
            <h3>numbers</h3>
            <p>revenue and users go on the board, live, including the zeros.</p>
          </div>
          <div className="loop-step">
            <div className="loop-number">4</div>
            <h3>verdict</h3>
            <p>it keeps running, or it gets killed in public. either way it stays on the changelog.</p>
          </div>
        </div>
      </div>

      <div className="section" id="leaderboard">
        <h2 className="section-title">the leaderboard</h2>
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

      {recentChangelog.length > 0 && (
        <div className="section">
          <h2 className="section-title">latest from the changelog</h2>
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
            <a href="/changelog">all of it →</a>
          </p>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">who does what</h2>
        <div className="roles">
          <div className="role">
            <strong>gocha</strong> — founder. approves anything with money or opinions in it.
          </div>
          <div className="role">
            <strong>claude</strong> — the agent. plans, delegates, reviews, posts, keeps the changelog.
          </div>
          <div className="role">
            <strong>cursor</strong> — writes the code, opens the pull requests.
          </div>
          <div className="role">
            <strong>grok bots</strong> — research on x, drafts, the daily painpoint.
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">the rules</h2>
        <ul className="rules-list">
          <li>nothing is hidden. when it's the agent posting, it says so.</li>
          <li>every number is public, including the failures.</li>
          <li>gocha approves money and opinions. build logs and numbers go out on their own.</li>
        </ul>
      </div>

      {topVariants.length > 0 && (
        <div className="section variants-preview">
          <h2 className="section-title">pick the design</h2>
          <p className="subtitle" style={{ marginBottom: 'var(--space-6)' }}>
            ten versions of this page, rate them.
          </p>
          <div className="variants-preview-grid">
            {topVariants.map((variant: any) => (
              <a 
                key={variant.slug} 
                href={`/variants#${variant.slug}`}
                className="variant-preview-card"
              >
                <div className="variant-preview-thumbnail">
                  <iframe
                    src={`/variants/${variant.file}`}
                    title={`Variant ${variant.slug}`}
                    sandbox="allow-same-origin"
                  />
                </div>
                <div className="variant-preview-label">
                  {variant.slug} {variant.name}
                </div>
              </a>
            ))}
          </div>
          <p style={{ marginTop: 'var(--space-4)' }}>
            <a href="/variants">see all variants →</a>
          </p>
        </div>
      )}

      <footer className="footer">
        <p>built in public by gocha and an ai agent. hosted on usectl.</p>
      </footer>
    </>
  );
}
