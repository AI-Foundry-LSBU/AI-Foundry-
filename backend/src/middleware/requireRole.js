export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You do not have permission to do that.'
    });
  };
}
