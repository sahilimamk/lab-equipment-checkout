import request from 'supertest';
import { createApp } from '../src/app';
import { query } from '../src/db';

const app = createApp();
const aria = { 'X-User-Id': 'stu-aria' };

beforeAll(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('POST /api/ai/tip', () => {
  it('without GEMINI_API_KEY it is 503 AI_NOT_CONFIGURED', async () => {
    const rows = await query("SELECT id FROM equipment WHERE name = 'Oscilloscope'");
    const res = await request(app)
      .post('/api/ai/tip')
      .set(aria)
      .send({ equipment_id: rows[0].id, task: 'measure a signal' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('missing task is 400', async () => {
    const rows = await query("SELECT id FROM equipment WHERE name = 'Oscilloscope'");
    const res = await request(app)
      .post('/api/ai/tip')
      .set(aria)
      .send({ equipment_id: rows[0].id, task: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
