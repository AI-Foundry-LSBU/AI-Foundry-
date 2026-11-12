import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { configureSessions, requireCsrf } from './auth/sessions.js';
import { authRoutes } from './auth/routes.js';
import { opportunityRoutes } from './opportunities/routes.js';
import { projectRoutes } from './projects/routes.js';
import { benefitRoutes } from './benefits/routes.js';

export function createApp(pool, options = {}) {
  const app = express();
  app.disable('x-powered-by');

  const sessions = configureSessions(pool, options);
  app.locals.sessionStore = sessions.store;
  app.use('/api/v1', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  }, sessions.middleware, authRoutes(pool, sessions, options), sessions.requireUser, requireCsrf,
  opportunityRoutes(pool), projectRoutes(pool), benefitRoutes(pool));

  app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' });
  });
  app.use(errorHandler);

  return app;
}
