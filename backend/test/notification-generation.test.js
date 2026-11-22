import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { updateProject } from '../src/projects/queries.js';
import { notificationFixture, assessment } from '../test-support/notification-fixture.js';
import { authenticatedRequest as request } from '../test-support/client.js';

let f;
before(async () => { f = await notificationFixture(); });
beforeEach(() => f.pool.query('TRUNCATE opportunities CASCADE'));
after(async () => { await f?.close(); });

test('US09 status/decision events create one linked notification each for the submitter', async () => {
  const opportunity = await f.submit();
  assert.deepEqual(await f.notices(opportunity.id), []);
  await f.review(opportunity.id);
  await f.review(opportunity.id);
  await f.decide(opportunity.id);
  const project = await f.project(opportunity.id);
  assert.equal((await f.notices(opportunity.id)).length, 2); // Approval also creates delivery, without a second notice.
  for (const status of ['in_progress', 'in_progress', 'testing', 'completed']) {
    await updateProject(f.pool, project.id, f.users.team, { status });
  }
  await updateProject(f.pool, project.id, f.users.team, { note: 'No status change.', progress: 100 });
  const notices = await f.notices(opportunity.id);
  assert.deepEqual(notices.map((row) => row.kind), ['under_review', 'approved', 'in_progress', 'testing', 'project_completed']);
  assert.ok(notices.every((row) => row.user_id === f.users.staff && row.read_at === null && row.history_event_id));
  assert.equal(new Set(notices.map((row) => row.history_event_id)).size, notices.length);
  const linked = (await f.pool.query(`SELECT n.created_at = h.occurred_at AS same_time
    FROM notifications n JOIN opportunity_history h ON h.id = n.history_event_id`)).rows;
  assert.ok(linked.every((row) => row.same_time));
});

test('US09 rejection creates one decision notice; invalid and repeated decisions create none', async () => {
  const opportunity = await f.submit();
  assert.equal(await f.decide(opportunity.id, 'rejected'), undefined);
  await f.review(opportunity.id);
  await f.decide(opportunity.id, 'rejected');
  assert.equal(await f.decide(opportunity.id, 'approved'), undefined);
  assert.deepEqual((await f.notices(opportunity.id)).map((row) => row.kind), ['under_review', 'rejected']);
});

test('US09 actual repeated transitions notify again without duplicating unchanged saves', async () => {
  const { opportunity, project } = await f.ready();
  for (const status of ['in_progress', 'testing', 'in_progress', 'in_progress', 'testing']) {
    await updateProject(f.pool, project.id, f.users.team, { status });
  }
  assert.deepEqual((await f.notices(opportunity.id)).map((row) => row.kind),
    ['under_review', 'approved', 'in_progress', 'testing', 'in_progress', 'testing']);
});

test('US09 recipients come from ownership; own actions and recovered events send no notices', async () => {
  const other = await f.submit(f.users.otherStaff);
  await f.review(other.id);
  assert.ok((await f.notices(other.id)).every((row) => row.user_id === f.users.otherStaff));
  const { opportunity, project } = await f.ready(f.users.team);
  assert.ok((await f.notices(opportunity.id)).every((row) => row.user_id === f.users.team));
  await updateProject(f.pool, project.id, f.users.team, { status: 'in_progress' });
  assert.equal((await f.notices(opportunity.id)).length, 2); // The engineer owns this hackathon request.
  await f.pool.query(`INSERT INTO opportunity_history
    (opportunity_id, event_type, from_status, to_status, actor_id, actor_name, source)
    SELECT $1, 'status_changed', 'submitted', 'in_assessment', id, name, 'backfill'
    FROM users WHERE id = $2`, [opportunity.id, f.users.manager]);
  assert.equal((await f.notices(opportunity.id)).length, 2);
});

test('US09 concurrent saves generate only the notifications for actual transitions', async () => {
  const opportunity = await f.submit();
  await Promise.all([f.review(opportunity.id), f.review(opportunity.id)]);
  await Promise.all([f.decide(opportunity.id), f.decide(opportunity.id)]);
  const project = await f.project(opportunity.id);
  await Promise.all([
    updateProject(f.pool, project.id, f.users.team, { status: 'in_progress' }),
    updateProject(f.pool, project.id, f.users.team, { status: 'in_progress' })
  ]);
  assert.deepEqual((await f.notices(opportunity.id)).map((row) => row.kind), ['under_review', 'approved', 'in_progress']);
});

test('US09 notification failure rolls back review, decision and delivery status with their history', async () => {
  const scenarios = [
    async () => {
      const opportunity = await f.submit();
      return { write: () => f.review(opportunity.id), check: async () => {
        assert.equal((await f.pool.query('SELECT status FROM opportunities WHERE id = $1', [opportunity.id])).rows[0].status, 'submitted');
        assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM opportunity_assessments')).rows[0].count, 0);
      } };
    },
    async () => {
      const opportunity = await f.submit();
      await f.review(opportunity.id);
      return { write: () => f.decide(opportunity.id), check: async () => {
        assert.equal((await f.pool.query('SELECT status FROM opportunities WHERE id = $1', [opportunity.id])).rows[0].status, 'in_assessment');
        assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM opportunity_decisions')).rows[0].count, 0);
        assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM projects')).rows[0].count, 0);
      } };
    },
    async () => {
      const { project } = await f.ready();
      return { write: () => updateProject(f.pool, project.id, f.users.team, { status: 'testing', note: 'Roll this back.' }), check: async () => {
        assert.equal((await f.pool.query('SELECT status FROM projects WHERE id = $1', [project.id])).rows[0].status, 'not_started');
        assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM project_progress_notes')).rows[0].count, 0);
      } };
    }
  ];
  for (const setup of scenarios) {
    await f.pool.query('TRUNCATE opportunities CASCADE');
    const scenario = await setup();
    const before = (await f.pool.query('SELECT count(*)::integer AS count FROM opportunity_history')).rows[0].count;
    const notices = (await f.pool.query('SELECT count(*)::integer AS count FROM notifications')).rows[0].count;
    await f.pool.query('ALTER TABLE notifications ADD CONSTRAINT simulate_notice_failure CHECK (history_event_id IS NULL) NOT VALID');
    try {
      await assert.rejects(scenario.write(), (error) => error.code === '23514');
      await scenario.check();
      assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM opportunity_history')).rows[0].count, before);
      assert.equal((await f.pool.query('SELECT count(*)::integer AS count FROM notifications')).rows[0].count, notices);
    } finally {
      await f.pool.query('ALTER TABLE notifications DROP CONSTRAINT simulate_notice_failure');
    }
  }
});

test('US09 automatic assessment uses the same notification generation without a duplicate route message', async (t) => {
  const opportunity = await f.submit();
  const server = await f.start(t, { reviewBenefit: async () => ({
    recommendation: 'worth_pursuing', summary: 'Saves staff time.', reason: 'Less manual work.',
    similarTitle: null, benefits: [], assessment: { ...assessment, category: 'automation', notes: 'Review proposed.' }
  }) });
  assert.equal((await request(server, `/api/v1/opportunities/${opportunity.id}`, { email: 'manager@lsbu.ac.uk' })).status, 200);
  assert.equal((await request(server, `/api/v1/opportunities/${opportunity.id}`, { email: 'manager@lsbu.ac.uk' })).status, 200);
  assert.deepEqual((await f.notices(opportunity.id)).map((row) => row.kind), ['under_review']);
});
