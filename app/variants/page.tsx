import { query } from '@/lib/db';
import VariantsGrid from './variants-grid';
import { getVisitorId } from '@/lib/visitor';
import { getRankedVariants, type Variant } from '@/lib/variants';
import { createDwellTimeToken } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface VariantWithUserData extends Variant {
  user_stars?: number;
  user_picked?: boolean;
}

export default async function VariantsPage() {
  let variants: VariantWithUserData[] = [];
  const visitorId = await getVisitorId();
  const dwellToken = createDwellTimeToken();

  try {
    const baseVariants = await getRankedVariants();

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
      <VariantsGrid variants={variants} dwellToken={dwellToken.token} />
    </>
  );
}
