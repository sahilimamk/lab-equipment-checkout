import request from 'supertest';
import { createApp } from '../src/app';
import { query } from '../src/db';

const app = createApp();
const asStudent = { 'X-User-Id': 'stu-aria' };
const asAssistant = { 'X-User-Id': 'asst-rahul' };

describe('GET /api/equipment', () => {
  it('lists seeded equipment with available_units', async () => {
    const res = await request(app).get('/api/equipment').set(asStudent);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(6);
    const scope = res.body.data.find((e: any) => e.name === 'Oscilloscope');
    expect(scope.total_units).toBe(3);
    expect(scope.available_units).toBe(3);
  });

  it('401 without X-User-Id, 401 for unknown user', async () => {
    expect((await request(app).get('/api/equipment')).status).toBe(401);
    expect(
      (await request(app).get('/api/equipment').set({ 'X-User-Id': 'nope' })).status
    ).toBe(401);
  });
});

describe('POST /api/equipment', () => {
  it('assistant can create equipment (201)', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set(asAssistant)
      .send({ name: 'Logic Analyser', total_units: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Logic Analyser');
    expect(res.body.data.available_units).toBe(2);
  });

  it('student cannot create equipment (403)', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set(asStudent)
      .send({ name: 'Logic Analyser', total_units: 2 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('duplicate name, any case, is 409 DUPLICATE_NAME (failure case)', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set(asAssistant)
      .send({ name: 'oscilloscope', total_units: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_NAME');
  });

  it('malformed JSON body is 400, not 500', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set(asAssistant)
      .set('Content-Type', 'application/json')
      .send('{"name": broken');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid input is 400 with consistent error body', async () => {
    const res = await request(app)
      .post('/api/equipment')
      .set(asAssistant)
      .send({ name: '', total_units: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});

describe('PATCH /api/equipment/:id/retire', () => {
  it('retired equipment cannot be borrowed', async () => {
    const [eq] = await query("SELECT id FROM equipment WHERE name = 'Multimeter'");
    const retire = await request(app)
      .patch(`/api/equipment/${eq.id}/retire`)
      .set(asAssistant);
    expect(retire.status).toBe(200);
    const borrow = await request(app)
      .post('/api/checkouts')
      .set(asStudent)
      .send({ equipment_id: eq.id });
    expect(borrow.status).toBe(409);
    expect(borrow.body.error.code).toBe('EQUIPMENT_RETIRED');
  });
});
