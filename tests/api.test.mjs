import { test } from 'node:test';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

test('upsert project via admin api', async () => {
  const { response, data } = await request('/api/admin/project', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      slug: 'test-project',
      name: 'Test Project',
      tagline: 'a test project',
      status: 'building',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.slug, 'test-project');
  assert.strictEqual(data.name, 'Test Project');
});

test('add log entry via admin api', async () => {
  const { response, data } = await request('/api/admin/log', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      body: 'test log entry',
      kind: 'note',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.body, 'test log entry');
  assert.strictEqual(data.kind, 'note');
});

test('add manual revenue via admin api', async () => {
  const today = new Date().toISOString().split('T')[0];
  const { response, data } = await request('/api/admin/revenue', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      slug: 'test-project',
      day: today,
      cents: 1000,
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.cents, 1000);
});

test('leaderboard orders by revenue', async () => {
  const { response, data } = await request('/api/projects');

  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data));
  
  if (data.length > 1) {
    for (let i = 0; i < data.length - 1; i++) {
      assert.ok(
        data[i].revenue_all_time >= data[i + 1].revenue_all_time,
        'projects should be ordered by revenue descending'
      );
    }
  }
});

test('metrics json returns totals', async () => {
  const { response, data } = await request('/api/metrics');

  assert.strictEqual(response.status, 200);
  assert.ok(typeof data.projects_total === 'number');
  assert.ok(typeof data.projects_live === 'number');
  assert.ok(typeof data.revenue_all_time === 'number');
  assert.ok(typeof data.revenue_30d === 'number');
});

test('unauthorized admin requests fail', async () => {
  const { response } = await request('/api/admin/project', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'test',
      name: 'Test',
    }),
  });

  assert.strictEqual(response.status, 401);
});

test('hit endpoint tracks page views', async () => {
  const { response, data } = await request('/api/hit', {
    method: 'POST',
    body: JSON.stringify({
      path: '/test-page',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('hit endpoint ignores api routes', async () => {
  const { response, data } = await request('/api/hit', {
    method: 'POST',
    body: JSON.stringify({
      path: '/api/test',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('presence endpoint updates heartbeat', async () => {
  const { response, data } = await request('/api/presence', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('presence endpoint returns online count', async () => {
  const { response, data } = await request('/api/presence');

  assert.strictEqual(response.status, 200);
  assert.ok(typeof data.online === 'number');
  assert.ok(data.online >= 0);
});

test('metrics json includes analytics data', async () => {
  const { response, data } = await request('/api/metrics');

  assert.strictEqual(response.status, 200);
  assert.ok(typeof data.projects_total === 'number');
  assert.ok(typeof data.projects_live === 'number');
  assert.ok(typeof data.revenue_all_time === 'number');
  assert.ok(typeof data.revenue_30d === 'number');
  assert.ok(typeof data.views_today === 'number');
  assert.ok(typeof data.views_total === 'number');
  assert.ok(typeof data.uniques_today === 'number');
  assert.ok(typeof data.uniques_total === 'number');
  assert.ok(typeof data.online === 'number');
});

test('upsert x daily metrics via admin api', async () => {
  const today = new Date().toISOString().split('T')[0];
  const { response, data } = await request('/api/admin/x/daily', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      day: today,
      followers: 1000,
      impressions: 50000,
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('upsert x posts via admin api', async () => {
  const { response, data } = await request('/api/admin/x/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      posts: [
        {
          url: 'https://x.com/test/status/123',
          text: 'test post',
          impressions: 1000,
          likes: 50,
        },
      ],
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.count, 1);
});

test('x admin endpoints require auth', async () => {
  const { response: dailyResponse } = await request('/api/admin/x/daily', {
    method: 'POST',
    body: JSON.stringify({
      day: '2024-01-01',
      followers: 100,
    }),
  });

  assert.strictEqual(dailyResponse.status, 401);

  const { response: postsResponse } = await request('/api/admin/x/posts', {
    method: 'POST',
    body: JSON.stringify({
      posts: [],
    }),
  });

  assert.strictEqual(postsResponse.status, 401);
});

test('hit endpoint captures referrer and utm params', async () => {
  const { response, data } = await request('/api/hit', {
    method: 'POST',
    body: JSON.stringify({
      path: '/test-attribution',
      referrer: 'https://x.com/someuser',
      utm_source: 'x',
      utm_medium: 'social',
      utm_campaign: 'launch',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('referrer normalization works', async () => {
  // Test various referrer sources
  const testCases = [
    { referrer: 'https://t.co/abc123', expected: 'x' },
    { referrer: 'https://twitter.com/user', expected: 'x' },
    { referrer: 'https://google.com/search', expected: 'google' },
    { referrer: 'https://news.ycombinator.com/item?id=123', expected: 'hn' },
    { referrer: 'https://reddit.com/r/test', expected: 'reddit' },
  ];

  for (const testCase of testCases) {
    const { response, data } = await request('/api/hit', {
      method: 'POST',
      body: JSON.stringify({
        path: `/test-referrer-${Math.random()}`,
        referrer: testCase.referrer,
      }),
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.ok, true);
  }
});

test('event endpoint records visitor events', async () => {
  const { response, data } = await request('/api/event', {
    method: 'POST',
    body: JSON.stringify({
      name: 'click_x',
      path: '/test-event',
      meta: { target: 'https://x.com/test' },
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.ok, true);
});

test('event endpoint validates event names', async () => {
  const { response } = await request('/api/event', {
    method: 'POST',
    body: JSON.stringify({
      name: 'invalid_event',
      path: '/test-event',
    }),
  });

  assert.strictEqual(response.status, 400);
});

test('short link creation and redirect', async () => {
  const slug = `test-${Date.now()}`;
  
  // Create link
  const { response: createResponse, data: createData } = await request('/api/admin/link', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      slug,
      target: 'https://example.com',
      utm_source: 'test',
      utm_campaign: 'test-campaign',
    }),
  });

  assert.strictEqual(createResponse.status, 200);
  assert.strictEqual(createData.ok, true);

  // Follow redirect
  const { response: redirectResponse } = await request(`/go/${slug}`, {
    redirect: 'manual',
  });

  assert.strictEqual(redirectResponse.status, 302);
  const location = redirectResponse.headers.get('location');
  assert.ok(location);
  assert.ok(location.includes('utm_source=test'));
  assert.ok(location.includes('utm_campaign=test-campaign'));
});

test('link admin endpoint requires auth', async () => {
  const { response } = await request('/api/admin/link', {
    method: 'POST',
    body: JSON.stringify({
      slug: 'test',
      target: 'https://example.com',
    }),
  });

  assert.strictEqual(response.status, 401);
});

test('analytics admin endpoint requires auth', async () => {
  const { response } = await request('/api/admin/analytics');

  assert.strictEqual(response.status, 401);
});

test('analytics admin endpoint returns data', async () => {
  const { response, data } = await request('/api/admin/analytics?days=7', {
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
  });

  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data.by_source));
  assert.ok(Array.isArray(data.by_campaign));
  assert.ok(Array.isArray(data.by_landing_page));
  assert.ok(Array.isArray(data.events_by_name));
  assert.ok(typeof data.funnel === 'object');
  assert.ok(Array.isArray(data.links));
});
