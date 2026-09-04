'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { formatDateMonthDayTbilisi, formatTimeTbilisi } from '@/lib/date-utils';

interface Metrics {
  views_today: number;
  views_total: number;
  uniques_today: number;
  online: number;
}

interface LogEntry {
  id: number;
  body: string;
  kind: string;
  x_url?: string;
  created_at: string;
  author: string;
  project_slug?: string;
  project_name?: string;
}

interface LibraryDoc {
  id: number;
  slug: string;
  kind: string;
  name: string;
  summary?: string;
  author: string;
  sources_count: number;
  updated_at: string;
  verified_at?: string;
  views: number;
}

export function LiveClient() {
  const pathname = usePathname();
  const [connected, setConnected] = useState<'connecting' | 'connected' | 'polling' | 'disconnected'>('disconnected');
  const [failCount, setFailCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLogIdRef = useRef<number>(0);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let backoff = 1000;

    const connect = () => {
      if (typeof EventSource === 'undefined') {
        startPolling();
        return;
      }

      setConnected('connecting');
      const es = new EventSource('/api/live');
      eventSourceRef.current = es;

      es.addEventListener('hello', (e) => {
        const data = JSON.parse(e.data);
        lastLogIdRef.current = data.log_head;
        updateMetrics(data.metrics);
        setConnected('connected');
        setFailCount(0);
        backoff = 1000;
      });

      es.addEventListener('metrics', (e) => {
        const metrics = JSON.parse(e.data);
        updateMetrics(metrics);
      });

      es.addEventListener('log', (e) => {
        const entries: LogEntry[] = JSON.parse(e.data);
        if (entries.length > 0) {
          lastLogIdRef.current = entries[entries.length - 1].id;
          prependLogEntries(entries);
        }
      });

      es.addEventListener('library', (e) => {
        const docs: LibraryDoc[] = JSON.parse(e.data);
        prependLibraryDocs(docs);
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setConnected('disconnected');
        
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);

        if (newFailCount >= 3) {
          startPolling();
          return;
        }

        backoff = Math.min(backoff * 2, 30000);
        reconnectTimeout = setTimeout(connect, backoff);
      };
    };

    const startPolling = () => {
      setConnected('polling');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/log?since=${lastLogIdRef.current}`);
          if (response.ok) {
            const entries: LogEntry[] = await response.json();
            if (entries.length > 0) {
              lastLogIdRef.current = entries[entries.length - 1].id;
              prependLogEntries(entries);
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 15000);
    };

    const updateMetrics = (metrics: Metrics) => {
      if (pathname === '/') {
        const statsEl = document.querySelector('.dashboard-stats');
        if (statsEl) {
          const viewsTodayEl = statsEl.querySelector('[data-metric="views-today"]');
          const viewsTotalEl = statsEl.querySelector('[data-metric="views-total"]');
          const uniquesTodayEl = statsEl.querySelector('[data-metric="uniques-today"]');
          const onlineEl = statsEl.querySelector('[data-metric="online"]');

          if (viewsTodayEl) viewsTodayEl.textContent = formatNumber(metrics.views_today);
          if (viewsTotalEl) viewsTotalEl.textContent = formatNumber(metrics.views_total);
          if (uniquesTodayEl) uniquesTodayEl.textContent = formatNumber(metrics.uniques_today);
          if (onlineEl) onlineEl.textContent = formatNumber(metrics.online);
        }
      }
    };

    const prependLogEntries = (entries: LogEntry[]) => {
      if (pathname === '/changelog') {
        const sectionsEl = document.querySelector('.section');
        if (sectionsEl) {
          entries.forEach((entry) => {
            const entryHtml = createLogEntryHtml(entry);
            const firstSection = sectionsEl.querySelector('div[style*="marginBottom"]');
            if (firstSection) {
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = entryHtml;
              const newEntry = tempDiv.firstElementChild;
              if (newEntry) {
                newEntry.classList.add('highlight-new');
                firstSection.insertBefore(newEntry, firstSection.firstChild);
                setTimeout(() => newEntry.classList.remove('highlight-new'), 400);
              }
            }
          });
        }
      } else if (pathname === '/') {
        const logListEl = document.querySelector('.log-list');
        if (logListEl) {
          const maxItems = 6;
          const currentItems = logListEl.querySelectorAll('li');
          
          entries.forEach((entry) => {
            const liHtml = createLogListItemHtml(entry);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = liHtml;
            const newLi = tempDiv.firstElementChild;
            if (newLi) {
              newLi.classList.add('highlight-new');
              logListEl.insertBefore(newLi, logListEl.firstChild);
              setTimeout(() => newLi.classList.remove('highlight-new'), 400);
            }
          });

          const allItems = logListEl.querySelectorAll('li');
          for (let i = maxItems; i < allItems.length; i++) {
            allItems[i].remove();
          }
        }
      }
    };

    const prependLibraryDocs = (docs: LibraryDoc[]) => {
      if (pathname === '/library') {
        const gridEl = document.querySelector('.library-grid');
        if (gridEl) {
          docs.forEach((doc) => {
            const docHtml = createLibraryCardHtml(doc);
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = docHtml;
            const newCard = tempDiv.firstElementChild;
            if (newCard) {
              newCard.classList.add('highlight-new');
              gridEl.insertBefore(newCard, gridEl.firstChild);
              setTimeout(() => newCard.classList.remove('highlight-new'), 400);
            }
          });
        }
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      clearTimeout(reconnectTimeout);
    };
  }, [pathname, failCount]);

  return (
    <>
      {connected !== 'disconnected' && (
        <div
          className="live-indicator"
          title={connected === 'connected' ? 'live' : 'polling'}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connected === 'connected' ? 'var(--accent)' : 'var(--text-2)',
            opacity: 0.6,
            zIndex: 1000,
          }}
        />
      )}
      <style jsx>{`
        @keyframes highlight {
          from {
            background-color: var(--accent-alpha);
          }
          to {
            background-color: transparent;
          }
        }
        :global(.highlight-new) {
          animation: highlight 400ms ease-out;
        }
      `}</style>
    </>
  );
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function createLogEntryHtml(entry: LogEntry): string {
  const time = formatTimeTbilisi(entry.created_at);
  const projectChip = entry.project_slug
    ? `<a href="/p/${entry.project_slug}" class="chip">${entry.project_name}</a>`
    : '';
  const xLink = entry.x_url
    ? `<a href="${entry.x_url}" target="_blank" rel="noopener noreferrer">x →</a>`
    : '';
  const body = entry.body
    .split('\n\n')
    .map((para) => `<p>${para}</p>`)
    .join('');

  return `
    <div class="log-entry" id="${entry.id}">
      <div class="log-entry-header">
        <span class="log-entry-date">${time}</span>
        <span class="chip">${entry.kind}</span>
        <span class="chip">${entry.author}</span>
        ${projectChip}
        ${xLink}
      </div>
      <div class="log-entry-body">${body}</div>
    </div>
  `;
}

function createLogListItemHtml(entry: LogEntry): string {
  const dateTime = `${formatDateMonthDayTbilisi(entry.created_at).toLowerCase()} ${formatTimeTbilisi(entry.created_at)}`;
  const bodyTruncated = entry.body.length > 80 ? entry.body.slice(0, 80) + '...' : entry.body;

  return `
    <li>
      <span class="log-time">${dateTime}</span>
      <span class="log-kind">${entry.kind}</span>
      <span class="log-body">${bodyTruncated}</span>
    </li>
  `;
}

function createLibraryCardHtml(doc: LibraryDoc): string {
  const summary = doc.summary ? `<p style="color: var(--text-2); margin-bottom: var(--space-2)">${doc.summary}</p>` : '';
  const verified = doc.verified_at ? `<span style="margin-left: var(--space-2)">verified</span>` : '';
  const sources = doc.sources_count > 0 ? `<span style="margin-left: var(--space-2)">${doc.sources_count} ${doc.sources_count === 1 ? 'source' : 'sources'}</span>` : '';

  return `
    <a href="/library/${doc.slug}" class="log-entry" style="display: block; text-decoration: none; border: 1px solid var(--border); padding: var(--space-4); border-radius: 4px">
      <div class="log-entry-header">
        <span class="chip">${doc.kind}</span>
        <span class="chip">${doc.author}</span>
      </div>
      <h2 class="section-title" style="margin-top: var(--space-2); margin-bottom: var(--space-2)">
        ${doc.name || 'Untitled'}
      </h2>
      ${summary}
      <div style="font-size: 13px; color: var(--text-2)">
        <span>updated</span>
        ${verified}
        ${sources}
      </div>
    </a>
  `;
}
