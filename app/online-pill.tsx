'use client';

import { useEffect, useState } from 'react';

export function OnlinePill() {
  const [online, setOnline] = useState<number | null>(null);
  const [viewsToday, setViewsToday] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [presenceRes, metricsRes] = await Promise.all([
          fetch('/api/presence'),
          fetch('/api/metrics'),
        ]);
        
        const presenceData = await presenceRes.json();
        const metricsData = await metricsRes.json();
        
        setOnline(presenceData.online || 0);
        setViewsToday(metricsData.views_today || 0);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (online === null || viewsToday === null) {
    return null;
  }

  return (
    <div className="online-pill">
      <span className="online-dot">●</span>
      <span>{online} online · {viewsToday.toLocaleString()} views today</span>
    </div>
  );
}
