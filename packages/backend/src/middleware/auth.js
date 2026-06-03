/**
 * Auth middleware — extracts Meta token from header or body.
 */

/**
 * Requires a Meta token in `x-meta-token` header or `req.body.token`.
 * Attaches it to `req.metaToken` for use by controllers.
 */
export function requireToken(req, res, next) {
  const token = req.headers['x-meta-token'] || req.body?.token;
  if (!token) {
    return res.status(401).json({ error: 'Meta token required' });
  }
  req.metaToken = token;
  next();
}
