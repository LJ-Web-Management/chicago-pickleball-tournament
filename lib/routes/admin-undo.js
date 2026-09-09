const { ensureSchema } = require('../db');
const { requireAdmin } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { DIVISIONS } = require('../../config/tournament');
const { undoResult } = require('../bracket');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  requireAdmin(req);
  const { division, stage, matchKey } = req.body || {};
  if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');
  if (!['round_robin', 'elimination'].includes(stage)) throw new HttpError(400, 'Invalid stage');
  if (!matchKey) throw new HttpError(400, 'matchKey is required');

  await undoResult(division, stage, matchKey);
  res.status(200).json({ undone: true });
});
