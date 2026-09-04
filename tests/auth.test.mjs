// accounts, karma and the users leaderboard. run against a running instance:
// BASE=http://localhost:3000 ADMIN_KEY=... AUTH_SECRET=... node --test tests/auth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key';
const AUTH_SECRET = process.env.AUTH_SECRET || ADMIN_KEY;
const HASH_SALT = process.env.HASH_SALT || ADMIN_KEY;

const stamp = Date.now().toString(36);

function jar() {
  let cookies = {};
  const header = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return {
    async call(path, { method = 'GET', body, headers = {}, redirect = 'follow' } = {}) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        redirect,
        headers: { 'Content-Type': 'application/json', cookie: header(), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const line of res.headers.getSetCookie?.() || []) {
        const [pair] = line.split(';');
        const [k, v] = pair.split('=');
        if (v === '') delete cookies[k];
        else cookies[k] = v;
      }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { res, data };
    },
    has(name) { return name in cookies; },
  };
}

function dwellToken() {
  const ts = Date.now() - 5000;
  const hmac = createHmac('sha256', HASH_SALT).update(ts.toString()).digest('hex').substring(0, 16);
  return `${ts}.${hmac}`;
}

function decodeToken(token) {
  const [body] = token.split('.');
  return JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
}

const alice = jar();
const username = `alice_${stamp}`;

test('register validates input', async () => {
  const bad = await jar().call('/api/auth/register', { method: 'POST', body: { username: 'a', password: 'longenough1' } });
  assert.strictEqual(bad.res.status, 400);
  const short = await jar().call('/api/auth/register', { method: 'POST', body: { username: `ok_${stamp}`, password: 'short' } });
  assert.strictEqual(short.res.status, 400);
});

test('register creates an account and logs in', async () => {
  const { res, data } = await alice.call('/api/auth/register', { method: 'POST', body: { username, password: 'correct horse battery' } });
  assert.strictEqual(res.status, 201, JSON.stringify(data));
  assert.strictEqual(data.user.username, username);
  assert.strictEqual(data.user.karma, 0);
  assert.ok(alice.has('rba_user'), 'session cookie set');

  const me = await alice.call('/api/auth/me');
  assert.strictEqual(me.data.user.username, username);
});

test('username is unique, case insensitive', async () => {
  const { res } = await jar().call('/api/auth/register', { method: 'POST', body: { username: username.toUpperCase(), password: 'another password' } });
  assert.strictEqual(res.status, 409);
});

test('login rejects a wrong password and accepts the right one', async () => {
  const wrong = await jar().call('/api/auth/login', { method: 'POST', body: { username, password: 'nope nope nope' } });
  assert.strictEqual(wrong.res.status, 401);

  const bob = jar();
  const right = await bob.call('/api/auth/login', { method: 'POST', body: { username: username.toUpperCase(), password: 'correct horse battery' } });
  assert.strictEqual(right.res.status, 200, JSON.stringify(right.data));
  assert.strictEqual(right.data.user.username, username);
  assert.strictEqual(right.data.user.password_hash, undefined, 'hash never leaves the server');
  assert.ok(bob.has('rba_user'));
});

test('a pick by a logged in user is worth 1 karma, once', async () => {
  const first = await alice.call('/api/variants/01/pick', { method: 'POST', body: {} });
  assert.strictEqual(first.res.status, 200, JSON.stringify(first.data));
  assert.strictEqual(first.data.karma, 1);
  const again = await alice.call('/api/variants/01/pick', { method: 'POST', body: {} });
  assert.strictEqual(again.data.karma, 1, 'same variant, no second point');
  const other = await alice.call('/api/variants/02/pick', { method: 'POST', body: {} });
  assert.strictEqual(other.data.karma, 2);
});

test('a comment by a logged in user is worth 5 karma and carries the username', async () => {
  const { res, data } = await alice.call('/api/variants/01/comments', {
    method: 'POST',
    body: { body: `karma test ${stamp}`, name: 'ignored', t0: dwellToken() },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(data));
  assert.strictEqual(data.karma, 7);

  const list = await alice.call('/api/variants/01/comments');
  const mine = list.data.find((c) => c.id === data.id);
  assert.strictEqual(mine.name, username);
});

test('anonymous picks and comments still work and earn nothing', async () => {
  const anon = jar();
  const pick = await anon.call('/api/variants/03/pick', { method: 'POST', body: {} });
  assert.strictEqual(pick.res.status, 200);
  assert.strictEqual(pick.data.karma, undefined);
});

test('karma api requires the shared secret and is idempotent', async () => {
  const denied = await jar().call('/api/karma', { method: 'POST', body: { username, app: 'painboard', kind: 'upvote', ref: 'idea:1' } });
  assert.strictEqual(denied.res.status, 401);

  const auth = { Authorization: `Bearer ${AUTH_SECRET}` };
  const first = await jar().call('/api/karma', { method: 'POST', headers: auth, body: { username, app: 'painboard', kind: 'reply', ref: `comment:${stamp}` } });
  assert.strictEqual(first.res.status, 200, JSON.stringify(first.data));
  assert.strictEqual(first.data.awarded, true);
  assert.strictEqual(first.data.karma, 12);

  const again = await jar().call('/api/karma', { method: 'POST', headers: auth, body: { username, app: 'painboard', kind: 'reply', ref: `comment:${stamp}` } });
  assert.strictEqual(again.data.awarded, false);
  assert.strictEqual(again.data.karma, 12);

  const badKind = await jar().call('/api/karma', { method: 'POST', headers: auth, body: { username, app: 'painboard', kind: 'bonus', ref: 'x' } });
  assert.strictEqual(badKind.res.status, 400);
  const noUser = await jar().call('/api/karma', { method: 'POST', headers: auth, body: { username: 'nobody_here', app: 'painboard', kind: 'upvote', ref: 'x' } });
  assert.strictEqual(noUser.res.status, 404);
});

test('leaderboard and profile are public', async () => {
  const board = await jar().call('/api/users/leaderboard');
  assert.strictEqual(board.res.status, 200);
  const row = board.data.users.find((u) => u.username === username);
  assert.ok(row, 'alice is on the board');
  assert.strictEqual(row.karma, 12);
  assert.strictEqual(row.upvotes, 2);
  assert.strictEqual(row.replies, 2);
  assert.ok(row.rank >= 1);

  const profile = await jar().call(`/api/users/${username}`);
  assert.strictEqual(profile.res.status, 200);
  assert.strictEqual(profile.data.user.karma, 12);
  assert.strictEqual(profile.data.events.length, 4);

  const missing = await jar().call('/api/users/nobody_here');
  assert.strictEqual(missing.res.status, 404);

  const page = await fetch(`${BASE}/users`);
  assert.strictEqual(page.status, 200);
  assert.ok((await page.text()).includes(username));
});

test('handoff sends a logged out visitor to login and a logged in one back with a token', async () => {
  const target = 'http://localhost:3100/auth/callback?next=%2Fideas';
  const out = await jar().call(`/api/auth/handoff?return=${encodeURIComponent(target)}`, { redirect: 'manual' });
  assert.strictEqual(out.res.status, 302);
  const loginUrl = new URL(out.res.headers.get('location'), BASE);
  assert.strictEqual(loginUrl.pathname, '/login');
  assert.ok(loginUrl.searchParams.get('return').startsWith('/api/auth/handoff?return='));

  const back = await alice.call(`/api/auth/handoff?return=${encodeURIComponent(target)}`, { redirect: 'manual' });
  assert.strictEqual(back.res.status, 302);
  const location = new URL(back.res.headers.get('location'));
  assert.strictEqual(location.origin, 'http://localhost:3100');
  assert.strictEqual(location.searchParams.get('next'), '/ideas');
  const token = location.searchParams.get('rba_token');
  assert.ok(token);
  const payload = decodeToken(token);
  assert.strictEqual(payload.t, 'handoff');
  assert.strictEqual(payload.u, username);
  assert.strictEqual(payload.aud, 'http://localhost:3100');
  assert.ok(payload.exp * 1000 > Date.now());

  const evil = await alice.call(`/api/auth/handoff?return=${encodeURIComponent('https://evil.example/steal')}`, { redirect: 'manual' });
  assert.strictEqual(evil.res.status, 400);
});

test('logout clears the session', async () => {
  const { res } = await alice.call('/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
  assert.strictEqual(res.status, 200);
  assert.ok(!alice.has('rba_user'));
  const me = await alice.call('/api/auth/me');
  assert.strictEqual(me.data.user, null);
});
