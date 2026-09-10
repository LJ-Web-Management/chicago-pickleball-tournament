const { ensureSchema } = require('../db');
const { requireAdmin } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { getSettings } = require('../settings');
const { generateBracket } = require('../bracket');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  requireAdmin(req);
  const settings = await getSettings();
  const { division, force } = req.body || {};
  if (!settings.divisions[division]) throw new HttpError(400, 'Invalid division');

  const matches = await generateBracket(division, !!force, settings);
  res.status(200).json({ matches });
});
