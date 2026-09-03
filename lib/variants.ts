import { query } from './db';

export interface Variant {
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

export async function getRankedVariants(): Promise<Variant[]> {
  const minVotes = 5;
  
  const meanResult = await query<{ global_mean: number }>(`
    SELECT COALESCE(AVG(stars)::float, 3.0) as global_mean
    FROM variant_ratings
    WHERE trusted = TRUE
  `);
  const globalMean = Number(meanResult[0]?.global_mean || 3.0);

  const variants = await query<Variant>(`
    SELECT 
      v.id,
      v.slug,
      v.name,
      v.description,
      v.file,
      AVG(CASE WHEN vr.trusted THEN vr.stars ELSE NULL END)::float as avg_stars,
      COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END)::int as rating_count,
      COUNT(DISTINCT vp.visitor_id)::int as pick_count,
      COUNT(DISTINCT vc.id)::int as comment_count,
      CASE 
        WHEN COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END) >= ${minVotes} THEN
          (COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END)::float / (COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END) + ${minVotes})) * COALESCE(AVG(CASE WHEN vr.trusted THEN vr.stars ELSE NULL END), ${globalMean}) +
          (${minVotes}::float / (COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END) + ${minVotes})) * ${globalMean}
        ELSE 0
      END::float as bayesian_score,
      CASE WHEN COUNT(DISTINCT CASE WHEN vr.trusted THEN vr.visitor_id ELSE NULL END) < ${minVotes} THEN TRUE ELSE FALSE END as is_new
    FROM variants v
    LEFT JOIN variant_ratings vr ON v.id = vr.variant_id
    LEFT JOIN variant_picks vp ON v.id = vp.variant_id
    LEFT JOIN variant_comments vc ON v.id = vc.variant_id
    GROUP BY v.id, v.slug, v.name, v.description, v.file
    ORDER BY bayesian_score DESC, pick_count DESC, v.slug ASC
  `);

  return variants;
}
