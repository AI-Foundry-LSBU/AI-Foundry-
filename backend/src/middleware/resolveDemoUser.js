export function resolveDemoUser(pool) {
  return async (req, res, next) => {
    const email = req.get('X-User-Email')?.trim().toLowerCase();
    let user;
    if (email && !email.includes(',')) {
      const { rows } = await pool.query('SELECT id, name, role FROM users WHERE email = $1', [email]);
      user = rows[0];
    }

    if (!user) {
      return res.status(401).json({
        code: 'UNAUTHORISED',
        message: 'Supply the X-User-Email of a known demo user.'
      });
    }

    req.user = user;
    next();
  };
}
