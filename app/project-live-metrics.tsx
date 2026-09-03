'use client';

import { useEffect, useState } from 'react';

interface LiveMetrics {
  online: number | null;
  views_today: number | null;
  views_total: number | null;
}

export function ProjectLiveMetrics({ slug }: { slug: string }) {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    online: null,
    views_today: null,
    views_total: null,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/live`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [slug]);

  return (
    <>
      <td className="num project-live">{metrics.online !== null ? metrics.online : '-'}</td>
      <td className="num project-live">{metrics.views_today !== null ? metrics.views_today : '-'}</td>
    </>
  );
}

export function ProjectLiveStats({ slug }: { slug: string }) {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    online: null,
    views_today: null,
    views_total: null,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(`/api/projects/${slug}/live`);
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        // Silent fail
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [slug]);

  return (
    <>
      <div className="stat-tile">
        <div className="stat-label">
          <span className="live-dot"></span>
          online now
        </div>
        <div className="stat-value">{metrics.online !== null ? metrics.online : '-'}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">views today</div>
        <div className="stat-value">{metrics.views_today !== null ? metrics.views_today : '-'}</div>
      </div>
      <div className="stat-tile">
        <div className="stat-label">views total</div>
        <div className="stat-value">{metrics.views_total !== null ? metrics.views_total : '-'}</div>
      </div>
    </>
  );
}
