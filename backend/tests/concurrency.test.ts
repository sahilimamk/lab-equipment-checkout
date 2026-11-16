import request from 'supertest';
import { createApp } from '../src/app';
import { query } from '../src/db';

const app = createApp();

describe('concurrent borrow of the last unit', () => {
  it('exactly one succeeds', async () => {
    const created = await request(app)
      .post('/api/equipment')
      .set({ 'X-User-Id': 'asst-rahul' })
      .send({ name: 'Single Unit Scope', total_units: 1 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const [a, b] = await Promise.all([
      request(app).post('/api/checkouts').set({ 'X-User-Id': 'stu-aria' }).send({ equipment_id: id }),
      request(app).post('/api/checkouts').set({ 'X-User-Id': 'stu-rohan' }).send({ equipment_id: id })
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.code).toBe('NOT_AVAILABLE');

    const active = await query(
      'SELECT COUNT(*)::int AS n FROM checkouts WHERE equipment_id = $1 AND returned_at IS NULL',
      [id]
    );
    expect(active[0].n).toBe(1);
  });
});
