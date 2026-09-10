const { requireAdmin } = require('../auth');
const { withHandler, methodGuard } = require('../http');
const { updateSettings } = require('../settings');

// Commits the new settings to config/settings.json in the repo -- this is
// intentionally a file, not a database row, since these values (court/team
// counts, fee, event title, enabled pages) change rarely and this keeps
// them versioned alongside the code that depends on them.
module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['PUT']);
  requireAdmin(req);
  const updated = await updateSettings(req.body || {}, 'admin');
  res.status(200).json(updated);
});
