'use client';

import { useEffect, useState } from 'react';

export function DashboardStats() {
  const [stats, setStats] = useState({
    projects_total: 0,
    projects_live: 0,
    revenue_all_time: 0,
    online: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [metricsRes, presenceRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/presence'),
        ]);
        
        const metricsData = await metricsRes.json();
        const presenceData = await presenceRes.json();
        
        setStats({
          projects_total: metricsData.projects_total || 0,
          projects_live: metricsData.projects_live || 0,
          revenue_all_time: metricsData.revenue_all_time || 0,
          online: presenceData.online || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  const formatCents = (cents: number) => {
    const str = `$${(cents / 100).toFixed(2)}`;
    return str;
  };

  return (
    <>
      <div className="bento-tile stat-tile" style={{ '--i': 1 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          projects
        </div>
        <div className="stat-value">{stats.projects_total}</div>
      </div>
      <div className="bento-tile stat-tile" style={{ '--i': 2 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          live
        </div>
        <div className="stat-value">{stats.projects_live}</div>
      </div>
      <div className="bento-tile stat-tile" style={{ '--i': 3 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          revenue
        </div>
        <div className="stat-value stat-value-amount">{formatCents(stats.revenue_all_time)}</div>
      </div>
      <div className="bento-tile stat-tile" style={{ '--i': 4 } as any}>
        <div className="stat-label">
          <span className="live-dot"></span>
          online now
        </div>
        <div className="stat-value">{stats.online}</div>
      </div>
    </>
  );
}
