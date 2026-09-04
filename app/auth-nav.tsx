import { getSessionUser } from '@/lib/auth';

/** header slot: "log in" or "username · karma · log out". server component, reads the session cookie. */
export async function AuthNav() {
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <a href="/login" className="auth-link">log in</a>
    );
  }

  return (
    <span className="auth-user">
      <a href={`/u/${user.username}`} className="auth-name">{user.username}</a>
      <span className="auth-karma">{user.karma} karma</span>
      <form action="/api/auth/logout" method="post" className="auth-logout">
        <button type="submit">log out</button>
      </form>
    </span>
  );
}
