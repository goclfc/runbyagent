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
