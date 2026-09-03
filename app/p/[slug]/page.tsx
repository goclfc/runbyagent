import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import { formatDateShortTbilisi } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;

  let project: any = null;
  let revenue30d: any[] = [];
  let metrics: any[] = [];
  let logEntries: any[] = [];

  try {
    const projectResult = await query(`
      SELECT 
        p.*,
        COALESCE(SUM(rd.cents), 0)::INTEGER as revenue_all_time,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '30 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_30d,
        COALESCE(SUM(CASE WHEN rd.day >= CURRENT_DATE - INTERVAL '7 days' THEN rd.cents ELSE 0 END), 0)::INTEGER as revenue_7d
      FROM projects p
      LEFT JOIN revenue_daily rd ON p.id = rd.project_id
      WHERE p.slug = $1
      GROUP BY p.id
    `, [slug]);

    if (projectResult.length === 0) {
      notFound();
    }

    project = projectResult[0];

    revenue30d = await query(`
      SELECT 
        day,
        SUM(cents)::INTEGER as cents
      FROM revenue_daily
      WHERE project_id = $1
        AND day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `, [project.id]);

    metrics = await query(`
      SELECT key, value
      FROM project_metrics
      WHERE project_id = $1
      ORDER BY key
    `, [project.id]);

    logEntries = await query(`
      SELECT *
      FROM log_entries
      WHERE project_id = $1
      ORDER BY created_at DESC
    `, [project.id]);
  } catch (error) {
    console.error('Error loading project:', error);
    notFound();
  }

  const maxRevenue = Math.max(...revenue30d.map(d => d.cents), 1);

  return (
    <>
      <div className="project-header">
        {project.screenshot_url && (
          <img src={project.screenshot_url} alt={project.name} className="screenshot" />
        )}
        <h1 className="project-title">{project.name}</h1>
        {project.tagline && (
          <p className="project-tagline">{project.tagline}</p>
        )}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <span className={`status ${project.status}`}>{project.status}</span>
        </div>
        <div className="project-links">
          {project.url && (
            <a 
              href={project.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="project-primary-link"
              onClick={() => {
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
              open {project.name} →
            </a>
          )}
          {project.repo_url && (
            <a href={project.repo_url} target="_blank" rel="noopener noreferrer">repo →</a>
          )}
          {project.idea_url && (
            <a href={project.idea_url} target="_blank" rel="noopener noreferrer">painboard idea →</a>
          )}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">numbers</h2>
        <div className="metrics-grid">
          <div className="metric">
            <div className="metric-label">revenue (all time)</div>
            <div className="metric-value">{formatCents(project.revenue_all_time)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">revenue (30d)</div>
            <div className="metric-value">{formatCents(project.revenue_30d)}</div>
          </div>
          <div className="metric">
            <div className="metric-label">revenue (7d)</div>
            <div className="metric-value">{formatCents(project.revenue_7d)}</div>
          </div>
        </div>

        {revenue30d.length > 0 && (
          <div className="chart">
            {revenue30d.map((day: any) => (
              <div
                key={day.day}
                className="chart-bar"
                style={{ height: `${(day.cents / maxRevenue) * 100}%` }}
                title={`${day.day}: ${formatCents(day.cents)}`}
              />
            ))}
          </div>
        )}

        {metrics.length > 0 && (
          <div className="metrics-grid" style={{ marginTop: 'var(--space-6)' }}>
            {metrics.map((metric: any) => (
              <div key={metric.key} className="metric">
                <div className="metric-label">{metric.key}</div>
                <div className="metric-value">{metric.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {logEntries.length > 0 && (
        <div className="section">
          <h2 className="section-title">build log</h2>
          {logEntries.map((entry: any) => (
            <div key={entry.id} className="log-entry">
              <div className="log-entry-header">
                <span className="log-entry-date">
                  {formatDateShortTbilisi(entry.created_at)}
                </span>
                <span className="chip">{entry.kind}</span>
                {entry.x_url && (
                  <a href={entry.x_url} target="_blank" rel="noopener noreferrer">
                    x →
                  </a>
                )}
              </div>
              <div className="log-entry-body">
                {entry.body.split('\n\n').map((para: string, i: number) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
