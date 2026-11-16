import request from 'supertest';
import { createApp } from '../src/app';
import { query } from '../src/db';

const app = createApp();
const aria = { 'X-User-Id': 'stu-aria' };
const rohan = { 'X-User-Id': 'stu-rohan' };
const assistant = { 'X-User-Id': 'asst-rahul' };

async function equipmentId(name: string): Promise<number> {
  const [row] = await query('SELECT id FROM equipment WHERE name = $1', [name]);
  return row.id;
}

describe('POST /api/checkouts (borrow)', () => {
  it('borrows one unit, due 7 days after borrow, available drops by 1', async () => {
    const id = await equipmentId('Oscilloscope');
    const res = await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe('stu-aria');
    const due = new Date(res.body.data.due_at).getTime();
    const borrowed = new Date(res.body.data.borrowed_at).getTime();
    expect(due - borrowed).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3);

    const list = await request(app).get('/api/equipment').set(aria);
    expect(list.body.data.find((e: any) => e.id === id).available_units).toBe(2);
  });

  it('borrowing the last unit then borrowing again is 409 NOT_AVAILABLE (failure case)', async () => {
    const id = await equipmentId('Raspberry Pi 4 Kit'); 
    await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    await request(app).post('/api/checkouts').set(rohan).send({ equipment_id: id });
    const third = await request(app)
      .post('/api/checkouts')
      .set({ 'X-User-Id': 'stu-meera' })
      .send({ equipment_id: id });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('NOT_AVAILABLE');
    expect(third.body.error.message).toMatch(/not available|No units available/i);
  });

  it('unknown equipment is 404', async () => {
    const res = await request(app).post('/api/checkouts').set(aria).send({ equipment_id: 99999 });
    expect(res.status).toBe(404);
  });

  it('non-numeric checkout id is 400, not 500', async () => {
    const res = await request(app).get('/api/checkouts/abc').set(aria);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('ownership rule', () => {
  it('student cannot see another student checkout (403), assistant can', async () => {
    const id = await equipmentId('Multimeter');
    const created = await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    const checkoutId = created.body.data.id;

    const other = await request(app).get(`/api/checkouts/${checkoutId}`).set(rohan);
    expect(other.status).toBe(403);

    const admin = await request(app).get(`/api/checkouts/${checkoutId}`).set(assistant);
    expect(admin.status).toBe(200);
  });

  it('student list shows only their own checkouts', async () => {
    const id = await equipmentId('Multimeter');
    await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    await request(app).post('/api/checkouts').set(rohan).send({ equipment_id: id });
    const mine = await request(app).get('/api/checkouts').set(aria);
    expect(mine.body.data.every((c: any) => c.user_id === 'stu-aria')).toBe(true);
    expect(mine.body.data.length).toBe(1);
    const all = await request(app).get('/api/checkouts').set(assistant);
    expect(all.body.data.length).toBe(2);
  });
});

describe('POST /api/checkouts/:id/return', () => {
  it('owner can return, available goes back up, second return is 409', async () => {
    const id = await equipmentId('Multimeter');
    const created = await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    const checkoutId = created.body.data.id;

    const ret = await request(app).post(`/api/checkouts/${checkoutId}/return`).set(aria);
    expect(ret.status).toBe(200);
    expect(ret.body.data.returned_at).toBeTruthy();

    const list = await request(app).get('/api/equipment').set(aria);
    expect(list.body.data.find((e: any) => e.id === id).available_units).toBe(5);

    const again = await request(app).post(`/api/checkouts/${checkoutId}/return`).set(aria);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_RETURNED');
  });

  it('student cannot return someone else checkout, assistant can', async () => {
    const id = await equipmentId('Multimeter');
    const created = await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    const checkoutId = created.body.data.id;

    expect(
      (await request(app).post(`/api/checkouts/${checkoutId}/return`).set(rohan)).status
    ).toBe(403);
    expect(
      (await request(app).post(`/api/checkouts/${checkoutId}/return`).set(assistant)).status
    ).toBe(200);
  });
});

describe('GET /api/checkouts pagination', () => {
  it('paginates with stable ordering (borrowed_at DESC, id DESC)', async () => {
    const id = await equipmentId('Multimeter'); 
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/checkouts').set(aria).send({ equipment_id: id });
    }
    const p1 = await request(app).get('/api/checkouts?page=1&limit=2').set(assistant);
    const p2 = await request(app).get('/api/checkouts?page=2&limit=2').set(assistant);
    expect(p1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, total_pages: 2 });
    expect(p1.body.data.length).toBe(2);
    expect(p2.body.data.length).toBe(1);
    const ids = [...p1.body.data, ...p2.body.data].map((c: any) => c.id);
    expect(new Set(ids).size).toBe(3); 
  });
});
