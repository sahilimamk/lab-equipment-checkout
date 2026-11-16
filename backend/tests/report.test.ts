import request from 'supertest';
import { createApp } from '../src/app';
import { query } from '../src/db';

const app = createApp();
const aria = { 'X-User-Id': 'stu-aria' };

describe('GET /api/report/equipment-usage', () => {
  it('returns one row per item with checked_out and overdue from a JOIN+aggregate', async () => {
    const [eq] = await query("SELECT id FROM equipment WHERE name = 'Oscilloscope'");
    await request(app).post('/api/checkouts').set(aria).send({ equipment_id: eq.id });
    await request(app).post('/api/checkouts').set(aria).send({ equipment_id: eq.id });

    await query(
      `UPDATE checkouts
          SET borrowed_at = now() - INTERVAL '8 days',
              due_at = now() - INTERVAL '1 day'
        WHERE id = (SELECT MIN(id) FROM checkouts WHERE equipment_id = $1)`,
      [eq.id]
    );

    const res = await request(app).get('/api/report/equipment-usage').set(aria);
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: any) => r.name === 'Oscilloscope');
    expect(row.checked_out).toBe(2);
    expect(row.overdue).toBe(1);
    expect(row.available_units).toBe(1); 

    const untouched = res.body.data.find((r: any) => r.name === 'Multimeter');
    expect(untouched.checked_out).toBe(0);
    expect(untouched.overdue).toBe(0);
  });
});
