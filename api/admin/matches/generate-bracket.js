const { ensureSchema } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../../lib/http');
const { DIVISIONS } = require('../../../config/tournament');
const { generateBracket } = require('../../../lib/bracket');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  requireAdmin(req);
  const { division, force } = req.body || {};
  if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');

  const matches = await generateBracket(division, !!force);
  res.status(200).json({ matches });
});
