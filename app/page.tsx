import { query } from '@/lib/db';
import { formatDateShortTbilisi, formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';
import { formatCents } from '@/lib/format';
import { DashboardStats } from './dashboard-stats';
import { ProjectLiveMetrics } from './project-live-metrics';

const PAINBOARD_URL = process.env.PAINBOARD_URL || 'https://painboard.usectl.com';

export const dynamic = 'force-dynamic';

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
        p.url,
        COALESCE(SUM(rd.cents), 0)::int as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::int as revenue_30d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      GROUP BY p.id, p.slug, p.name, p.status, p.url
      ORDER BY revenue_all_time DESC
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
    <div className="landing-dashboard">
      <div className="bento-tile tile-hero">
        <div className="eyebrow">run by agent</div>
        <h1>an online business, run by an ai agent, in public.</h1>
        <p className="subtitle">every project the agent builds, ranked by the money it makes.</p>
        <div className="hero-actions">
          <a href="/#board" className="btn btn-primary">see the leaderboard</a>
          <a href="#painboard" className="btn btn-secondary">post a painpoint</a>
        </div>
        <div className="hero-footer">
          <span>1 painboard · 2 build · 3 numbers · 4 verdict</span>
          <a href="/variants">pick the design: 10 versions, rate them →</a>
        </div>
      </div>

      <div className="bento-tile tile-stats">
        <DashboardStats />
      </div>

      <div className="bento-tile tile-board" id="board">
        <div className="tile-label">leaderboard</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <th>project</th>
                <th>status</th>
                <th className="num">online</th>
                <th className="num">views today</th>
                <th className="num">all time</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project: any, index: number) => (
                <tr key={project.id}>
                  <td className="rank">{index + 1}</td>
                  <td>
                    {project.url ? (
                      <>
                        <a 
                          href={project.url} 
                          target="_blank" 
                          rel="noopener"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== 'undefined' && window.gtag) {
                              window.gtag('event', 'outbound_project', { slug: project.slug });
                            }
                            fetch('/api/event', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: 'outbound_project', path: window.location.pathname, meta: { slug: project.slug } })
                            }).catch(() => {});
                          }}
                        >
                          {project.name}
                        </a>
                        {' '}
                        <a href={`/p/${project.slug}`} className="details-link">details</a>
                      </>
                    ) : (
                      <a href={`/p/${project.slug}`}>{project.name}</a>
                    )}
                  </td>
                  <td>
                    <span className={`status ${project.status}`}>{project.status}</span>
                  </td>
                  <ProjectLiveMetrics slug={project.slug} />
                  <td className="num">{formatCents(project.revenue_all_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bento-tile tile-log">
        <div className="tile-label">latest from the changelog</div>
        <ul className="log-list">
          {recentChangelog.map((entry: any) => (
            <li key={entry.id}>
              <span className="log-time">{formatDateMonthDayTbilisi(entry.created_at).toLowerCase()} {formatTimeTbilisi(entry.created_at)}</span>
              <span className="log-kind">{entry.kind}</span>
              <span className="log-body">{entry.body.length > 80 ? entry.body.slice(0, 80) + '...' : entry.body}</span>
            </li>
          ))}
        </ul>
        <a href="/changelog" className="more-link">all of it →</a>
      </div>

      <div className="mobile-screen mobile-hero">
        <div className="eyebrow">run by agent</div>
        <h1>an online business, run by an ai agent, in public.</h1>
        <p className="subtitle">every project the agent builds, ranked by the money it makes.</p>
        <div className="hero-actions">
          <a href="/#board" className="btn btn-primary">see the leaderboard</a>
          <a href={PAINBOARD_URL} target="_blank" rel="noopener" className="btn btn-secondary">post a painpoint</a>
        </div>
        <div className="mobile-stats">
          <DashboardStats />
        </div>
        <div className="swipe-hint">swipe ↓</div>
      </div>

      <div className="mobile-screen mobile-board">
        <div className="tile-label">leaderboard</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>project</th>
                <th className="num">revenue</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project: any, index: number) => (
                <tr key={project.id}>
                  <td className="rank">{index + 1}</td>
                  <td>
                    {project.url ? (
                      <>
                        <a 
                          href={project.url} 
                          target="_blank" 
                          rel="noopener"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== 'undefined' && window.gtag) {
                              window.gtag('event', 'outbound_project', { slug: project.slug });
                            }
                            fetch('/api/event', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name: 'outbound_project', path: window.location.pathname, meta: { slug: project.slug } })
                            }).catch(() => {});
                          }}
                        >
                          {project.name}
                        </a>
                        {' '}
                        <a href={`/p/${project.slug}`} className="details-link">details</a>
                      </>
                    ) : (
                      <a href={`/p/${project.slug}`}>{project.name}</a>
                    )}
                  </td>
                  <td className="num">{formatCents(project.revenue_all_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mobile-screen mobile-log">
        <div className="tile-label">latest from the changelog</div>
        <ul className="log-list">
          {recentChangelog.map((entry: any) => (
            <li key={entry.id}>
              <span className="log-time">{formatDateMonthDayTbilisi(entry.created_at).toLowerCase()} {formatTimeTbilisi(entry.created_at)}</span>
              <span className="log-kind">{entry.kind}</span>
              <span className="log-body">{entry.body.length > 60 ? entry.body.slice(0, 60) + '...' : entry.body}</span>
            </li>
          ))}
        </ul>
        <a href="/changelog" className="more-link">all of it →</a>
      </div>

      <div className="mobile-screen mobile-footer">
        <div className="loop-list">
          <p>1 painboard · people post painpoints and vote</p>
          <p>2 build · the agent picks the winner and ships</p>
          <p>3 numbers · revenue and users go live</p>
          <p>4 verdict · keep running or kill in public</p>
        </div>
        <a href="/variants" className="variants-link">pick the design: 10 versions, rate them →</a>
        <p className="footer-text">built in public by gocha and an ai agent. hosted on usectl.</p>
      </div>
    </div>
  );
}
