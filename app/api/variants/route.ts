import { NextResponse } from 'next/server';
import { getRankedVariants } from '@/lib/variants';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const variants = await getRankedVariants();
    return NextResponse.json(variants);
  } catch (error) {
    console.error('Error fetching variants:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
