// Shared helpers for Vercel Node serverless functions (CommonJS, req.body is
// auto-parsed JSON). Frontend lives on a different origin (GitHub Pages), so
// every response needs CORS headers.

function applyCors(req, res) {
  const origin = process.env.FRONTEND_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

// Wraps a handler with CORS + OPTIONS preflight handling + error catching.
function withHandler(handler) {
  return async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    try {
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
    }
  };
}

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function methodGuard(req, allowed) {
  if (!allowed.includes(req.method)) {
    throw new HttpError(405, `Method ${req.method} not allowed`);
  }
}

module.exports = { withHandler, HttpError, methodGuard, applyCors };
