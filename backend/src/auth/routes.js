import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { csrfToken, requireCsrf } from './sessions.js';
import { verifyPassword } from './passwords.js';

export function accountResponse({ id, email, name, role }) {
  return { id, email, name, role };
}

export function authRoutes(pool, sessions, options = {}) {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: options.loginLimit ?? 20,
    standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true,
    message: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many sign-in attempts. Try again in 15 minutes.' }
  });
  router.get('/auth/csrf', (req, res) => res.json({ csrfToken: csrfToken(req) }));
  router.post('/auth/login', limiter, requireCsrf, express.json({ limit: '8kb' }), async (req, res) => {
    const { email, password } = req.body ?? {};
    if (Array.isArray(req.body) || typeof email !== 'string' || !email.trim() || email.length > 254 ||
        typeof password !== 'string' || !password || password.length > 128) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Enter your email and password.' });
    }
    const { rows: [user] } = await pool.query(
      'SELECT id, email, name, role, password_hash, active, auth_version FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const valid = await verifyPassword(user?.password_hash, password);
    if (!valid || !user.active) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    }
    // Rotate the identifier and CSRF token when changing from an anonymous to a signed-in session.
    await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
    Object.assign(req.session, {
      userId: user.id, authVersion: user.auth_version,
      startedAt: sessions.now(), lastSeenAt: sessions.now()
    });
    const token = csrfToken(req);
    await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
    return res.json({ user: accountResponse(user), csrfToken: token });
  });
  router.get('/auth/me', sessions.requireUser, (req, res) => {
    res.json({ user: accountResponse(req.user), csrfToken: csrfToken(req) });
  });
  router.post('/auth/logout', sessions.requireUser, requireCsrf, async (req, res) => {
    await sessions.destroy(req, res);
    return res.status(204).end();
  });
  return router;
}
