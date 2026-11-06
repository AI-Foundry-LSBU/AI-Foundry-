import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { resolveDemoUser } from './middleware/resolveDemoUser.js';
import { opportunityRoutes } from './opportunities/routes.js';

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/api/v1', resolveDemoUser(pool), opportunityRoutes(pool));

  app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' });
  });
  app.use(errorHandler);

  return app;
}
