import cors from 'cors';
import express from 'express';
import { requireUser } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { aiRouter } from './routes/ai';
import { checkoutsRouter } from './routes/checkouts';
import { equipmentRouter } from './routes/equipment';
import { reportRouter } from './routes/report';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', requireUser);
  app.use('/api/equipment', equipmentRouter);
  app.use('/api/checkouts', checkoutsRouter);
  app.use('/api/report', reportRouter);
  app.use('/api/ai', aiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
