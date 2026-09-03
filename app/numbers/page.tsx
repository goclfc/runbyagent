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
  let analytics = {
    views_today: 0,
    views_total: 0,
    uniques_today: 0,
    uniques_total: 0,
    online: 0,
  };
  let xMetrics = {
    followers: 0,
    followers_7d_delta: 0,
  };
  let attribution = {
    sources_7d: [] as any[],
    sources_30d: [] as any[],
    top_referrers: [] as any[],
    top_campaigns: [] as any[],
    funnel: {
      total_visitors: 0,
      events_count: 0,
      conversion_rate: 0,
    },
    links: [] as any[],
  };
  let revenue30d: any[] = [];
  let views30d: any[] = [];
  let uniques30d: any[] = [];
  let xImpressions7d: any[] = [];
  let xImpressions30d: any[] = [];
  let topXPosts: any[] = [];

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
        SUM(views)::INTEGER as count
      FROM hits
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    uniques30d = await query(`
      SELECT 
        day,
        COUNT(DISTINCT visitor_id)::INTEGER as count
      FROM visitor_days
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    // X metrics
    const xFollowersResult = await query(`
      SELECT 
        followers,
        followers - LAG(followers, 7) OVER (ORDER BY day DESC) as followers_7d_delta
      FROM x_daily
      WHERE followers IS NOT NULL
      ORDER BY day DESC
      LIMIT 1
    `);
    
    if (xFollowersResult.length > 0) {
      xMetrics = {
        followers: xFollowersResult[0].followers || 0,
        followers_7d_delta: xFollowersResult[0].followers_7d_delta || 0,
      };
    }

    xImpressions7d = await query(`
      SELECT 
        day,
        COALESCE(impressions, 0)::INTEGER as impressions
      FROM x_daily
      WHERE day >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY day ASC
    `);

    xImpressions30d = await query(`
      SELECT 
        day,
        COALESCE(impressions, 0)::INTEGER as impressions
      FROM x_daily
      WHERE day >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY day ASC
    `);

    topXPosts = await query(`
      SELECT 
        url,
        text,
        impressions,
        likes,
        replies,
        reposts,
        bookmarks
      FROM x_posts
      WHERE impressions IS NOT NULL
      ORDER BY impressions DESC
      LIMIT 5
    `);

    // Attribution metrics
    const sources7d = await query(`
      SELECT 
        COALESCE(v.first_utm_source, h.referrer_host, 'direct') as source,
        COUNT(DISTINCT v.id) as visitors,
        SUM(h.views) as views
      FROM visitors v
      LEFT JOIN hits h ON h.day >= CURRENT_DATE - INTERVAL '7 days'
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY source
      ORDER BY visitors DESC
      LIMIT 10
    `);
    attribution.sources_7d = sources7d;

    const sources30d = await query(`
      SELECT 
        COALESCE(v.first_utm_source, h.referrer_host, 'direct') as source,
        COUNT(DISTINCT v.id) as visitors,
        SUM(h.views) as views
      FROM visitors v
      LEFT JOIN hits h ON h.day >= CURRENT_DATE - INTERVAL '30 days'
      WHERE v.first_seen >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY source
      ORDER BY visitors DESC
      LIMIT 10
    `);
    attribution.sources_30d = sources30d;

    const topReferrers = await query(`
      SELECT 
        first_referrer as referrer,
        COUNT(*) as count
      FROM visitors
      WHERE first_referrer IS NOT NULL 
        AND first_referrer != ''
        AND first_seen >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY first_referrer
      ORDER BY count DESC
      LIMIT 10
    `);
    attribution.top_referrers = topReferrers;

    const topCampaigns = await query(`
      SELECT 
        first_utm_campaign as campaign,
        COUNT(*) as visitors
      FROM visitors
      WHERE first_utm_campaign IS NOT NULL
        AND first_seen >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY first_utm_campaign
      ORDER BY visitors DESC
      LIMIT 10
    `);
    attribution.top_campaigns = topCampaigns;

    // Funnel
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

    // Links
    const links = await query(`
      SELECT slug, target, clicks
      FROM links
      ORDER BY clicks DESC
      LIMIT 20
    `);
    attribution.links = links;
  } catch (error) {
    console.error('Error loading numbers:', error);
  }

  const maxRevenue = Math.max(...revenue30d.map(d => d.cents), 1);
  const maxViews = Math.max(...views30d.map(d => d.count), 1);
  const maxUniques = Math.max(...uniques30d.map(d => d.count), 1);
  const maxXImpressions7d = Math.max(...xImpressions7d.map(d => d.impressions), 1);
  const maxXImpressions30d = Math.max(...xImpressions30d.map(d => d.impressions), 1);

  return (
    <>
      <div className="hero">
        <h1>numbers</h1>
        <p className="subtitle">
          totals and trends, all in one place.
        </p>
      </div>

      <div className="section">
        <h2 className="section-title">business</h2>
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
      </div>

      <div className="section">
        <h2 className="section-title">traffic</h2>
        <div className="totals">
          <div className="metric">
            <div className="metric-label">online now</div>
            <div className="metric-value">{analytics.online}</div>
          </div>
          <div className="metric">
            <div className="metric-label">views today</div>
            <div className="metric-value">{analytics.views_today}</div>
          </div>
          <div className="metric">
            <div className="metric-label">views total</div>
            <div className="metric-value">{analytics.views_total}</div>
          </div>
          <div className="metric">
            <div className="metric-label">visitors today</div>
            <div className="metric-value">{analytics.uniques_today}</div>
          </div>
          <div className="metric">
            <div className="metric-label">visitors total</div>
            <div className="metric-value">{analytics.uniques_total}</div>
          </div>
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
        <h2 className="section-title">unique visitors (last 30 days)</h2>
        {uniques30d.length > 0 ? (
          <div className="chart">
            {uniques30d.map((day: any) => (
              <div
                key={day.day}
                className="chart-bar"
                style={{ height: `${(day.count / maxUniques) * 100}%` }}
                title={`${day.day}: ${day.count} visitors`}
              />
            ))}
          </div>
        ) : (
          <p className="note">no visitor data yet</p>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">where visitors come from</h2>
        
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          last 7 days
        </h3>
        {attribution.sources_7d.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>source</th>
                  <th>visitors</th>
                  <th>views</th>
                </tr>
              </thead>
              <tbody>
                {attribution.sources_7d.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>{row.source || 'unknown'}</td>
                    <td>{row.visitors || 0}</td>
                    <td>{row.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">no data yet</p>
        )}

        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
          last 30 days
        </h3>
        {attribution.sources_30d.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>source</th>
                  <th>visitors</th>
                  <th>views</th>
                </tr>
              </thead>
              <tbody>
                {attribution.sources_30d.map((row: any, i: number) => (
                  <tr key={i}>
                    <td>{row.source || 'unknown'}</td>
                    <td>{row.visitors || 0}</td>
                    <td>{row.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">no data yet</p>
        )}

        {attribution.top_referrers.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              top referrers (30d)
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>referrer</th>
                    <th>count</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.top_referrers.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ wordBreak: 'break-all' }}>{row.referrer}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {attribution.top_campaigns.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              top campaigns (30d)
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>campaign</th>
                    <th>visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.top_campaigns.map((row: any, i: number) => (
                    <tr key={i}>
                      <td>{row.campaign}</td>
                      <td>{row.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
          funnel (30d)
        </h3>
        <div className="totals">
          <div className="metric">
            <div className="metric-label">visitors</div>
            <div className="metric-value">{attribution.funnel.total_visitors}</div>
          </div>
          <div className="metric">
            <div className="metric-label">engaged (events)</div>
            <div className="metric-value">{attribution.funnel.events_count}</div>
          </div>
          <div className="metric">
            <div className="metric-label">conversion rate</div>
            <div className="metric-value">{attribution.funnel.conversion_rate}%</div>
          </div>
        </div>

        {attribution.links.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              tracked links
            </h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>slug</th>
                    <th>target</th>
                    <th>clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.links.map((link: any) => (
                    <tr key={link.slug}>
                      <td>/go/{link.slug}</td>
                      <td style={{ wordBreak: 'break-all' }}>{link.target}</td>
                      <td>{link.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">on x</h2>
        <div className="totals">
          <div className="metric">
            <div className="metric-label">followers</div>
            <div className="metric-value">
              {xMetrics.followers > 0 ? xMetrics.followers : '-'}
              {xMetrics.followers_7d_delta !== 0 && (
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>
                  {xMetrics.followers_7d_delta > 0 ? '+' : ''}{xMetrics.followers_7d_delta}
                </span>
              )}
            </div>
          </div>
        </div>

        {xImpressions7d.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              impressions (last 7 days)
            </h3>
            <div className="chart">
              {xImpressions7d.map((day: any) => (
                <div
                  key={day.day}
                  className="chart-bar"
                  style={{ height: `${(day.impressions / maxXImpressions7d) * 100}%` }}
                  title={`${day.day}: ${day.impressions} impressions`}
                />
              ))}
            </div>
          </>
        )}

        {xImpressions30d.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              impressions (last 30 days)
            </h3>
            <div className="chart">
              {xImpressions30d.map((day: any) => (
                <div
                  key={day.day}
                  className="chart-bar"
                  style={{ height: `${(day.impressions / maxXImpressions30d) * 100}%` }}
                  title={`${day.day}: ${day.impressions} impressions`}
                />
              ))}
            </div>
          </>
        )}

        {topXPosts.length > 0 && (
          <>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
              top posts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {topXPosts.map((post: any) => (
                <div key={post.url} className="card">
                  <p style={{ marginBottom: 'var(--space-3)', color: 'var(--color-text)' }}>
                    {post.text || '(no text)'}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                    <span>{post.impressions?.toLocaleString() || 0} impressions</span>
                    <span>{post.likes?.toLocaleString() || 0} likes</span>
                    <span>{post.replies || 0} replies</span>
                    <span>{post.reposts || 0} reposts</span>
                    {post.bookmarks > 0 && <span>{post.bookmarks} bookmarks</span>}
                    <a href={post.url} target="_blank" rel="noopener noreferrer">view →</a>
                  </div>
                </div>
              ))}
            </div>
          </>
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
