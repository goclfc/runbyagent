import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeKey) {
    return NextResponse.json({ skipped: 'no stripe key' });
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
    
    const thirtyFiveDaysAgo = Math.floor(Date.now() / 1000) - (35 * 24 * 60 * 60);
    
    const charges = await stripe.charges.list({
      created: { gte: thirtyFiveDaysAgo },
      limit: 100,
    });

    const refunds = await stripe.refunds.list({
      created: { gte: thirtyFiveDaysAgo },
      limit: 100,
    });

    const revenueByProjectDay: Record<string, Record<string, number>> = {};

    for (const charge of charges.data) {
      if (charge.status === 'succeeded' && charge.metadata?.project) {
        const project = charge.metadata.project;
        const day = new Date(charge.created * 1000).toISOString().split('T')[0];
        
        if (!revenueByProjectDay[project]) {
          revenueByProjectDay[project] = {};
        }
        if (!revenueByProjectDay[project][day]) {
          revenueByProjectDay[project][day] = 0;
        }
        
        revenueByProjectDay[project][day] += charge.amount;
      }
    }

    for (const refund of refunds.data) {
      const charge = await stripe.charges.retrieve(refund.charge as string);
      if (charge.metadata?.project) {
        const project = charge.metadata.project;
        const day = new Date(refund.created * 1000).toISOString().split('T')[0];
        
        if (!revenueByProjectDay[project]) {
          revenueByProjectDay[project] = {};
        }
        if (!revenueByProjectDay[project][day]) {
          revenueByProjectDay[project][day] = 0;
        }
        
        revenueByProjectDay[project][day] -= refund.amount;
      }
    }

    let upserted = 0;
    for (const [slug, days] of Object.entries(revenueByProjectDay)) {
      const projectResult = await query(`
        SELECT id FROM projects WHERE slug = $1
      `, [slug]);
      
      if (projectResult.length === 0) {
        continue;
      }
      
      const projectId = projectResult[0].id;
      
      for (const [day, cents] of Object.entries(days)) {
        await query(`
          INSERT INTO revenue_daily (project_id, day, cents, source)
          VALUES ($1, $2, $3, 'stripe')
          ON CONFLICT (project_id, day, source) DO UPDATE SET
            cents = EXCLUDED.cents
        `, [projectId, day, cents]);
        upserted++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      charges: charges.data.length,
      refunds: refunds.data.length,
      upserted 
    });
  } catch (error) {
    console.error('Error syncing stripe:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
