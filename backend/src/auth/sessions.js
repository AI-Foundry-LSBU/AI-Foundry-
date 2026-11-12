import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'foundry.sid';
const cookiePath = '/api/v1';

export function configureSessions(pool, options = {}) {
  const secret = options.sessionSecret ?? process.env.SESSION_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Set SESSION_SECRET to at least 32 characters. Run npm run auth:configure first.');
  }
  const idleMs = options.idleMs ?? 30 * 60 * 1000;
  const absoluteMs = options.absoluteMs ?? 8 * 60 * 60 * 1000;
  const now = options.now ?? Date.now;
  const cookie = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: cookiePath };
  const Store = connectPgSimple(session);
  const store = new Store({
    pool, tableName: 'auth_sessions', schemaName: options.sessionSchema,
    createTableIfMissing: false, pruneSessionInterval: options.pruneSessionInterval ?? 900
  });
  const middleware = session({
    store, name: cookieName, secret, resave: false, saveUninitialized: false, rolling: true,
    cookie: { ...cookie, maxAge: idleMs }
  });
  const destroy = (req, res) => new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      res.clearCookie(cookieName, cookie);
      if (error) reject(error); else resolve();
    });
  });
  const unauthorised = (res) => res.status(401).json({ code: 'UNAUTHORISED', message: 'Your session has ended. Please sign in.' });

  const requireUser = async (req, res, next) => {
    const current = req.session;
    if (!current.userId) return unauthorised(res);
    if (now() - current.startedAt >= absoluteMs || now() - current.lastSeenAt >= idleMs) {
      await destroy(req, res);
      return unauthorised(res);
    }
    const { rows: [user] } = await pool.query(
      'SELECT id, email, name, role, active, auth_version FROM users WHERE id = $1', [current.userId]
    );
    if (!user?.active || user.auth_version !== current.authVersion) {
      await destroy(req, res);
      return unauthorised(res);
    }
    req.user = user;
    current.lastSeenAt = now();
    // Prevent a rolling cookie from outliving the absolute limit.
    current.cookie.maxAge = Math.min(idleMs, absoluteMs - (now() - current.startedAt));
    next();
  };
  return { middleware, requireUser, destroy, store, now };
}

export function csrfToken(req) {
  return req.session.csrfToken ??= randomBytes(32).toString('hex');
}

export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const supplied = req.get('X-CSRF-Token');
  if (typeof expected !== 'string' || typeof supplied !== 'string' ||
      Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(403).json({ code: 'CSRF_INVALID', message: 'Refresh the page and try again.' });
  }
  next();
}
