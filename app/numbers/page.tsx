import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function NumbersPage() {
  let totals = {
    projects_total: 0,
    projects_live: 0,
    revenue_all_time: 0,
    revenue_30d: 0,
  };
  let revenue30d: any[] = [];
  let views30d: any[] = [];

  try {
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

    revenue30d = await query(`
      SELECT 
        day,
        SUM(cents)::INTEGER as cents
      FROM revenue_daily
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    views30d = await query(`
      SELECT 
        day,
        SUM(count)::INTEGER as count
      FROM hits
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);
  } catch (error) {
    console.error('Error loading numbers:', error);
  }

  const maxRevenue = Math.max(...revenue30d.map(d => d.cents), 1);
  const maxViews = Math.max(...views30d.map(d => d.count), 1);

  return (
    <>
      <div className="hero">
        <h1>numbers</h1>
        <p className="subtitle">
          totals and trends, all in one place.
        </p>
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

      <div className="section">
        <h2 className="section-title">revenue (last 30 days)</h2>
        {revenue30d.length > 0 ? (
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
        ) : (
          <p className="note">no revenue data yet</p>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">page views (last 30 days)</h2>
        {views30d.length > 0 ? (
          <div className="chart">
            {views30d.map((day: any) => (
              <div
                key={day.day}
                className="chart-bar"
                style={{ height: `${(day.count / maxViews) * 100}%` }}
                title={`${day.day}: ${day.count} views`}
              />
            ))}
          </div>
        ) : (
          <p className="note">no view data yet</p>
        )}
      </div>

      <div className="section">
        <p>
          <a href="/api/metrics">view as json →</a>
        </p>
      </div>
    </>
  );
}
