import { NextRequest } from 'next/server';

/** admin routes take `Authorization: Bearer <ADMIN_KEY>`. */
export function isAdmin(request: NextRequest): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return false;
  return request.headers.get('authorization') === `Bearer ${expected}`;
}

/** cron routes take `Authorization: Bearer <CRON_SECRET>`; the admin key works too so gocha can trigger them by hand. */
export function isCron(request: NextRequest): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  const cron = process.env.CRON_SECRET;
  const admin = process.env.ADMIN_KEY;
  return Boolean((cron && header === `Bearer ${cron}`) || (admin && header === `Bearer ${admin}`));
}
