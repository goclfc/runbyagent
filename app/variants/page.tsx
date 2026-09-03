import { query } from '@/lib/db';
import VariantsGrid from './variants-grid';
import { getVisitorId } from '@/lib/visitor';

export const dynamic = 'force-dynamic';

interface Variant {
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

interface VariantWithUserData extends Variant {
  user_stars?: number;
  user_picked?: boolean;
}

export default async function VariantsPage() {
  let variants: VariantWithUserData[] = [];
  const visitorId = await getVisitorId();

  try {
    const minVotes = 5;
    const meanResult = await query<{ global_mean: number }>(`
      SELECT COALESCE(AVG(stars)::NUMERIC, 3.0) as global_mean
      FROM variant_ratings
    `);
    const globalMean = Number(meanResult[0]?.global_mean || 3.0);

    // Get variants with stats
    const baseVariants = await query<Variant>(`
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

    // Add user-specific data if visitor ID exists
    if (visitorId) {
      const userRatings = await query<{ variant_id: number; stars: number }>(
        'SELECT variant_id, stars FROM variant_ratings WHERE visitor_id = $1',
        [visitorId]
      );
      const userPick = await query<{ variant_id: number }>(
        'SELECT variant_id FROM variant_picks WHERE visitor_id = $1',
        [visitorId]
      );

      const ratingsMap = new Map(userRatings.map(r => [r.variant_id, r.stars]));
      const pickedId = userPick[0]?.variant_id;

      variants = baseVariants.map(v => ({
        ...v,
        user_stars: ratingsMap.get(v.id),
        user_picked: v.id === pickedId,
      }));
    } else {
      variants = baseVariants;
    }
  } catch (error) {
    console.error('Error loading variants:', error);
  }

  return (
    <>
      <div className="section">
        <h1>variants gallery</h1>
        <p className="subtitle">
          ten versions of this page, same words, different worlds. rate them, pick one, tell us why. the winner becomes the landing.
        </p>
      </div>
      <VariantsGrid variants={variants} />
    </>
  );
}
