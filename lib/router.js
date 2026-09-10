// Vercel's Hobby plan caps a deployment at 12 Serverless Functions, and this
// app has ~20 logical endpoints. Rather than one file per endpoint, every
// route (except the Stripe webhook, which needs raw-body config of its own)
// is dispatched through this single catch-all so the whole API is 2
// functions total. Each route module below is still a fully self-contained
// handler (already wrapped with CORS/error handling via lib/http.js) --
// this file just matches a path to one of them and forwards the request.
const { applyCors } = require('./http');

const routes = [
  { method: 'POST', pattern: ['auth', 'signup'], handler: () => require('./routes/auth-signup') },
  { method: 'POST', pattern: ['auth', 'login'], handler: () => require('./routes/auth-login') },

  { method: 'POST', pattern: ['admin', 'login'], handler: () => require('./routes/admin-login') },
  { method: 'GET', pattern: ['admin', 'players'], handler: () => require('./routes/admin-players-list') },
  { method: 'PUT', pattern: ['admin', 'players', ':id'], handler: () => require('./routes/admin-players-edit') },
  { method: 'GET', pattern: ['admin', 'stats'], handler: () => require('./routes/admin-stats') },
  { method: 'POST', pattern: ['admin', 'matches', 'generate-bracket'], handler: () => require('./routes/admin-generate-bracket') },
  { method: 'POST', pattern: ['admin', 'matches', 'undo'], handler: () => require('./routes/admin-undo') },
  { method: 'POST', pattern: ['admin', 'matches', 'set-teams'], handler: () => require('./routes/admin-set-teams') },
  { method: 'PUT', pattern: ['admin', 'settings'], handler: () => require('./routes/admin-settings-update') },
  { method: 'POST', pattern: ['admin', 'rules'], handler: () => require('./routes/admin-rules-upload') },

  { method: 'GET', pattern: ['settings'], handler: () => require('./routes/settings-get') },

  { method: 'GET', pattern: ['players'], handler: () => require('./routes/players-index') },
  { method: 'POST', pattern: ['players'], handler: () => require('./routes/players-index') },
  { method: 'GET', pattern: ['players', 'list'], handler: () => require('./routes/players-list') },
  { method: 'GET', pattern: ['players', 'available'], handler: () => require('./routes/players-available') },
  { method: 'PUT', pattern: ['players', ':id'], handler: () => require('./routes/players-edit') },
  { method: 'POST', pattern: ['players', ':id', 'rescind'], handler: () => require('./routes/players-rescind') },

  { method: 'POST', pattern: ['teams', 'request'], handler: () => require('./routes/teams-request') },
  { method: 'GET', pattern: ['teams', 'requests'], handler: () => require('./routes/teams-requests-list') },
  { method: 'POST', pattern: ['teams', 'requests', ':id', 'accept'], handler: () => require('./routes/teams-requests-accept') },
  { method: 'POST', pattern: ['teams', 'requests', ':id', 'reject'], handler: () => require('./routes/teams-requests-reject') },
  { method: 'POST', pattern: ['teams', 'random'], handler: () => require('./routes/teams-random') },

  { method: 'GET', pattern: ['matches'], handler: () => require('./routes/matches-index') },
  { method: 'POST', pattern: ['matches', 'result'], handler: () => require('./routes/matches-result') },

  { method: 'POST', pattern: ['payment', 'create-session'], handler: () => require('./routes/payment-create-session') },
];

function matchRoute(method, segments) {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pattern.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const part = route.pattern[i];
      if (part.startsWith(':')) {
        params[part.slice(1)] = segments[i];
      } else if (part !== segments[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: route.handler(), params };
  }
  return null;
}

// Reached via an explicit vercel.json rewrite (/api/:path* -> /api/index)
// rather than the [...path] filesystem convention, because Vercel's
// zero-config builder generated a single-segment-only catch-all regex for
// that convention on this project -- so we parse the real path ourselves.
// The rewrite's destination query string injects `path`, but fall back to
// parsing req.url directly in case a given runtime preserves that instead.
function pathSegments(req) {
  if (typeof req.query.path === 'string') {
    return req.query.path.split('/').filter(Boolean);
  }
  const pathname = (req.url || '').split('?')[0];
  return pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

async function dispatch(req, res) {
  if (req.method === 'OPTIONS') {
    applyCors(req, res);
    res.status(204).end();
    return;
  }

  const rawPath = pathSegments(req);
  const match = matchRoute(req.method, rawPath);
  if (!match) {
    applyCors(req, res);
    res.status(404).json({ error: `No route for ${req.method} /${rawPath.join('/')}` });
    return;
  }

  Object.assign(req.query, match.params);
  return match.handler(req, res);
}

module.exports = { dispatch };
