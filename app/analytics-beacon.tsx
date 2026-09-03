'use client';

import { useEffect, useRef } from 'react';

export function AnalyticsBeacon() {
  const lastHitRef = useRef<Record<string, number>>({});
  const lastPresenceRef = useRef<number>(0);
  const visibilityCheckRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    
    // Send page view on mount (dedupe handled server-side)
    const sendHit = () => {
      const now = Date.now();
      const key = path;
      const lastHit = lastHitRef.current[key] || 0;
      
      // Client-side dedupe: 30 minutes
      if (now - lastHit < 30 * 60 * 1000) {
        return;
      }
      
      lastHitRef.current[key] = now;
      
      const data = JSON.stringify({ path });
      
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/hit', data);
      } else {
        fetch('/api/hit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        }).catch(() => {});
      }
    };
    
    sendHit();
    
    // Send presence heartbeat every 30s when tab is visible
    const sendPresence = () => {
      if (document.hidden) {
        return;
      }
      
      const now = Date.now();
      if (now - lastPresenceRef.current < 25 * 1000) {
        return;
      }
      
      lastPresenceRef.current = now;
      
      const data = JSON.stringify({});
      
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presence', data);
      } else {
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true,
        }).catch(() => {});
      }
    };
    
    // Send initial presence
    sendPresence();
    
    // Set up visibility-aware interval
    const startPresenceInterval = () => {
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current);
      }
      visibilityCheckRef.current = setInterval(sendPresence, 30 * 1000);
    };
    
    startPresenceInterval();
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        sendPresence();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current);
      }
    };
  }, []);

  return null;
}
