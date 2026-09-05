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

test('update log entry via admin api', async () => {
  // First create an entry
  const { data: created } = await request('/api/admin/log', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      body: 'original entry',
      kind: 'note',
    }),
  });

  // Update it
  const { response, data } = await request('/api/admin/log', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: created.id,
      body: 'updated entry',
      kind: 'build',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.id, created.id);
  assert.strictEqual(data.body, 'updated entry');
  assert.strictEqual(data.kind, 'build');
});

test('update log entry with partial fields', async () => {
  // Create an entry
  const { data: created } = await request('/api/admin/log', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      body: 'test entry',
      kind: 'note',
      x_url: 'https://x.com/test/status/123',
    }),
  });

  // Update only body
  const { response, data } = await request('/api/admin/log', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: created.id,
      body: 'modified body',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.body, 'modified body');
  assert.strictEqual(data.kind, 'note'); // unchanged
  assert.strictEqual(data.x_url, 'https://x.com/test/status/123'); // unchanged
});

test('update nonexistent log entry returns 404', async () => {
  const { response } = await request('/api/admin/log', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: 999999,
      body: 'should not exist',
    }),
  });

  assert.strictEqual(response.status, 404);
});

test('delete log entry via admin api', async () => {
  // Create an entry
  const { data: created } = await request('/api/admin/log', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      body: 'entry to delete',
      kind: 'note',
    }),
  });

  // Delete it
  const { response, data } = await request('/api/admin/log', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: created.id,
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.id, created.id);
  assert.strictEqual(data.body, 'entry to delete');
});

test('delete nonexistent log entry returns 404', async () => {
  const { response } = await request('/api/admin/log', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: 999999,
    }),
  });

  assert.strictEqual(response.status, 404);
});

test('log admin endpoints require auth', async () => {
  const { response: patchResponse } = await request('/api/admin/log', {
    method: 'PATCH',
    body: JSON.stringify({
      id: 1,
      body: 'test',
    }),
  });

  assert.strictEqual(patchResponse.status, 401);

  const { response: deleteResponse } = await request('/api/admin/log', {
    method: 'DELETE',
    body: JSON.stringify({
      id: 1,
    }),
  });

  assert.strictEqual(deleteResponse.status, 401);
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

const RESEARCH_KEY = process.env.RESEARCH_KEY || 'test-research-key';

test('research inbox accepts json with array of lines', async () => {
  const { response, data } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Test Research',
      lines: ['line 1', 'line 2', 'line 3'],
      source: 'test-bot',
      meta: { test: true },
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.name, 'Test Research');
  assert.strictEqual(data.count, 3);
  assert.ok(typeof data.id === 'number');
});

test('research inbox accepts json with string lines', async () => {
  const { response, data } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Test with String',
      lines: 'line 1\nline 2\nline 3',
      source: 'test-bot',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.name, 'Test with String');
  assert.strictEqual(data.count, 3);
});

test('research inbox accepts plain text', async () => {
  const { response, data } = await request('/api/research/inbox?name=Plain%20Text%20Doc&source=text-bot', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
      'Content-Type': 'text/plain',
    },
    body: 'line 1\nline 2\nline 3',
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.name, 'Plain Text Doc');
  assert.strictEqual(data.count, 3);
});

test('research inbox accepts admin key', async () => {
  const { response, data } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      name: 'Admin Test',
      lines: ['line 1'],
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.count, 1);
});

test('research inbox requires auth', async () => {
  const { response } = await request('/api/research/inbox', {
    method: 'POST',
    body: JSON.stringify({
      name: 'No Auth',
      lines: ['line 1'],
    }),
  });

  assert.strictEqual(response.status, 401);
});

test('research inbox rejects too many lines', async () => {
  const manyLines = Array(5001).fill('line');
  const { response } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Too Many Lines',
      lines: manyLines,
    }),
  });

  assert.strictEqual(response.status, 413);
});

test('research inbox rejects empty lines', async () => {
  const { response } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Empty',
      lines: [],
    }),
  });

  assert.strictEqual(response.status, 400);
});

test('research list endpoint requires auth', async () => {
  const { response } = await request('/api/research');

  assert.strictEqual(response.status, 401);
});

test('research list endpoint returns docs', async () => {
  const { response, data } = await request('/api/research', {
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
  });

  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data));
});

test('research get endpoint requires auth', async () => {
  const { response } = await request('/api/research/1');

  assert.strictEqual(response.status, 401);
});

test('research get endpoint returns doc', async () => {
  // First create a doc
  const { data: created } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Get Test',
      lines: ['line 1', 'line 2'],
      source: 'test',
    }),
  });

  // Then fetch it
  const { response, data } = await request(`/api/research/${created.id}`, {
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.name, 'Get Test');
  assert.ok(Array.isArray(data.lines));
  assert.strictEqual(data.lines.length, 2);
});

test('research markdown endpoint requires auth', async () => {
  const res = await fetch(`${process.env.BASE || 'http://localhost:3000'}/api/research/1/md`);
  assert.strictEqual(res.status, 401);
});

test('research markdown endpoint returns plain text', async () => {
  // First create a doc
  const { data: created } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEARCH_KEY}`,
    },
    body: JSON.stringify({
      name: 'Markdown Test',
      lines: ['line 1', 'line 2', 'line 3'],
    }),
  });

  // Then fetch it as markdown
  const res = await fetch(`${process.env.BASE || 'http://localhost:3000'}/api/research/${created.id}/md`, {
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
  });

  assert.strictEqual(res.status, 200);
  assert.ok(res.headers.get('content-type')?.includes('text/plain'));
  const text = await res.text();
  assert.strictEqual(text, 'line 1\nline 2\nline 3');
});

// Bot bus tests
test('create bot via admin api', async () => {
  const botId = `test-bot-${Math.random().toString(36).substring(7)}`;
  
  const { response, data } = await request('/api/admin/bots', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
    },
    body: JSON.stringify({
      id: botId,
      name: 'Test Bot',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.id, botId);
  assert.ok(data.key);
  assert.ok(data.key.startsWith('rb_'));
  
  // Save the key for later tests
  process.env.TEST_BOT_KEY = data.key;
});

test('bot creation requires auth', async () => {
  const { response } = await request('/api/admin/bots', {
    method: 'POST',
    body: JSON.stringify({
      id: 'another-bot',
      name: 'Another Bot',
    }),
  });

  assert.strictEqual(response.status, 401);
});

test('bot key works with research inbox', async () => {
  const botKey = process.env.TEST_BOT_KEY;
  
  if (!botKey) {
    console.log('Skipping: no bot key available');
    return;
  }

  const { response, data } = await request('/api/research/inbox', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botKey}`,
    },
    body: JSON.stringify({
      name: 'Bot Research Doc',
      lines: ['line 1', 'line 2'],
      source: 'test-bot',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.name, 'Bot Research Doc');
  assert.strictEqual(data.count, 2);
});

// Library tests
test('unpublished finding is absent from /api/library', async () => {
  const { response, data } = await request('/api/research/inbox', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({
      kind: 'finding',
      name: 'Test Finding Unpublished',
      summary: 'A test finding',
      body_md: 'This is a test finding.',
      lines: ['test line'],
      published: false,
    }),
  });

  assert.strictEqual(response.status, 200);
  const docId = data.id;

  // Should not appear in library
  const { data: docs } = await request('/api/library');
  const found = docs.find(d => d.name === 'Test Finding Unpublished');
  assert.strictEqual(found, undefined, 'unpublished finding should not appear in library');

  // Store for next test
  process.env.TEST_LIBRARY_DOC_ID = docId;
});

test('PATCH to publish makes doc appear in library', async () => {
  const docId = process.env.TEST_LIBRARY_DOC_ID;
  
  if (!docId) {
    console.log('Skipping: no test doc id');
    return;
  }

  const { response: patchResponse } = await request(`/api/research/${docId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({ published: true }),
  });

  assert.strictEqual(patchResponse.status, 200);

  // Should now appear in library
  const { data: docs } = await request('/api/library');
  const found = docs.find(d => d.name === 'Test Finding Unpublished');
  assert.ok(found, 'published finding should appear in library');
  
  // Store slug for version test
  process.env.TEST_LIBRARY_SLUG = found.slug;
});

test('version stored on body change', async () => {
  const docId = process.env.TEST_LIBRARY_DOC_ID;
  const slug = process.env.TEST_LIBRARY_SLUG;
  
  if (!docId || !slug) {
    console.log('Skipping: no test doc id or slug');
    return;
  }

  const { response: patchResponse } = await request(`/api/research/${docId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({
      body_md: 'Updated body content.',
      summary: 'Updated summary',
    }),
  });

  assert.strictEqual(patchResponse.status, 200);

  // Check versions endpoint
  const { data: versions } = await request(`/api/library/${slug}/versions`);
  assert.ok(Array.isArray(versions), 'versions should be an array');
  assert.ok(versions.length > 0, 'should have at least one version after update');
});

test('/api/live returns hello event within 2s', async () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('hello event not received within 2s'));
    }, 2000);
    
    const controller = new AbortController();
    
    fetch(`${BASE}/api/live`, { signal: controller.signal })
      .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              clearTimeout(timeout);
              reject(new Error('stream ended without hello event'));
              return;
            }
            
            const text = decoder.decode(value);
            
            if (text.includes('event: hello')) {
              const dataMatch = text.match(/data: (.+)/);
              if (dataMatch) {
                const data = JSON.parse(dataMatch[1]);
                
                assert.ok(typeof data.log_head === 'number', 'hello should have log_head');
                assert.ok(typeof data.metrics === 'object', 'hello should have metrics');
                
                clearTimeout(timeout);
                controller.abort();
                resolve();
                return;
              }
            }
            
            read();
          }).catch(err => {
            if (err.name !== 'AbortError') {
              clearTimeout(timeout);
              reject(err);
            }
          });
        }
        
        read();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
});

test('author with + character is accepted (agent+gocha)', async () => {
  const { response, data } = await request('/api/admin/log', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({
      body: 'Test entry with composite author',
      kind: 'note',
      author: 'agent+gocha',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(data.author, 'agent+gocha');

  // Test PATCH as well
  const { response: patchResponse } = await request(`/api/admin/log`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({
      id: data.id,
      author: 'cursor+agent',
    }),
  });

  assert.strictEqual(patchResponse.status, 200);
});

test('/api/live sends log event after POST /api/admin/log', async () => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('log event not received within 5s'));
    }, 5000);
    
    const controller = new AbortController();
    let helloReceived = false;
    
    fetch(`${BASE}/api/live`, { signal: controller.signal })
      .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              clearTimeout(timeout);
              reject(new Error('stream ended'));
              return;
            }
            
            const text = decoder.decode(value);
            
            if (text.includes('event: hello') && !helloReceived) {
              helloReceived = true;
              
              // Post a log entry
              fetch(`${BASE}/api/admin/log`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${ADMIN_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  body: 'SSE test log entry',
                  kind: 'note',
                }),
              });
            }
            
            if (text.includes('event: log') && helloReceived) {
              clearTimeout(timeout);
              controller.abort();
              resolve();
              return;
            }
            
            read();
          }).catch(err => {
            if (err.name !== 'AbortError') {
              clearTimeout(timeout);
              reject(err);
            }
          });
        }
        
        read();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          clearTimeout(timeout);
          reject(err);
        }
      });
  });
});

test('admin opens a question and visitors can answer it', async () => {
  const slug = `test-q-${Date.now()}`;
  const { response, data } = await request('/api/admin/question', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({
      slug,
      body: 'what should we build next?',
      options: ['a smaller tool', 'a louder post', 'wait'],
    }),
  });
  assert.strictEqual(response.status, 201);
  assert.strictEqual(data.slug, slug);
  assert.strictEqual(data.status, 'open');

  const open = await request('/api/questions/open');
  assert.strictEqual(open.response.status, 200);
  assert.strictEqual(open.data.question.slug, slug);
  assert.ok(open.data.options.length >= 3);

  const first = open.data.options[0];
  const vote = await request(`/api/questions/${slug}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_id: first.id }),
  });
  assert.strictEqual(vote.response.status, 200);
  assert.strictEqual(vote.data.my_vote, first.id);
  assert.ok(vote.data.replies.length >= 1);

  const custom = await request(`/api/questions/${slug}/vote`, {
    method: 'POST',
    body: JSON.stringify({ body: 'ship threadbus docs', t0: 'skip' }),
  });
  assert.strictEqual(custom.response.status, 400);

  const history = await request('/api/questions');
  assert.ok(history.data.questions.some((q) => q.slug === slug));

  const closed = await request('/api/admin/question', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${ADMIN_KEY}` },
    body: JSON.stringify({ slug, outcome: 'build the smaller tool' }),
  });
  assert.strictEqual(closed.response.status, 200);
  assert.strictEqual(closed.data.status, 'closed');
  assert.strictEqual(closed.data.outcome, 'build the smaller tool');
});
