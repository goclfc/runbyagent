import { createHash, createHmac } from 'crypto';
import { query } from './db';
import { NextRequest } from 'next/server';

const HASH_SALT = process.env.HASH_SALT || process.env.ADMIN_KEY || 'default-salt-change-in-production';

function getDailySalt(): string {
  const today = new Date().toISOString().split('T')[0];
  return `${HASH_SALT}-${today}`;
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + getDailySalt())
    .digest('hex');
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  return realIp || null;
}

export function createDwellTimeToken(): { token: string; timestamp: number } {
  const timestamp = Date.now();
  const hmac = createHmac('sha256', HASH_SALT)
    .update(timestamp.toString())
    .digest('hex')
    .substring(0, 16);
  return { token: `${timestamp}.${hmac}`, timestamp };
}

export function verifyDwellTimeToken(token: string, minSeconds: number = 3): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [timestampStr, providedHmac] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;
  
  const expectedHmac = createHmac('sha256', HASH_SALT)
    .update(timestampStr)
    .digest('hex')
    .substring(0, 16);
  
  if (expectedHmac !== providedHmac) return false;
  
  const elapsed = (Date.now() - timestamp) / 1000;
  return elapsed >= minSeconds && elapsed < 3600; // max 1 hour old
}

interface RateLimit {
  key: string;
  maxCount: number;
  windowMinutes: number;
}

export async function checkRateLimit(limits: RateLimit[]): Promise<boolean> {
  const now = new Date();
  
  for (const limit of limits) {
    const windowStart = new Date(now.getTime() - limit.windowMinutes * 60 * 1000);
    
    // Clean up old windows
    await query(
      'DELETE FROM rate_limits WHERE key = $1 AND window_start < $2',
      [limit.key, windowStart]
    );
    
    // Get current count
    const result = await query<{ total: number }>(
      `SELECT COALESCE(SUM(count), 0)::int as total 
       FROM rate_limits 
       WHERE key = $1 AND window_start >= $2`,
      [limit.key, windowStart]
    );
    
    const currentCount = result[0]?.total || 0;
    if (currentCount >= limit.maxCount) {
      return false;
    }
  }
  
  return true;
}

export async function incrementRateLimit(key: string): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  
  await query(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start)
     DO UPDATE SET count = rate_limits.count + 1`,
    [key, windowStart]
  );
}

export async function getTopAbuseIps(hours: number = 24, limit: number = 100): Promise<Array<{ ip_hash: string; writes: number }>> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const result = await query<{ ip_hash: string; writes: number }>(
    `SELECT 
       SUBSTRING(key FROM 'ip:(.+):(visitor|rating|pick|comment)') as ip_hash,
       SUM(count)::int as writes
     FROM rate_limits
     WHERE window_start >= $1 
       AND key LIKE 'ip:%'
     GROUP BY ip_hash
     ORDER BY writes DESC
     LIMIT $2`,
    [since, limit]
  );
  
  return result;
}
