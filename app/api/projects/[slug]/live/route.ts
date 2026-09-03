import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { slug } = await context.params;

  try {
    // Check cache first
    const cached = cache.get(slug);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Get project's metrics_url
    const projects = await query<{ metrics_url: string | null }>(`
      SELECT metrics_url
      FROM projects
      WHERE slug = $1
    `, [slug]);

    if (projects.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const project = projects[0];
    
    if (!project.metrics_url) {
      const result = { online: null, views_today: null, views_total: null };
      cache.set(slug, { data: result, timestamp: now });
      return NextResponse.json(result);
    }

    // Fetch from metrics_url with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(project.metrics_url, {
        headers: { 'User-Agent': 'runbyagent/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const result = { online: null, views_today: null, views_total: null };
        cache.set(slug, { data: result, timestamp: now });
        return NextResponse.json(result);
      }

      const data = await response.json();
      
      const result = {
        online: typeof data.online === 'number' ? data.online : null,
        views_today: typeof data.views_today === 'number' ? data.views_today : null,
        views_total: typeof data.views_total === 'number' ? data.views_total : null,
      };

      cache.set(slug, { data: result, timestamp: now });
      return NextResponse.json(result);
    } catch (error) {
      clearTimeout(timeout);
      
      // Return nulls on fetch error
      const result = { online: null, views_today: null, views_total: null };
      cache.set(slug, { data: result, timestamp: now });
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error fetching live metrics:', error);
    return NextResponse.json(
      { online: null, views_today: null, views_total: null },
      { status: 500 }
    );
  }
}
