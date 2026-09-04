import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_CONNECTIONS = 200;
let activeConnections = 0;

export async function GET(request: NextRequest) {
  if (activeConnections >= MAX_CONNECTIONS) {
    return new Response('Service unavailable', { status: 503 });
  }

  activeConnections++;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get initial snapshot
        const metricsResult = await query(`
          SELECT 
            COALESCE(SUM(CASE WHEN day = CURRENT_DATE THEN views ELSE 0 END), 0)::int as views_today,
            COALESCE(SUM(views), 0)::int as views_total,
            COALESCE(SUM(CASE WHEN day = CURRENT_DATE THEN uniques ELSE 0 END), 0)::int as uniques_today
          FROM hits
        `);

        const onlineResult = await query(`
          SELECT COUNT(DISTINCT visitor_id)::int as online
          FROM presence
          WHERE last_seen > NOW() - INTERVAL '5 minutes'
        `);

        const logHeadResult = await query(`
          SELECT COALESCE(MAX(id), 0)::int as max_id FROM log_entries
        `);

        const libraryHeadResult = await query(`
          SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) as max_updated
          FROM research_docs
          WHERE published = true
        `);

        const metrics = {
          views_today: metricsResult[0]?.views_today || 0,
          views_total: metricsResult[0]?.views_total || 0,
          uniques_today: metricsResult[0]?.uniques_today || 0,
          online: onlineResult[0]?.online || 0,
        };

        const snapshot = {
          metrics,
          log_head: logHeadResult[0]?.max_id || 0,
          library_head: libraryHeadResult[0]?.max_updated || new Date(0).toISOString(),
        };

        // Send hello event
        controller.enqueue(encoder.encode(`event: hello\ndata: ${JSON.stringify(snapshot)}\n\n`));

        let lastLogId = snapshot.log_head;
        let lastLibraryHead = snapshot.library_head;
        let lastMetrics = metrics;

        // Poll for updates every 3 seconds
        const interval = setInterval(async () => {
          try {
            // Check for new log entries
            const newLogs = await query(`
              SELECT 
                le.id,
                le.body,
                le.kind,
                le.x_url,
                le.created_at,
                le.author,
                p.slug as project_slug,
                p.name as project_name
              FROM log_entries le
              LEFT JOIN projects p ON le.project_id = p.id
              WHERE le.id > $1
              ORDER BY le.created_at ASC
            `, [lastLogId]);

            if (newLogs.length > 0) {
              controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify(newLogs)}\n\n`));
              lastLogId = newLogs[newLogs.length - 1].id;
            }

            // Check for metrics changes
            const currentMetricsResult = await query(`
              SELECT 
                COALESCE(SUM(CASE WHEN day = CURRENT_DATE THEN views ELSE 0 END), 0)::int as views_today,
                COALESCE(SUM(views), 0)::int as views_total,
                COALESCE(SUM(CASE WHEN day = CURRENT_DATE THEN uniques ELSE 0 END), 0)::int as uniques_today
              FROM hits
            `);

            const currentOnlineResult = await query(`
              SELECT COUNT(DISTINCT visitor_id)::int as online
              FROM presence
              WHERE last_seen > NOW() - INTERVAL '5 minutes'
            `);

            const currentMetrics = {
              views_today: currentMetricsResult[0]?.views_today || 0,
              views_total: currentMetricsResult[0]?.views_total || 0,
              uniques_today: currentMetricsResult[0]?.uniques_today || 0,
              online: currentOnlineResult[0]?.online || 0,
            };

            if (JSON.stringify(currentMetrics) !== JSON.stringify(lastMetrics)) {
              controller.enqueue(encoder.encode(`event: metrics\ndata: ${JSON.stringify(currentMetrics)}\n\n`));
              lastMetrics = currentMetrics;
            }

            // Check for new library docs
            const newLibrary = await query(`
              SELECT 
                id,
                slug,
                kind,
                name,
                summary,
                author,
                (SELECT COUNT(*) FROM jsonb_array_elements(sources)) as sources_count,
                updated_at,
                verified_at,
                views
              FROM research_docs
              WHERE published = true AND updated_at > $1
              ORDER BY updated_at ASC
            `, [lastLibraryHead]);

            if (newLibrary.length > 0) {
              controller.enqueue(encoder.encode(`event: library\ndata: ${JSON.stringify(newLibrary)}\n\n`));
              lastLibraryHead = newLibrary[newLibrary.length - 1].updated_at;
            }
          } catch (error) {
            console.error('Error polling for updates:', error);
          }
        }, 3000);

        // Send ping every 20 seconds
        const pingInterval = setInterval(() => {
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, 20000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(interval);
          clearInterval(pingInterval);
          activeConnections--;
          controller.close();
        });
      } catch (error) {
        console.error('Error in SSE stream:', error);
        activeConnections--;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
      'connection': 'keep-alive',
    },
  });
}
