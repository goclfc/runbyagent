import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const projects = await query<{ id: number; slug: string; metrics_url: string }>(`
      SELECT id, slug, metrics_url
      FROM projects
      WHERE metrics_url IS NOT NULL
    `);

    let fetched = 0;
    let failed = 0;

    for (const project of projects) {
      try {
        const response = await fetch(project.metrics_url, {
          headers: { 'User-Agent': 'runbyagent/1.0' }
        });
        
        if (!response.ok) {
          failed++;
          continue;
        }
        
        const data = await response.json();
        
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') {
            await query(`
              INSERT INTO project_metrics (project_id, key, value, fetched_at)
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (project_id, key) DO UPDATE SET
                value = EXCLUDED.value,
                fetched_at = EXCLUDED.fetched_at
            `, [project.id, key, value]);
          }
        }
        
        // Record page views if views_total is present
        if (typeof data.views_total === 'number') {
          const today = new Date().toISOString().split('T')[0];
          await query(`
            INSERT INTO hits (day, path, count)
            VALUES ($1, $2, $3)
            ON CONFLICT (day, path) DO UPDATE SET
              count = EXCLUDED.count
          `, [today, `/p/${project.slug}`, data.views_total]);
        }
        
        fetched++;
      } catch (error) {
        console.error(`Error fetching metrics for ${project.slug}:`, error);
        failed++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      projects: projects.length,
      fetched,
      failed
    });
  } catch (error) {
    console.error('Error syncing metrics:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
