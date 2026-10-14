const jwt = require('jsonwebtoken');
function issueSession(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '2h', issuer: 'northstar-wallet' });
}
function requireAuth(req, res, next) {
  const token = req.cookies?.wallet_session;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'northstar-wallet' });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
function setSessionCookie(res, token) {
  res.cookie('wallet_session', token, {
    httpOnly: true, secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax', path: '/', maxAge: 2 * 60 * 60 * 1000
  });
}
function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || origin !== process.env.FRONTEND_ORIGIN) return res.status(403).json({ error: 'Request origin not allowed' });
  next();
}
module.exports = { issueSession, requireAuth, setSessionCookie, originGuard };
