'use client';

import { useEffect, useState } from 'react';
import { formatCents } from '@/lib/format';
import { PlatformTotals } from '@/lib/metrics';

type Stats = Pick<PlatformTotals, 'projects_total' | 'revenue_all_time' | 'views_total' | 'views_today' | 'uniques_total' | 'returning_total' | 'online'>;

function n(value: number): string {
  return value.toLocaleString('en-US');
}

/** the platform strip under the project cards. rendered with the server's numbers, then polls /api/metrics every 30 seconds. */
export function DashboardStats({ initial }: { initial: Stats }) {
  const [stats, setStats] = useState<Stats>(initial);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (!res.ok) return;
        const m = await res.json();
        setStats({
          projects_total: m.projects_total || 0,
          revenue_all_time: m.revenue_all_time || 0,
          views_total: m.views_total || 0,
          views_today: m.views_today || 0,
          uniques_total: m.uniques_total || 0,
          returning_total: m.returning_total || 0,
          online: m.online || 0,
        });
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
      <a href="/#board" className="stat-tile">
        <div className="stat-label">projects</div>
        <div className="stat-value">{stats.projects_total}</div>
      </a>

      <a href="/numbers" className="stat-tile">
        <div className="stat-label">revenue all time</div>
        <div className={`stat-value ${stats.revenue_all_time === 0 ? 'stat-value-zero' : ''}`}>{formatCents(stats.revenue_all_time)}</div>
      </a>

      <a href="/numbers" className="stat-tile">
        <div className="stat-label">views</div>
        <div className="stat-value">{n(stats.views_total)}</div>
        <div className="stat-sub">{n(stats.views_today)} today</div>
      </a>

      <a href="/numbers" className="stat-tile">
        <div className="stat-label">visitors</div>
        <div className="stat-value">{n(stats.uniques_total)}</div>
      </a>

      <a href="/numbers" className="stat-tile">
        <div className="stat-label">returning</div>
        <div className="stat-value">{n(stats.returning_total)}</div>
        <div className="stat-sub">seen on two or more days</div>
      </a>

      <a href="/numbers" className="stat-tile">
        <div className="stat-label">
          <span className="live-dot pulsing"></span>
          online now
        </div>
        <div className="stat-value">{n(stats.online)}</div>
      </a>
    </>
  );
}
