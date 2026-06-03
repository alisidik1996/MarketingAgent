/**
 * Centralized error handler middleware.
 * Must be registered last: app.use(errorHandler)
 */
export function errorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message });
}
