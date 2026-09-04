'use client';

import { useState } from 'react';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const destination = safeNext(next || null);
  const otherHref = `${mode === 'login' ? '/register' : '/login'}${next ? `?return=${encodeURIComponent(next)}` : ''}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'something went wrong');
        setBusy(false);
        return;
      }
      window.location.href = destination;
    } catch {
      setError('something went wrong');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="auth-form">
      <label>
        <span>username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3 to 20 letters, digits or underscores"
          required
          autoFocus
        />
      </label>
      <label>
        <span>password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          maxLength={200}
          required
        />
      </label>
      {mode === 'register' && <p className="auth-hint">3 to 20 letters, digits or underscores. password at least 8 characters.</p>}
      {error && <p className="auth-error">{error}</p>}
      <div className="auth-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '...' : mode === 'login' ? 'log in' : 'create account'}
        </button>
        <a href={otherHref} className="auth-switch">
          {mode === 'login' ? 'no account yet? register' : 'already have one? log in'}
        </a>
      </div>
    </form>
  );
}
