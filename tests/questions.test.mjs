// open questions: create, vote, write-ins, x sync, decide. run against a running instance:
// BASE=http://localhost:3000 ADMIN_KEY=... node --test tests/questions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';

const BASE = process.env.BASE || 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key';
const ADMIN = { Authorization: `Bearer ${ADMIN_KEY}` };

const stamp = Date.now().toString(36);

function jar() {
  let cookies = {};
  const header = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return {
    async call(path, { method = 'GET', body, headers = {} } = {}) {
      const res = await fetch(`${BASE}${path}`, {
        method,
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
  };
}

const anon = jar();
const alice = jar();
const bob = jar();
const carol = jar();

async function register(j, name) {
  const { res, data } = await j.call('/api/auth/register', { method: 'POST', body: { username: name, password: 'correct horse battery' } });
  assert.strictEqual(res.status, 201, JSON.stringify(data));
  return data.user;
}

async function clearOpenQuestion() {
  const { res, data } = await anon.call('/api/questions/current');
  if (res.status === 200 && data?.question) {
    await anon.call(`/api/admin/questions/${data.question.id}`, { method: 'PATCH', headers: ADMIN, body: { close: true } });
  }
}

const slug = `q-test-${stamp}`;
let questionId;
let options;
let writeinId;
let aliceUser;
let bobUser;

test('setup: accounts and a clean slate', async () => {
  aliceUser = await register(alice, `qa_${stamp}`);
  bobUser = await register(bob, `qb_${stamp}`);
  await register(carol, `qc_${stamp}`);
  await clearOpenQuestion();
  const { res } = await anon.call('/api/questions/current');
  assert.strictEqual(res.status, 204, 'no open question before the test starts');
});

test('admin create validates and needs the key', async () => {
  const noKey = await anon.call('/api/admin/questions', { method: 'POST', body: { title: 'x', options: ['a', 'b'] } });
  assert.strictEqual(noKey.res.status, 401);

  const one = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Only one option', options: ['a'] } });
  assert.strictEqual(one.res.status, 400);

  const five = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Too many', options: ['a', 'b', 'c', 'd', 'e'] } });
  assert.strictEqual(five.res.status, 400);

  const hours = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Too short', options: ['a', 'b'], closes_in_hours: 2 } });
  assert.strictEqual(hours.res.status, 400);

  const reserved = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Bad slug', slug: 'current', options: ['a', 'b'] } });
  assert.strictEqual(reserved.res.status, 400);

  const badX = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Bad x', options: ['a', 'b'], x_post_url: 'https://example.com/nope' } });
  assert.strictEqual(badX.res.status, 400);
});

test('admin opens a question with three options and an x post', async () => {
  const { res, data } = await anon.call('/api/admin/questions', {
    method: 'POST',
    headers: ADMIN,
    body: {
      title: 'Where should the agent spend next week?',
      slug,
      context_md: 'Two things are competing for the same hours.\n\n- **Painboard** needs the signup wall fixed.\n- **Threadbus** needs docs.',
      options: ['Fix painboard signups', 'Write threadbus docs', 'Post more on X'],
      closes_in_hours: 48,
      x_post_url: 'https://x.com/runbyagent/status/1234567890123456789',
    },
  });
  assert.strictEqual(res.status, 201, JSON.stringify(data));
  assert.strictEqual(data.question.slug, slug);
  assert.strictEqual(data.question.status, 'open');
  assert.strictEqual(data.question.x_post_id, '1234567890123456789');
  assert.strictEqual(data.results.options.length, 3);
  assert.deepStrictEqual(data.results.options.map((o) => o.position), [1, 2, 3]);
  questionId = data.question.id;
  options = data.results.options;

  const hoursOpen = (new Date(data.question.closes_at) - new Date(data.question.opened_at)) / 3600000;
  assert.ok(Math.abs(hoursOpen - 48) < 0.01, `closes 48h after opening, got ${hoursOpen}`);
});

test('only one question can be open', async () => {
  const { res, data } = await anon.call('/api/admin/questions', { method: 'POST', headers: ADMIN, body: { title: 'Another one', options: ['a', 'b'] } });
  assert.strictEqual(res.status, 409, JSON.stringify(data));
});

test('current and slug endpoints return the open question', async () => {
  const current = await anon.call('/api/questions/current');
  assert.strictEqual(current.res.status, 200);
  assert.strictEqual(current.data.question.slug, slug);
  assert.strictEqual(current.data.my_vote, null);
  assert.strictEqual(current.data.results.total, 0);
  assert.ok(current.data.results.options.every((o) => o.share === 0));

  const bySlug = await anon.call(`/api/questions/${slug}`);
  assert.strictEqual(bySlug.res.status, 200);
  assert.strictEqual(bySlug.data.question.id, questionId);

  const missing = await anon.call('/api/questions/does-not-exist');
  assert.strictEqual(missing.res.status, 404);

  const list = await anon.call('/api/questions');
  assert.ok(list.data.questions.some((q) => q.slug === slug && q.status === 'open'));
});

test('voting requires login', async () => {
  const { res } = await anon.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[0].id } });
  assert.strictEqual(res.status, 401);
});

test('one vote per user, changing it moves the vote', async () => {
  const first = await alice.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[0].id } });
  assert.strictEqual(first.res.status, 200, JSON.stringify(first.data));
  assert.strictEqual(first.data.my_vote, options[0].id);
  assert.strictEqual(first.data.results.site_total, 1);
  assert.strictEqual(first.data.results.options[0].site_votes, 1);
  assert.strictEqual(first.data.results.options[0].share, 100);

  const again = await alice.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[0].id } });
  assert.strictEqual(again.data.results.site_total, 1, 'voting the same option twice is still one vote');

  const moved = await alice.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[1].id } });
  assert.strictEqual(moved.data.my_vote, options[1].id);
  assert.strictEqual(moved.data.results.site_total, 1);
  assert.strictEqual(moved.data.results.options[0].site_votes, 0);
  assert.strictEqual(moved.data.results.options[1].site_votes, 1);

  const bobVote = await bob.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[0].id } });
  assert.strictEqual(bobVote.data.results.site_total, 2);

  const bad = await bob.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: 999999999 } });
  assert.strictEqual(bad.res.status, 404);

  const me = await bob.call(`/api/questions/${slug}`);
  assert.strictEqual(me.data.my_vote, options[0].id, 'my_vote follows the session');
});

test('x poll counts add to site votes and shares sum to 100', async () => {
  const { res, data } = await anon.call(`/api/admin/questions/${questionId}/sync-x`, {
    method: 'POST',
    headers: ADMIN,
    body: {
      poll: {
        voting_status: 'open',
        options: [
          { position: 1, label: 'Fix painboard signups', votes: 10 },
          { position: 2, label: 'Write threadbus docs', votes: 5 },
          { position: 3, label: 'Post more on X', votes: 2 },
        ],
      },
    },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(data));
  assert.strictEqual(data.source, 'manual');
  assert.strictEqual(data.updated, 3);
  assert.strictEqual(data.x_total, 17);

  const r = data.results;
  assert.strictEqual(r.site_total, 2);
  assert.strictEqual(r.x_total, 17);
  assert.strictEqual(r.total, 19);
  // bob on option 1 + 10 from x = 11, alice on option 2 + 5 = 6, option 3 = 2
  assert.deepStrictEqual(r.options.map((o) => o.total), [11, 6, 2]);
  assert.strictEqual(r.options.reduce((n, o) => n + o.share, 0), 100);
  assert.deepStrictEqual(r.options.map((o) => o.share), [58, 32, 10]);

  const detail = await anon.call(`/api/questions/${slug}`);
  assert.ok(detail.data.question.x_synced_at, 'x_synced_at is set');

  const results = await anon.call(`/api/admin/questions/${slug}/results`, { headers: ADMIN });
  assert.strictEqual(results.res.status, 200);
  assert.strictEqual(results.data.total, 19);
});

test('sync-x without a token and without a manual payload reports why', async () => {
  const { res, data } = await anon.call(`/api/admin/questions/${questionId}/sync-x`, { method: 'POST', headers: ADMIN });
  assert.ok([200, 502, 503].includes(res.status), `got ${res.status}: ${JSON.stringify(data)}`);
  if (res.status !== 200) assert.ok(data.error);
});

test('cron sync is guarded and quiet', async () => {
  const noAuth = await anon.call('/api/cron/questions-sync');
  assert.strictEqual(noAuth.res.status, 401);
  const withAuth = await anon.call('/api/cron/questions-sync', { headers: ADMIN });
  assert.ok([200, 502].includes(withAuth.res.status), JSON.stringify(withAuth.data));
  assert.ok('synced' in withAuth.data);
});

test('write-ins need login, are capped at 200 chars and collect karma upvotes', async () => {
  const anonTry = await anon.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'Nope' } });
  assert.strictEqual(anonTry.res.status, 401);

  const empty = await alice.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: '   ' } });
  assert.strictEqual(empty.res.status, 400);

  const long = await alice.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'x'.repeat(201) } });
  assert.strictEqual(long.res.status, 400);

  const ok = await alice.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'Ship the threadbus docs as a library page first' } });
  assert.strictEqual(ok.res.status, 201, JSON.stringify(ok.data));
  writeinId = ok.data.writein_id;
  assert.strictEqual(ok.data.writeins.length, 1);
  assert.strictEqual(ok.data.writeins[0].username, aliceUser.username);
  assert.strictEqual(ok.data.writeins[0].karma, 0);

  const dupe = await bob.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'ship the threadbus docs as a library page first' } });
  assert.strictEqual(dupe.res.status, 409);

  const self = await alice.call(`/api/questions/${slug}/writeins/${writeinId}/upvote`, { method: 'POST' });
  assert.strictEqual(self.res.status, 400, 'no upvoting your own write-in');

  const anonUp = await anon.call(`/api/questions/${slug}/writeins/${writeinId}/upvote`, { method: 'POST' });
  assert.strictEqual(anonUp.res.status, 401);

  const up = await bob.call(`/api/questions/${slug}/writeins/${writeinId}/upvote`, { method: 'POST' });
  assert.strictEqual(up.res.status, 200, JSON.stringify(up.data));
  assert.strictEqual(up.data.awarded, true);
  assert.strictEqual(up.data.writeins[0].karma, 1);
  assert.deepStrictEqual(up.data.my_writein_upvotes, [writeinId]);

  const twice = await bob.call(`/api/questions/${slug}/writeins/${writeinId}/upvote`, { method: 'POST' });
  assert.strictEqual(twice.data.awarded, false);
  assert.strictEqual(twice.data.writeins[0].karma, 1, 'once per user');

  const carolUp = await carol.call(`/api/questions/${slug}/writeins/${writeinId}/upvote`, { method: 'POST' });
  assert.strictEqual(carolUp.data.writeins[0].karma, 2);

  const aliceMe = await alice.call('/api/auth/me');
  assert.strictEqual(aliceMe.data.user.karma, 2, 'the author earned a point per upvote');
});

test('admin promotes a write-in into a fourth option, then the cap holds', async () => {
  const { res, data } = await anon.call(`/api/admin/questions/${questionId}/promote`, { method: 'POST', headers: ADMIN, body: { writein_id: writeinId } });
  assert.strictEqual(res.status, 201, JSON.stringify(data));
  assert.strictEqual(data.promoted.position, 4);
  assert.strictEqual(data.results.options.length, 4);
  assert.strictEqual(data.results.options[3].x_votes, 0, 'promoted options are site only');
  assert.strictEqual(data.writeins[0].promoted_option_id, data.promoted.option_id);

  const again = await anon.call(`/api/admin/questions/${questionId}/promote`, { method: 'POST', headers: ADMIN, body: { writein_id: writeinId } });
  assert.strictEqual(again.res.status, 409);

  const another = await bob.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'Kill painboard' } });
  assert.strictEqual(another.res.status, 201);
  const fifth = await anon.call(`/api/admin/questions/${questionId}/promote`, { method: 'POST', headers: ADMIN, body: { writein_id: another.data.writein_id } });
  assert.strictEqual(fifth.res.status, 409, 'four options max');

  const vote = await carol.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: data.promoted.option_id } });
  assert.strictEqual(vote.data.results.options[3].site_votes, 1);
});

test('admin patch edits the question', async () => {
  const { res, data } = await anon.call(`/api/admin/questions/${slug}`, {
    method: 'PATCH',
    headers: ADMIN,
    body: { title: 'Where should the agent spend next week? (edited)', closes_in_hours: 72, x_post_url: '' },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(data));
  assert.strictEqual(data.question.title, 'Where should the agent spend next week? (edited)');
  assert.strictEqual(data.question.x_post_id, null);
  const hoursOpen = (new Date(data.question.closes_at) - new Date(data.question.opened_at)) / 3600000;
  assert.ok(Math.abs(hoursOpen - 72) < 0.01);

  const fewer = await anon.call(`/api/admin/questions/${slug}`, { method: 'PATCH', headers: ADMIN, body: { options: ['a', 'b'] } });
  assert.strictEqual(fewer.res.status, 400, 'options cannot shrink once open');
});

test('decide closes the question and writes a changelog entry', async () => {
  const { res, data } = await anon.call(`/api/admin/questions/${questionId}/decide`, {
    method: 'POST',
    headers: ADMIN,
    body: { decision_md: 'We fix **painboard signups** first. The X poll and the site agreed, and the write-in about docs becomes the week after.' },
  });
  assert.strictEqual(res.status, 200, JSON.stringify(data));
  assert.strictEqual(data.question.status, 'decided');
  assert.ok(data.question.decided_at);
  assert.ok(data.question.decision_log_id);
  assert.ok(data.log_entry.body.startsWith('decision: Where should the agent spend next week? (edited) — We fix painboard signups first.'), data.log_entry.body);
  assert.match(data.log_entry.body, /Results: Fix painboard signups 11 \(\d+%\)/);
  assert.match(data.log_entry.body, new RegExp(`Write-ins: @${aliceUser.username}`));

  const log = await anon.call('/api/log');
  const entries = Array.isArray(log.data) ? log.data : log.data.entries || log.data.log || [];
  const entry = entries.find((e) => e.id === data.question.decision_log_id);
  assert.ok(entry, 'decision shows up in the log');
  assert.strictEqual(entry.kind, 'decision');

  const twice = await anon.call(`/api/admin/questions/${questionId}/decide`, { method: 'POST', headers: ADMIN, body: { decision_md: 'again' } });
  assert.strictEqual(twice.res.status, 409);
});

test('a decided question rejects votes and write-ins, and current is empty again', async () => {
  const vote = await alice.call(`/api/questions/${slug}/vote`, { method: 'POST', body: { option_id: options[0].id } });
  assert.strictEqual(vote.res.status, 409);
  const writein = await alice.call(`/api/questions/${slug}/writeins`, { method: 'POST', body: { body: 'Too late' } });
  assert.strictEqual(writein.res.status, 409);

  const current = await anon.call('/api/questions/current');
  assert.strictEqual(current.res.status, 204);

  const list = await anon.call('/api/questions');
  const row = list.data.questions.find((q) => q.slug === slug);
  assert.strictEqual(row.status, 'decided');
  assert.strictEqual(row.total_votes, 20);
  assert.strictEqual(row.writein_count, 2);
});

test('pages render', async () => {
  for (const path of ['/', '/questions', `/questions/${slug}`]) {
    const res = await fetch(`${BASE}${path}`);
    assert.strictEqual(res.status, 200, path);
    const html = await res.text();
    assert.ok(html.includes('Where should the agent spend next week?'), `${path} shows the question`);
  }
  const missing = await fetch(`${BASE}/questions/nope-${stamp}`);
  assert.strictEqual(missing.status, 404);
});
