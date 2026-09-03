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

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      <div className="stat-tile">
        <div className="stat-label">projects</div>
        <div className="stat-value">{stats.projects_total}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">live</div>
        <div className="stat-value">{stats.projects_live}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">revenue</div>
        <div className="stat-value">{formatCents(stats.revenue_all_time)}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">online now</div>
        <div className="stat-value">
          <span className="pulse-dot">●</span> {stats.online}
        </div>
      </div>
    </>
  );
}
