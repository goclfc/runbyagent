import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify admin key
    const authHeader = req.headers.get('authorization');
    const adminKey = process.env.ADMIN_KEY;
    
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { posts } = body;
    
    if (!Array.isArray(posts)) {
      return NextResponse.json({ error: 'posts must be an array' }, { status: 400 });
    }
    
    // Upsert each post
    for (const post of posts) {
      const { url, posted_at, text, impressions, likes, replies, reposts, bookmarks } = post;
      
      if (!url) {
        continue; // Skip posts without URL
      }
      
      await query(
        `INSERT INTO x_posts (url, posted_at, text, impressions, likes, replies, reposts, bookmarks, fetched_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (url)
         DO UPDATE SET
           posted_at = COALESCE($2, x_posts.posted_at),
           text = COALESCE($3, x_posts.text),
           impressions = COALESCE($4, x_posts.impressions),
           likes = COALESCE($5, x_posts.likes),
           replies = COALESCE($6, x_posts.replies),
           reposts = COALESCE($7, x_posts.reposts),
           bookmarks = COALESCE($8, x_posts.bookmarks),
           fetched_at = NOW()`,
        [url, posted_at, text, impressions, likes, replies, reposts, bookmarks]
      );
    }
    
    return NextResponse.json({ ok: true, count: posts.length });
  } catch (error) {
    console.error('Error upserting X posts:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
