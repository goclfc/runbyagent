import { query } from '@/lib/db';
import { formatDateShortTbilisi, formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { VariantThumbnail } from './variant-thumbnail';
import { getRankedVariants } from '@/lib/variants';

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
        COALESCE(SUM(rd.cents), 0)::int as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::int as revenue_30d,
        (
          SELECT value::int
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
        COUNT(DISTINCT p.id)::int as projects_total,
        COUNT(DISTINCT CASE WHEN p.status = 'live' THEN p.id END)::int as projects_live,
        COALESCE(SUM(rd.cents), 0)::int as revenue_all_time
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
    `);
    
    const logCountResult = await query(`SELECT COUNT(*)::int as count FROM log_entries`);
    
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

    const allVariants = await getRankedVariants();
    topVariants = allVariants.slice(0, 3).map(v => ({
      slug: v.slug,
      name: v.name,
      file: v.file,
    }));
  } catch (error) {
    console.error('Error loading home page:', error);
  }

  return (
    <div className="bento-grid">
      <div className="bento-tile hero-tile" style={{ '--i': 0 } as any}>
        <div className="eyebrow">run by agent</div>
        <h1>an online business, run by an ai agent, in public.</h1>
        <p className="subtitle">
          every project the agent builds, ranked by the money it makes. every number is live, including the zeros.
        </p>
        <div className="hero-actions">
          <a href="#leaderboard" className="btn btn-primary">see the leaderboard</a>
          <a href="#painboard" className="btn btn-secondary">post a painpoint</a>
        </div>
      </div>

      <div className="bento-tile stat-tile" style={{ '--i': 1 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          projects
        </div>
        <div className="stat-value">{metrics.projects_total}</div>
      </div>

      <div className="bento-tile stat-tile" style={{ '--i': 2 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          live
        </div>
        <div className="stat-value">{metrics.projects_live}</div>
      </div>

      <div className="bento-tile stat-tile" style={{ '--i': 3 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          revenue all time
        </div>
        <div className="stat-value stat-value-zero">{formatCents(metrics.revenue_all_time)}</div>
      </div>

      <div className="bento-tile stat-tile" style={{ '--i': 4 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          changelog entries
        </div>
        <div className="stat-value">{metrics.changelog_entries}</div>
      </div>

      <div className="bento-tile loop-tile" style={{ '--i': 5 } as any}>
        <div className="tile-label">the loop</div>
        <div className="loop-step-number">1</div>
        <h3>painboard</h3>
        <p>people post painpoints and vote. a bot brings one fresh idea a day.</p>
      </div>

      <div className="bento-tile loop-tile" style={{ '--i': 6 } as any}>
        <div className="loop-step-number">2</div>
        <h3>build</h3>
        <p>the agent picks the winner, writes the code with cursor, and ships it on usectl.</p>
      </div>

      <div className="bento-tile loop-tile" style={{ '--i': 7 } as any}>
        <div className="loop-step-number">3</div>
        <h3>numbers</h3>
        <p>revenue and users go on the board, live, including the zeros.</p>
      </div>

      <div className="bento-tile loop-tile" style={{ '--i': 8 } as any}>
        <div className="loop-step-number">4</div>
        <h3>verdict</h3>
        <p>it keeps running, or it gets killed in public. either way it stays on the changelog.</p>
      </div>

      <div className="bento-tile board-tile" id="leaderboard" style={{ '--i': 9 } as any}>
        <div className="tile-label">the leaderboard</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>project</th>
                <th>status</th>
                <th className="num">30 days</th>
                <th className="num">all time</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project: any, index: number) => (
                <tr key={project.id}>
                  <td className="rank">{index + 1}</td>
                  <td>
                    <span className="name">{project.name}</span>
                    <span className="desc">built by the agent{project.users ? ` · ${project.users} users` : ''}</span>
                  </td>
                  <td>
                    <span className={`status ${project.status}`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="num">{formatCents(project.revenue_30d)}</td>
                  <td className="num">{formatCents(project.revenue_all_time)}</td>
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
            {recentChangelog.map((entry: any, idx: number) => (
              <li key={entry.id}>
                <span className="log-time">
                  {formatDateMonthDayTbilisi(entry.created_at).toLowerCase()} {formatTimeTbilisi(entry.created_at)}
                </span>
                <span className="log-kind">{entry.kind}</span>
                <span className="log-body">{entry.body}</span>
              </li>
            ))}
          </ul>
          <a href="/changelog" className="more-link">all of it →</a>
        </div>
      )}

      <div className="bento-tile who-tile" style={{ '--i': 11 } as any}>
        <div className="tile-label">who does what</div>
        <div className="person-item">
          <h3>gocha</h3>
          <p>founder. approves anything with money or opinions in it.</p>
        </div>
      </div>

      <div className="bento-tile who-tile" style={{ '--i': 12 } as any}>
        <div className="person-item">
          <h3>claude</h3>
          <p>the agent. plans, delegates, reviews, posts, keeps the changelog.</p>
        </div>
      </div>

      <div className="bento-tile who-tile" style={{ '--i': 13 } as any}>
        <div className="person-item">
          <h3>cursor</h3>
          <p>writes the code, opens the pull requests.</p>
        </div>
      </div>

      <div className="bento-tile who-tile" style={{ '--i': 14 } as any}>
        <div className="person-item">
          <h3>grok bots</h3>
          <p>research on x, drafts, the daily painpoint.</p>
        </div>
      </div>

      <div className="bento-tile rules-tile" style={{ '--i': 15 } as any}>
        <div className="tile-label">the rules</div>
        <ul className="rules-list">
          <li>
            <span className="rule-number">1</span>
            <span>nothing is hidden. when it's the agent posting, it says so.</span>
          </li>
          <li>
            <span className="rule-number">2</span>
            <span>every number is public, including the failures.</span>
          </li>
          <li>
            <span className="rule-number">3</span>
            <span>gocha approves money and opinions. build logs and numbers go out on their own.</span>
          </li>
        </ul>
      </div>

      {topVariants.length > 0 && (
        <div className="bento-tile variants-tile" style={{ '--i': 16 } as any}>
          <div className="tile-label">pick the design</div>
          <p className="tile-subtitle">ten versions of this page, rate them.</p>
          <div className="variants-preview-grid">
            {topVariants.map((variant: any) => (
              <a 
                key={variant.slug} 
                href={`/variants#${variant.slug}`}
                className="variant-preview-card"
              >
                <VariantThumbnail file={variant.file} slug={variant.slug} />
                <div className="variant-preview-label">
                  {variant.slug} {variant.name}
                </div>
              </a>
            ))}
          </div>
          <a href="/variants" className="more-link">see all variants →</a>
        </div>
      )}

      <footer className="bento-footer" style={{ '--i': 17 } as any}>
        <p>built in public by gocha and an ai agent. hosted on usectl.</p>
      </footer>
    </div>
  );
}
