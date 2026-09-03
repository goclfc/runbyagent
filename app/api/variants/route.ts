import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface VariantWithStats {
  id: number;
  slug: string;
  name: string;
  description: string;
  file: string;
  avg_stars: number | null;
  rating_count: number;
  pick_count: number;
  comment_count: number;
  bayesian_score: number;
  is_new: boolean;
}

export async function GET() {
  try {
    // Calculate global mean rating
    const meanResult = await query<{ global_mean: number }>(`
      SELECT COALESCE(AVG(stars)::NUMERIC, 3.0) as global_mean
      FROM variant_ratings
    `);
    const globalMean = Number(meanResult[0]?.global_mean || 3.0);
    const minVotes = 5;

    // Get variants with stats
    const variants = await query<VariantWithStats>(`
      SELECT 
        v.id,
        v.slug,
        v.name,
        v.description,
        v.file,
        AVG(vr.stars)::NUMERIC as avg_stars,
        COUNT(DISTINCT vr.visitor_id)::INTEGER as rating_count,
        COUNT(DISTINCT vp.visitor_id)::INTEGER as pick_count,
        COUNT(DISTINCT vc.id)::INTEGER as comment_count,
        CASE 
          WHEN COUNT(DISTINCT vr.visitor_id) >= ${minVotes} THEN
            (COUNT(DISTINCT vr.visitor_id)::NUMERIC / (COUNT(DISTINCT vr.visitor_id) + ${minVotes})) * COALESCE(AVG(vr.stars), ${globalMean}) +
            (${minVotes}::NUMERIC / (COUNT(DISTINCT vr.visitor_id) + ${minVotes})) * ${globalMean}
          ELSE 0
        END as bayesian_score,
        CASE WHEN COUNT(DISTINCT vr.visitor_id) < ${minVotes} THEN TRUE ELSE FALSE END as is_new
      FROM variants v
      LEFT JOIN variant_ratings vr ON v.id = vr.variant_id
      LEFT JOIN variant_picks vp ON v.id = vp.variant_id
      LEFT JOIN variant_comments vc ON v.id = vc.variant_id
      GROUP BY v.id, v.slug, v.name, v.description, v.file
      ORDER BY bayesian_score DESC, pick_count DESC, v.slug ASC
    `);

    return NextResponse.json(variants);
  } catch (error) {
    console.error('Error fetching variants:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
