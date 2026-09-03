import { test } from 'node:test';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:3000';

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

test('get variants returns ranked list', async () => {
  const { response, data } = await request('/api/variants');

  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data));
  assert.ok(data.length === 10, 'should have 10 variants');
  
  // Check required fields
  data.forEach(variant => {
    assert.ok(variant.id);
    assert.ok(variant.slug);
    assert.ok(variant.name);
    assert.ok(variant.description);
    assert.ok(variant.file);
    assert.ok(typeof variant.rating_count === 'number');
    assert.ok(typeof variant.pick_count === 'number');
    assert.ok(typeof variant.comment_count === 'number');
    assert.ok(typeof variant.is_new === 'boolean');
  });
});

test('rate variant sets cookie and stores rating', async () => {
  const { response } = await request('/api/variants/01/rate', {
    method: 'POST',
    body: JSON.stringify({ stars: 5 }),
  });

  assert.strictEqual(response.status, 200);
  
  // Check that cookie was set
  const cookies = response.headers.get('set-cookie');
  assert.ok(cookies && cookies.includes('rba_vid'), 'should set visitor cookie');
  assert.ok(cookies.includes('HttpOnly'), 'cookie should be HttpOnly');
});

test('rate variant validates stars', async () => {
  const invalidStars = [0, 6, -1, 'five'];
  
  for (const stars of invalidStars) {
    const { response } = await request('/api/variants/01/rate', {
      method: 'POST',
      body: JSON.stringify({ stars }),
    });
    
    assert.strictEqual(response.status, 400, `should reject stars=${stars}`);
  }
});

test('rate variant updates existing rating', async () => {
  // First rating
  const { response: response1 } = await request('/api/variants/02/rate', {
    method: 'POST',
    body: JSON.stringify({ stars: 3 }),
  });
  
  assert.strictEqual(response1.status, 200);
  const cookies1 = response1.headers.get('set-cookie');
  const visitorId = cookies1.match(/rba_vid=([^;]+)/)?.[1];
  assert.ok(visitorId, 'should get visitor ID from first rating');

  // Update rating with same visitor ID
  const { response: response2 } = await request('/api/variants/02/rate', {
    method: 'POST',
    headers: {
      Cookie: `rba_vid=${visitorId}`,
    },
    body: JSON.stringify({ stars: 5 }),
  });
  
  assert.strictEqual(response2.status, 200);
});

test('pick variant sets cookie and stores pick', async () => {
  const { response } = await request('/api/variants/03/pick', {
    method: 'POST',
  });

  assert.strictEqual(response.status, 200);
  
  const cookies = response.headers.get('set-cookie');
  assert.ok(cookies && cookies.includes('rba_vid'), 'should set visitor cookie');
});

test('pick variant replaces previous pick', async () => {
  // First pick
  const { response: response1 } = await request('/api/variants/04/pick', {
    method: 'POST',
  });
  
  assert.strictEqual(response1.status, 200);
  const cookies1 = response1.headers.get('set-cookie');
  const visitorId = cookies1.match(/rba_vid=([^;]+)/)?.[1];

  // Change pick
  const { response: response2 } = await request('/api/variants/05/pick', {
    method: 'POST',
    headers: {
      Cookie: `rba_vid=${visitorId}`,
    },
  });
  
  assert.strictEqual(response2.status, 200);
});

test('post comment requires body', async () => {
  const { response } = await request('/api/variants/06/comments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User' }),
  });

  assert.strictEqual(response.status, 400);
});

test('post comment validates max length', async () => {
  const longBody = 'a'.repeat(2001);
  const { response } = await request('/api/variants/06/comments', {
    method: 'POST',
    body: JSON.stringify({ body: longBody }),
  });

  assert.strictEqual(response.status, 400);
});

test('post comment sets cookie and stores comment', async () => {
  const { response, data } = await request('/api/variants/07/comments', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test User',
      body: 'This is a test comment',
    }),
  });

  assert.strictEqual(response.status, 200);
  assert.ok(data.id);
  
  const cookies = response.headers.get('set-cookie');
  assert.ok(cookies && cookies.includes('rba_vid'), 'should set visitor cookie');
});

test('post comment allows optional name', async () => {
  const { response } = await request('/api/variants/08/comments', {
    method: 'POST',
    body: JSON.stringify({
      body: 'Anonymous comment',
    }),
  });

  assert.strictEqual(response.status, 200);
});

test('get comments returns list', async () => {
  // Post a comment first
  await request('/api/variants/09/comments', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Commenter',
      body: 'Test comment for retrieval',
    }),
  });

  // Get comments
  const { response, data } = await request('/api/variants/09/comments');

  assert.strictEqual(response.status, 200);
  assert.ok(Array.isArray(data));
  
  if (data.length > 0) {
    const comment = data[0];
    assert.ok(comment.id);
    assert.ok(comment.body);
    assert.ok(comment.created_at);
  }
});

test('comment rate limit works', async () => {
  const visitorId = `test-${Date.now()}`;
  
  // Try to post 11 comments (limit is 10 per hour)
  for (let i = 0; i < 11; i++) {
    const { response } = await request('/api/variants/10/comments', {
      method: 'POST',
      headers: {
        Cookie: `rba_vid=${visitorId}`,
      },
      body: JSON.stringify({
        body: `Rate limit test comment ${i}`,
      }),
    });
    
    if (i < 10) {
      assert.strictEqual(response.status, 200, `comment ${i + 1} should succeed`);
    } else {
      assert.strictEqual(response.status, 429, 'comment 11 should be rate limited');
    }
  }
});

test('variants are ranked by bayesian average', async () => {
  const { data } = await request('/api/variants');
  
  // Variants with fewer than 5 ratings should have bayesian_score of 0
  const newVariants = data.filter(v => v.rating_count < 5);
  newVariants.forEach(v => {
    assert.strictEqual(v.bayesian_score, 0, `variant ${v.slug} should have score 0 when rating_count < 5`);
    assert.strictEqual(v.is_new, true, `variant ${v.slug} should be marked as new`);
  });

  // Variants with 5+ ratings should be ranked
  const rankedVariants = data.filter(v => v.rating_count >= 5);
  for (let i = 0; i < rankedVariants.length - 1; i++) {
    assert.ok(
      rankedVariants[i].bayesian_score >= rankedVariants[i + 1].bayesian_score ||
      (rankedVariants[i].bayesian_score === rankedVariants[i + 1].bayesian_score &&
       rankedVariants[i].pick_count >= rankedVariants[i + 1].pick_count),
      'variants should be ranked by bayesian score, then picks'
    );
  }
});

test('invalid variant slug returns 404', async () => {
  const { response: rateResponse } = await request('/api/variants/99/rate', {
    method: 'POST',
    body: JSON.stringify({ stars: 5 }),
  });
  
  assert.strictEqual(rateResponse.status, 404);

  const { response: pickResponse } = await request('/api/variants/99/pick', {
    method: 'POST',
  });
  
  assert.strictEqual(pickResponse.status, 404);

  const { response: commentResponse } = await request('/api/variants/99/comments', {
    method: 'POST',
    body: JSON.stringify({ body: 'test' }),
  });
  
  assert.strictEqual(commentResponse.status, 404);
});
