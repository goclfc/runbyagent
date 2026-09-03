'use client';

import { useEffect, useState } from 'react';
import { formatCents } from '@/lib/format';

interface Stats {
  projects_total: number;
  projects_live: number;
  revenue_all_time: number;
  online: number;
  views_today: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    projects_total: 0,
    projects_live: 0,
    revenue_all_time: 0,
    online: 0,
    views_today: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [metricsRes, presenceRes] = await Promise.all([
          fetch('/api/metrics'),
          fetch('/api/presence')
        ]);
        
        if (metricsRes.ok && presenceRes.ok) {
          const metrics = await metricsRes.json();
          const presence = await presenceRes.json();
          
          setStats({
            projects_total: metrics.projects_total || 0,
            projects_live: metrics.projects_live || 0,
            revenue_all_time: metrics.revenue_all_time || 0,
            online: presence.online || 0,
            views_today: metrics.views_today || 0
          });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

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
        <div className="stat-label">
          <span className="live-dot pulsing"></span>
          online now
        </div>
        <div className="stat-value">{stats.online}</div>
      </div>
    </>
  );
}
