/**
 * errorHandler.js
 *
 * Centralised Express error-handling middleware.  Catches all errors that
 * propagate through the middleware chain and returns a consistent JSON
 * response shape: { success: false, error: <message> }.
 *
 * In development mode, the full stack trace is included for debugging.
 */

/**
 * Express error-handling middleware.
 * Must be registered AFTER all route handlers.
 *
 * @param {Error}  err  - The error object.
 * @param {Object} req  - Express request object.
 * @param {Object} res  - Express response object.
 * @param {Function} next - Express next function (required by signature even if unused).
 */
function errorHandler(err, req, res, next) {
  // Default to 500 if no status code has been set
  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;

  console.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
