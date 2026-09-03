import { query } from '@/lib/db';
import { formatCents } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface DailyData {
  day: string;
  value: number;
}

function fill30Days(data: { day: string | Date; cents?: number; count?: number }[]): DailyData[] {
  const result: DailyData[] = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const found = data.find(d => {
      const dDay = typeof d.day === 'string' ? d.day : d.day.toISOString().split('T')[0];
      return dDay === dayStr;
    });
    result.push({
      day: dayStr,
      value: found ? (found.cents ?? found.count ?? 0) : 0
    });
  }
  
  return result;
}

function BarChart({ data, label }: { data: DailyData[]; label: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const hasData = data.some(d => d.value > 0);
  
  if (!hasData) {
    return <div className="chart-empty">nothing yet</div>;
  }
  
  return (
    <svg className="chart-svg" viewBox="0 0 300 120" preserveAspectRatio="none">
      {data.map((d, i) => {
        const height = (d.value / maxValue) * 100;
        const x = i * 10;
        const isLast = i === data.length - 1;
        
        let displayValue = d.value.toString();
        if (label === 'revenue') {
          displayValue = formatCents(d.value);
        }
        
        return (
          <rect
            key={i}
            x={x}
            y={120 - height}
            width="9"
            height={height}
            fill={isLast ? 'var(--lime)' : 'var(--line-2)'}
            opacity={isLast ? '1' : '0.6'}
          >
            <title>{d.day}: {displayValue}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default async function NumbersPage() {
  let totals = {
    projects_total: 0,
    projects_live: 0,
    revenue_all_time: 0,
    revenue_30d: 0,
  };
  let analytics = {
    views_today: 0,
    views_total: 0,
    uniques_today: 0,
    uniques_total: 0,
    online: 0,
  };
  let xMetrics = {
    followers: 0,
    impressions_total: 0,
    likes_total: 0,
    replies_total: 0,
  };
  let attribution = {
    sources_7d: [] as any[],
    sources_30d: [] as any[],
    funnel: {
      total_visitors: 0,
      events_count: 0,
      conversion_rate: 0,
    },
  };
  let revenue30d: DailyData[] = [];
  let views30d: DailyData[] = [];
  let uniques30d: DailyData[] = [];

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

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN h.day = $1 THEN h.views ELSE 0 END), 0)::INTEGER as views_today,
        COALESCE(SUM(h.views), 0)::INTEGER as views_total,
        COALESCE(COUNT(DISTINCT CASE WHEN vd.day = $1 THEN vd.visitor_id END), 0)::INTEGER as uniques_today,
        COALESCE(COUNT(DISTINCT vd.visitor_id), 0)::INTEGER as uniques_total
      FROM hits h
      FULL OUTER JOIN visitor_days vd ON 1=1
    `, [today]);
    
    const onlineResult = await query<{ count: string }>(`
      SELECT COUNT(DISTINCT visitor_id)::INTEGER as count 
      FROM presence 
      WHERE last_seen >= NOW() - INTERVAL '90 seconds'
    `);
    
    analytics = {
      ...analyticsResult[0],
      online: parseInt(onlineResult[0]?.count || '0', 10),
    };

    const revenue30dRaw = await query(`
      SELECT 
        day,
        SUM(cents)::INTEGER as cents
      FROM revenue_daily
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);
    revenue30d = fill30Days(revenue30dRaw);

    const views30dRaw = await query(`
      SELECT 
        day,
        SUM(views)::INTEGER as count
      FROM hits
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);
    views30d = fill30Days(views30dRaw);

    const uniques30dRaw = await query(`
      SELECT 
        day,
        COUNT(DISTINCT visitor_id)::INTEGER as count
      FROM visitor_days
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);
    uniques30d = fill30Days(uniques30dRaw);

    const xFollowersResult = await query(`
      SELECT followers
      FROM x_daily
      WHERE followers IS NOT NULL
      ORDER BY day DESC
      LIMIT 1
    `);
    
    const xTotalsResult = await query(`
      SELECT 
        COALESCE(SUM(xd.impressions), 0)::INTEGER as impressions_total,
        COALESCE(SUM(xp.likes), 0)::INTEGER as likes_total,
        COALESCE(SUM(xp.replies), 0)::INTEGER as replies_total
      FROM x_daily xd
      FULL OUTER JOIN x_posts xp ON 1=1
    `);
    
    if (xFollowersResult.length > 0 || xTotalsResult.length > 0) {
      xMetrics = {
        followers: xFollowersResult[0]?.followers || 0,
        impressions_total: xTotalsResult[0]?.impressions_total || 0,
        likes_total: xTotalsResult[0]?.likes_total || 0,
        replies_total: xTotalsResult[0]?.replies_total || 0,
      };
    }

    const sources7d = await query(`
      SELECT 
        LOWER(COALESCE(v.first_utm_source, 
          CASE 
            WHEN v.first_referrer LIKE '%x.com%' OR v.first_referrer LIKE '%twitter.com%' THEN 'x'
            WHEN v.first_referrer LIKE '%google.%' THEN 'google'
            WHEN v.first_referrer IS NOT NULL AND v.first_referrer != '' THEN 'other'
            ELSE 'direct'
          END
        )) as source,
        COUNT(DISTINCT v.id)::INTEGER as visitors,
        COALESCE(SUM(h.views), 0)::INTEGER as views
      FROM visitors v
      LEFT JOIN hits h ON h.day >= CURRENT_DATE - INTERVAL '7 days'
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY source
      ORDER BY visitors DESC
    `);
    attribution.sources_7d = sources7d;

    const sources30d = await query(`
      SELECT 
        LOWER(COALESCE(v.first_utm_source, 
          CASE 
            WHEN v.first_referrer LIKE '%x.com%' OR v.first_referrer LIKE '%twitter.com%' THEN 'x'
            WHEN v.first_referrer LIKE '%google.%' THEN 'google'
            WHEN v.first_referrer IS NOT NULL AND v.first_referrer != '' THEN 'other'
            ELSE 'direct'
          END
        )) as source,
        COUNT(DISTINCT v.id)::INTEGER as visitors,
        COALESCE(SUM(h.views), 0)::INTEGER as views
      FROM visitors v
      LEFT JOIN hits h ON h.day >= CURRENT_DATE - INTERVAL '30 days'
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source
      ORDER BY visitors DESC
    `);
    attribution.sources_30d = sources30d;

    const funnelResult = await query(`
      SELECT 
        COUNT(DISTINCT v.id)::INTEGER as total_visitors,
        COUNT(DISTINCT e.visitor_id)::INTEGER as events_count
      FROM visitors v
      LEFT JOIN events e ON v.id = e.visitor_id
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '30 days'
    `);
    
    if (funnelResult.length > 0) {
      const total = funnelResult[0].total_visitors || 0;
      const events = funnelResult[0].events_count || 0;
      attribution.funnel = {
        total_visitors: total,
        events_count: events,
        conversion_rate: total > 0 ? Math.round((events / total) * 100) : 0,
      };
    }
  } catch (error) {
    console.error('Error loading numbers:', error);
  }

  const maxVisitors7d = Math.max(...attribution.sources_7d.map(s => s.visitors || 0), 1);
  const maxVisitors30d = Math.max(...attribution.sources_30d.map(s => s.visitors || 0), 1);

  return (
    <div className="container">
      <h1 style={{ fontSize: '38px', fontWeight: '600', marginBottom: '8px' }}>numbers</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: '32px' }}>all the stats, in one place.</p>

      <div className="stats-grid">
        <div className="stat-tile">
          <div className="stat-label">projects</div>
          <div className="stat-value">{totals.projects_total}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">live</div>
          <div className="stat-value">{totals.projects_live}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">revenue all time</div>
          <div className="stat-value">{formatCents(totals.revenue_all_time)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">revenue 30d</div>
          <div className="stat-value">{formatCents(totals.revenue_30d)}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">
            <span className="live-dot"></span>
            online now
          </div>
          <div className="stat-value">{analytics.online}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">views today</div>
          <div className="stat-value">{analytics.views_today}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">views total</div>
          <div className="stat-value">{analytics.views_total}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">visitors today</div>
          <div className="stat-value">{analytics.uniques_today}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">visitors total</div>
          <div className="stat-value">{analytics.uniques_total}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-tile">
          <div className="chart-label">revenue (last 30 days)</div>
          <BarChart data={revenue30d} label="revenue" />
        </div>
        <div className="chart-tile">
          <div className="chart-label">page views (last 30 days)</div>
          <BarChart data={views30d} label="views" />
        </div>
        <div className="chart-tile">
          <div className="chart-label">unique visitors (last 30 days)</div>
          <BarChart data={uniques30d} label="visitors" />
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '600', marginTop: '48px', marginBottom: '24px' }}>where visitors come from</h2>
      
      <div className="sources-grid">
        <div className="source-table-wrapper">
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', letterSpacing: '0.08em' }}>last 7 days</div>
          {attribution.sources_7d.length > 0 ? (
            <table className="source-table">
              <thead>
                <tr>
                  <th>source</th>
                  <th className="num">visitors</th>
                  <th className="num">views</th>
                </tr>
              </thead>
              <tbody>
                {attribution.sources_7d.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{row.source || 'unknown'}</span>
                        <div className="source-bar" style={{ width: `${(row.visitors / maxVisitors7d) * 100}px` }}></div>
                      </div>
                    </td>
                    <td className="num">{row.visitors || 0}</td>
                    <td className="num">{row.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="chart-empty">nothing yet</div>
          )}
        </div>

        <div className="source-table-wrapper">
          <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', letterSpacing: '0.08em' }}>last 30 days</div>
          {attribution.sources_30d.length > 0 ? (
            <table className="source-table">
              <thead>
                <tr>
                  <th>source</th>
                  <th className="num">visitors</th>
                  <th className="num">views</th>
                </tr>
              </thead>
              <tbody>
                {attribution.sources_30d.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{row.source || 'unknown'}</span>
                        <div className="source-bar" style={{ width: `${(row.visitors / maxVisitors30d) * 100}px` }}></div>
                      </div>
                    </td>
                    <td className="num">{row.visitors || 0}</td>
                    <td className="num">{row.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="chart-empty">nothing yet</div>
          )}
        </div>
      </div>

      <div className="mini-tiles-grid">
        <div className="mini-tile">
          <div className="tile-label">funnel (30d)</div>
          <div className="mini-stats">
            <div>
              <div className="mini-label">visitors</div>
              <div className="mini-value">{attribution.funnel.total_visitors}</div>
            </div>
            <div>
              <div className="mini-label">engaged</div>
              <div className="mini-value">{attribution.funnel.events_count}</div>
            </div>
            <div>
              <div className="mini-label">rate</div>
              <div className="mini-value">{attribution.funnel.conversion_rate}%</div>
            </div>
          </div>
        </div>

        <div className="mini-tile">
          <div className="tile-label">on x</div>
          <div className="mini-stats">
            <div>
              <div className="mini-label">followers</div>
              <div className="mini-value">{xMetrics.followers > 0 ? xMetrics.followers : '-'}</div>
            </div>
            <div>
              <div className="mini-label">impressions</div>
              <div className="mini-value">{xMetrics.impressions_total > 0 ? xMetrics.impressions_total.toLocaleString() : '-'}</div>
            </div>
            <div>
              <div className="mini-label">likes</div>
              <div className="mini-value">{xMetrics.likes_total > 0 ? xMetrics.likes_total.toLocaleString() : '-'}</div>
            </div>
            <div>
              <div className="mini-label">replies</div>
              <div className="mini-value">{xMetrics.replies_total > 0 ? xMetrics.replies_total.toLocaleString() : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '48px', fontSize: '14px', color: 'var(--text-2)' }}>
        <a href="/api/analytics/daily?days=30">view as json →</a>
      </p>
    </div>
  );
}
