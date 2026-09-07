// v0.9 projects front: per-project counting through rba.js, the card numbers in the api,
// the admin edit route and the landing. run against a running instance:
// BASE=http://localhost:3000 ADMIN_KEY=... node --test tests/projects.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key';
const ADMIN = { Authorization: `Bearer ${ADMIN_KEY}` };
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36';

const stamp = Date.now().toString(36);
const slug = `card-test-${stamp}`;
const vid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

async function beacon(path, body, { ua = BROWSER_UA, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    // sendBeacon posts text/plain with no preflight; the route must accept exactly that
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': ua, Origin: 'https://painboard.usectl.com' },
    body: raw ?? JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

async function json(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

async function projectRow() {
  const { res, data } = await json('/api/projects');
  assert.strictEqual(res.status, 200);
  const row = data.find((p) => p.slug === slug);
  assert.ok(row, 'test project is listed');
  return row;
}

test('admin creates a project with a tagline and screenshot', async () => {
  const { res, data } = await json('/api/admin/project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...ADMIN },
    body: JSON.stringify({
      slug,
      name: `Card Test ${stamp}`,
      tagline: 'A throwaway project that exists to be counted.',
      url: 'https://example.com',
      status: 'live',
      launched_at: '2026-09-07T12:00:00Z',
      screenshot_url: '/projects/example.png',
    }),
  });
  assert.strictEqual(res.status, 200, JSON.stringify(data));
  assert.strictEqual(data.tagline, 'A throwaway project that exists to be counted.');
});

test('GET /api/projects carries the card fields, starting at zero', async () => {
  const row = await projectRow();
  for (const key of ['tagline', 'screenshot_url', 'online', 'views_total', 'visitors_total', 'returning_total', 'views_7d', 'log_url', 'revenue_all_time', 'revenue_30d', 'launched_at']) {
    assert.ok(key in row, `has ${key}`);
  }
  assert.strictEqual(row.online, 0);
  assert.strictEqual(row.views_total, 0);
  assert.strictEqual(row.visitors_total, 0);
  assert.strictEqual(row.returning_total, 0);
  assert.strictEqual(row.log_url, `/changelog?project=${slug}`);
  assert.strictEqual(row.screenshot_url, '/projects/example.png');
});

test('rba.js is served with cors and a cache header', async () => {
  const res = await fetch(`${BASE}/rba.js`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
  assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('cache-control') || '', /max-age=3600/);
  const body = await res.text();
  assert.match(body, /\/api\/track\b/);
  assert.match(body, /\/api\/track\/ping/);
  assert.match(body, /rba_vid/);
  assert.match(body, /30000/);
});

test('OPTIONS preflight on the beacon routes answers with cors', async () => {
  for (const path of ['/api/track', '/api/track/ping']) {
    const res = await fetch(`${BASE}${path}`, { method: 'OPTIONS', headers: { Origin: 'https://threadbus.usectl.com' } });
    assert.strictEqual(res.status, 204, path);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
  }
});

const alice = vid();
const bob = vid();

test('page views and pings count: views, visitors, online', async () => {
  let r = await beacon('/api/track', { project: slug, vid: alice, path: '/', ref: 'https://x.com/' });
  assert.strictEqual(r.res.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.res.headers.get('access-control-allow-origin'), '*');
  r = await beacon('/api/track', { project: slug, vid: alice, path: '/pricing' });
  assert.strictEqual(r.res.status, 200);
  r = await beacon('/api/track', { project: slug, vid: bob, path: '/' });
  assert.strictEqual(r.res.status, 200);
  r = await beacon('/api/track/ping', { project: slug, vid: bob });
  assert.strictEqual(r.res.status, 200);

  const row = await projectRow();
  assert.strictEqual(row.views_total, 3);
  assert.strictEqual(row.views_7d, 3);
  assert.strictEqual(row.visitors_total, 2);
  assert.strictEqual(row.online, 2);
  assert.strictEqual(row.returning_total, 0, 'one day seen is not returning');
});

test('a bot user agent is dropped without an error', async () => {
  const r = await beacon('/api/track', { project: slug, vid: vid(), path: '/' }, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  assert.strictEqual(r.res.status, 200);
  assert.strictEqual(r.data.skipped, 'bot');
  const row = await projectRow();
  assert.strictEqual(row.visitors_total, 2);
});

test('bad beacons: unknown project, bad vid, oversized body, broken json', async () => {
  let r = await beacon('/api/track', { project: `nope-${stamp}`, vid: vid(), path: '/' });
  assert.strictEqual(r.res.status, 404);
  r = await beacon('/api/track', { project: slug, vid: 'x', path: '/' });
  assert.strictEqual(r.res.status, 400);
  r = await beacon('/api/track', null, { raw: JSON.stringify({ project: slug, vid: vid(), path: 'x'.repeat(1100) }) });
  assert.strictEqual(r.res.status, 413);
  r = await beacon('/api/track/ping', null, { raw: '{not json' });
  assert.strictEqual(r.res.status, 400);
  r = await beacon('/api/track/ping', { project: slug });
  assert.strictEqual(r.res.status, 400);
});

test('60 beacons a minute per vid, then 429', async () => {
  const noisy = vid();
  let last;
  for (let i = 0; i < 61; i++) {
    last = await beacon('/api/track/ping', { project: slug, vid: noisy });
    if (i < 60) assert.strictEqual(last.res.status, 200, `beacon ${i}`);
  }
  assert.strictEqual(last.res.status, 429);
  const row = await projectRow();
  assert.strictEqual(row.online, 3, 'the noisy vid still counts once');
});

test('GET /api/metrics has returning_total and the per-project rows', async () => {
  const { res, data } = await json('/api/metrics');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(typeof data.returning_total, 'number');
  assert.strictEqual(typeof data.online, 'number');
  assert.ok(Array.isArray(data.projects));
  const row = data.projects.find((p) => p.slug === slug);
  assert.ok(row);
  assert.strictEqual(row.views_total, 3);
  assert.strictEqual(row.visitors_total, 2);
  assert.strictEqual(row.online, 3);
  assert.strictEqual(row.tagline, 'A throwaway project that exists to be counted.');
  for (const key of ['returning_total', 'views_7d', 'revenue_all_time', 'revenue_30d', 'log_url', 'status', 'launched_at']) {
    assert.ok(key in row, `metrics project row has ${key}`);
  }
});

test('the platform itself counts as project 0 through /api/hit', async () => {
  const before = (await json('/api/metrics')).data;
  const res = await fetch(`${BASE}/api/hit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
    body: JSON.stringify({ path: `/from-test-${stamp}` }),
  });
  assert.strictEqual(res.status, 200);
  const after = (await json('/api/metrics')).data;
  assert.ok(after.online >= before.online, 'a fresh visitor is online now');
  assert.ok(after.online >= 1);
});

test('PATCH /api/admin/project/:slug edits tagline, screenshot, status; validates', async () => {
  let r = await json(`/api/admin/project/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagline: 'x' }) });
  assert.strictEqual(r.res.status, 401);

  r = await json(`/api/admin/project/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...ADMIN },
    body: JSON.stringify({ tagline: 'Counted, then killed.', screenshot_url: null, status: 'killed' }),
  });
  assert.strictEqual(r.res.status, 200, JSON.stringify(r.data));
  assert.strictEqual(r.data.tagline, 'Counted, then killed.');
  assert.strictEqual(r.data.screenshot_url, null);
  assert.strictEqual(r.data.status, 'killed');

  r = await json(`/api/admin/project/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...ADMIN }, body: JSON.stringify({ status: 'sleeping' }) });
  assert.strictEqual(r.res.status, 400);
  r = await json(`/api/admin/project/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...ADMIN }, body: JSON.stringify({ colour: 'lime' }) });
  assert.strictEqual(r.res.status, 400);
  r = await json(`/api/admin/project/nope-${stamp}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...ADMIN }, body: JSON.stringify({ tagline: 'x' }) });
  assert.strictEqual(r.res.status, 404);

  const row = await projectRow();
  assert.strictEqual(row.screenshot_url, null, 'no file in public/projects, so no fallback either');
  assert.strictEqual(row.status, 'killed');
});

test('the landing leads with the cards and the strip', async () => {
  const res = await fetch(`${BASE}/`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="home-projects"/);
  assert.match(html, new RegExp(`data-project-card="${slug}"`));
  assert.match(html, /Counted, then killed\./);
  assert.match(html, /data-project-metric="online">3</);
  assert.match(html, /data-project-metric="views_total">3</);
  assert.match(html, /data-project-metric="visitors_total">2</);
  assert.match(html, /data-project-metric="returning_total">0</);
  assert.match(html, /class="status killed"/);
  assert.match(html, new RegExp(`href="/changelog\\?project=${slug}"`));
  assert.match(html, /class="home-strip"/);
  assert.ok(html.indexOf('class="home-projects"') < html.indexOf('class="home-strip"'), 'cards come before the strip');
  assert.ok(html.indexOf('class="home-strip"') < html.indexOf('home-question'), 'the strip comes before the question');
  assert.doesNotMatch(html, /home-board/);
});

test('the project page shows the same numbers as the card, plus the embed tag', async () => {
  const res = await fetch(`${BASE}/p/${slug}`);
  assert.strictEqual(res.status, 200);
  const html = await res.text();
  assert.match(html, /online now/);
  assert.match(html, /returning/);
  assert.match(html, new RegExp(`data-project=&quot;${slug}&quot;`), 'the embed tag, html-escaped inside <pre>');
  assert.match(html, /rba\.js/);
});

test('the changelog filters by project', async () => {
  let res = await fetch(`${BASE}/changelog?project=${slug}`);
  assert.strictEqual(res.status, 200);
  let html = await res.text();
  assert.match(html, /changelog: Card Test/);
  assert.match(html, /nothing logged<!-- --> for Card Test/);
  res = await fetch(`${BASE}/changelog?project=<script>`);
  assert.strictEqual(res.status, 200);
  html = await res.text();
  assert.match(html, /<h1>changelog<\/h1>/, 'a bad slug falls back to the whole log');
});
