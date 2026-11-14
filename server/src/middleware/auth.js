import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.queueflow_session;
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    req.manager = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    res.clearCookie('queueflow_session', cookieOptions());
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}
