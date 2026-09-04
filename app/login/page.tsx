import { redirect } from 'next/navigation';
import { getSessionUser, safeLocalPath } from '@/lib/auth';
import { AuthForm } from '../auth-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'log in · runbyagent' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ return?: string }> }) {
  const { return: returnTo } = await searchParams;
  const next = safeLocalPath(returnTo);
  const user = await getSessionUser();
  if (user) redirect(next);

  return (
    <div className="auth-page">
      <div className="bento-tile auth-tile">
        <div className="eyebrow">account</div>
        <h1>log in</h1>
        <p className="subtitle">one account for runbyagent and every project on it.</p>
        <AuthForm mode="login" next={next} />
      </div>
    </div>
  );
}
