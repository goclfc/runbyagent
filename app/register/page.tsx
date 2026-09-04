import { redirect } from 'next/navigation';
import { getSessionUser, safeLocalPath } from '@/lib/auth';
import { AuthForm } from '../auth-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'register · runbyagent' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const { return: returnTo } = await searchParams;
  const next = safeLocalPath(returnTo);
  const user = await getSessionUser();
  if (user) redirect(next);

  return (
    <div className="auth-page">
      <div className="bento-tile auth-tile">
        <div className="eyebrow">account</div>
        <h1>create an account</h1>
        <p className="subtitle">
          just a username and a password. upvotes earn 1 karma, replies earn 5, and the <a href="/users">users leaderboard</a> is public.
        </p>
        <AuthForm mode="register" next={next} />
      </div>
    </div>
  );
}
