import { Router } from 'express';
import { pool } from '../db';
import { badRequest, notFound } from '../errors';

export const aiRouter = Router();

aiRouter.post('/tip', async (req, res, next) => {
  try {
    const equipment_id = Number(req.body.equipment_id);
    const task = typeof req.body.task === 'string' ? req.body.task.trim() : '';
    if (!Number.isInteger(equipment_id) || equipment_id <= 0) {
      throw badRequest('equipment_id must be a positive integer');
    }
    if (task === '' || task.length > 200) {
      throw badRequest('task is required and must be under 200 characters');
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(503).json({ error: { code: 'AI_NOT_CONFIGURED', message: 'AI is not set up. Add GEMINI_API_KEY to the backend .env file.' } });
    }
    const found = await pool.query(
      'SELECT id, name, total_units FROM equipment WHERE id = $1',
      [equipment_id]
    );
    if (found.rows.length === 0) {
      throw notFound('Equipment not found');
    }
    const item = found.rows[0];
    const active = await pool.query(
      'SELECT COUNT(*)::int AS n FROM checkouts WHERE equipment_id = $1 AND returned_at IS NULL',
      [equipment_id]
    );
    const available = item.total_units - active.rows[0].n;
    const prompt =
      'You are helping a student in a college lab. Equipment: ' + item.name +
      ' (' + item.total_units + ' units owned, ' + available + ' available). ' +
      'The student wants to: ' + task + '. ' +
      'In 2 short sentences, say if this equipment fits the job and give one safety or care tip. Use plain simple English.';
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
        })
      }
    );
    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      console.error('Gemini call failed:', geminiRes.status, detail);
      return res.status(502).json({ error: { code: 'AI_FAILED', message: 'Gemini did not answer. Try again later.' } });
    }
    const geminiBody: any = await geminiRes.json();
    const tip = geminiBody.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (tip === '') {
      return res.status(502).json({ error: { code: 'AI_FAILED', message: 'Gemini did not answer. Try again later.' } });
    }
    res.json({ data: { equipment_id: item.id, name: item.name, tip: tip } });
  } catch (err) {
    next(err);
  }
});
