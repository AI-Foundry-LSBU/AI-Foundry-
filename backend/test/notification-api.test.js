import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { notificationFixture } from '../test-support/notification-fixture.js';
import { authenticatedRequest as request, login, rawRequest } from '../test-support/client.js';

const staff = 'staff@lsbu.ac.uk';
const otherStaff = 'staff2@lsbu.ac.uk';
const path = '/api/v1/notifications';
let f;
before(async () => { f = await notificationFixture(); });
beforeEach(() => f.pool.query('TRUNCATE opportunities CASCADE'));
after(async () => { await f?.close(); });
const list = (server, query = '', email = staff) => request(server, `${path}${query}`, { email });
const markRead = (server, id, email = staff, body) => request(server, `${path}/${id}/read`, { email, method: 'POST', body });

test('US09 notification API authenticates and scopes recipients and opportunity ownership', async (t) => {
  const server = await f.start(t);
  assert.equal((await request(server, path)).status, 401);
  assert.equal((await request(server, path, { headers: { 'X-User-Email': staff } })).status, 401);
  const mine = await f.submit();
  const theirs = await f.submit(f.users.otherStaff);
  await f.review(mine.id);
  await f.review(theirs.id);
  const own = await list(server, `?status=all&userId=${f.users.otherStaff}`);
  assert.equal(own.status, 200);
  assert.equal(own.headers.get('cache-control'), 'no-store');
  assert.equal(own.body.unreadCount, 1);
  assert.deepEqual(own.body.items.map((item) => item.opportunityId), [mine.id]);
  const foreignId = (await list(server, '', otherStaff)).body.items[0].id;
  assert.equal((await markRead(server, foreignId)).status, 404);
  assert.equal((await list(server, '', otherStaff)).body.unreadCount, 1);
  assert.equal((await request(server, `/api/v1/opportunities/${own.body.items[0].opportunityId}`, { email: staff })).status, 200);
  assert.equal((await request(server, `/api/v1/opportunities/${mine.id}`, { email: otherStaff })).status, 403);
  for (const email of ['manager@lsbu.ac.uk', 'engineer@lsbu.ac.uk']) {
    assert.deepEqual((await list(server, '?status=all', email)).body, { items: [], unreadCount: 0 });
  }
});

test('US09 read/unread/all views persist read status without deleting or changing the first read date', async (t) => {
  const server = await f.start(t);
  const opportunity = await f.submit();
  await f.review(opportunity.id);
  await f.decide(opportunity.id);
  const unread = await list(server);
  assert.equal(unread.body.unreadCount, 2);
  assert.ok(unread.body.items.every((item) => item.isRead === false && item.readAt === null));
  const id = unread.body.items[0].id;
  assert.equal((await markRead(server, id)).status, 204);
  assert.equal((await list(server)).body.items.length, 1);
  assert.equal((await list(server, '?status=unread')).body.unreadCount, 1);
  const read = await list(server, '?status=read');
  assert.equal(read.body.items.length, 1);
  assert.equal(read.body.unreadCount, 1); // Count is across all the account's notifications.
  assert.equal(read.body.items[0].id, id);
  assert.equal(read.body.items[0].isRead, true);
  assert.ok(Number.isFinite(Date.parse(read.body.items[0].readAt)));
  assert.equal((await markRead(server, id)).status, 204);
  assert.deepEqual((await list(server, '?status=read')).body, read.body);
  const all = (await list(server, '?status=all')).body;
  assert.equal(all.items.length, 2);
  assert.equal(all.items.filter((item) => item.isRead).length, 1);
  assert.equal((await f.notices(opportunity.id)).length, 2);
  const restarted = await f.start(t);
  assert.deepEqual((await list(restarted, '?status=all')).body, all);
});

test('US09 validates status filters and returns safe not-found responses for unreadable IDs', async (t) => {
  const server = await f.start(t);
  for (const query of ['?status=bad', '?status=', '?status=all&status=read', '?status=READ']) {
    const invalid = await list(server, query);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'VALIDATION_ERROR');
    assert.ok(invalid.body.fields.status);
  }
  for (const query of ['', '?status=unread', '?status=read', '?status=all']) {
    assert.deepEqual((await list(server, query)).body, { items: [], unreadCount: 0 });
  }
  for (const id of ['bad-id', randomUUID()]) assert.equal((await markRead(server, id)).status, 404);
});

test('US09 marking read requires CSRF and ignores client-supplied recipient or timestamp values', async (t) => {
  const server = await f.start(t);
  const opportunity = await f.submit();
  await f.review(opportunity.id);
  const notification = (await list(server)).body.items[0];
  const signedIn = await login(server, staff);
  assert.equal((await rawRequest(server, `${path}/${notification.id}/read`, { cookie: signedIn.cookie, method: 'POST' })).status, 403);
  assert.equal((await rawRequest(server, `${path}/${notification.id}/read`, { cookie: signedIn.cookie, token: 'fake', method: 'POST' })).status, 403);
  assert.equal((await list(server)).body.unreadCount, 1);
  assert.equal((await markRead(server, notification.id, staff, {
    userId: f.users.otherStaff, readAt: '1900-01-01T00:00:00Z'
  })).status, 204);
  const read = (await list(server, '?status=read')).body.items[0];
  assert.notEqual(read.readAt, '1900-01-01T00:00:00.000Z');
  assert.deepEqual((await list(server, '?status=all', otherStaff)).body, { items: [], unreadCount: 0 });
});

test('US09 returns legacy notices and deterministically orders equal timestamps newest first', async (t) => {
  const server = await f.start(t);
  const opportunity = await f.submit();
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
  ];
  for (const [index, id] of ids.entries()) {
    await f.pool.query(`INSERT INTO notifications (id, user_id, opportunity_id, kind, message, created_at)
      VALUES ($1, $2, $3, 'under_review', 'Earlier saved notification.', $4)`,
    [id, f.users.staff, opportunity.id, index === 0 ? '2026-11-20T10:00:00Z' : '2026-11-21T10:00:00Z']);
  }
  const response = await list(server, '?status=all');
  assert.deepEqual(response.body.items.map((item) => item.id), [...ids].reverse());
  assert.ok(response.body.items.every((item) => item.readAt === null && item.isRead === false));
  assert.equal((await markRead(server, ids[0])).status, 204);
  assert.equal((await list(server, '?status=read')).body.items[0].id, ids[0]);
});

test('US09 does not expose or mark a legacy notice whose recipient is not the opportunity owner', async (t) => {
  const server = await f.start(t);
  const opportunity = await f.submit();
  const { rows: [wrong] } = await f.pool.query(`INSERT INTO notifications (user_id, opportunity_id, kind, message)
    VALUES ($1, $2, 'under_review', 'Wrong legacy recipient.') RETURNING id`, [f.users.otherStaff, opportunity.id]);
  assert.deepEqual((await list(server, '?status=all', otherStaff)).body, { items: [], unreadCount: 0 });
  assert.equal((await markRead(server, wrong.id, otherStaff)).status, 404);
  assert.deepEqual((await list(server, '?status=all')).body, { items: [], unreadCount: 0 });
});

test('US09 provides no public endpoint for creating notification messages', async (t) => {
  const server = await f.start(t);
  assert.equal((await request(server, path, {
    email: staff, body: { userId: f.users.otherStaff, message: 'Fake message.' }
  })).status, 404);
});
