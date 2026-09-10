const { withHandler, methodGuard } = require('../http');
const { getSettings } = require('../settings');

// Public: the frontend needs this before login (event title on the login
// page, which pages are enabled, division labels, the fee amount).
module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  const settings = await getSettings();
  res.status(200).json(settings);
});
