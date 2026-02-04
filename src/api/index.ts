import express from 'express';
import rulesRouter from './routes/rules';
import alertsRouter from './routes/alerts';
import pricesRouter from './routes/prices';

export function setupApi(app: express.Application) {
  app.use(express.json());

  app.use('/api/rules', rulesRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/prices', pricesRouter);

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[API] Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });
}
