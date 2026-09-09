const { signAdminToken } = require('../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  const { username, password } = req.body || {};
  const expectedUser = process.env.ADMIN_USERNAME || 'admin52';
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin53';
  if (username !== expectedUser || password !== expectedPass) {
    throw new HttpError(401, 'Invalid admin credentials');
  }
  const token = signAdminToken();
  res.status(200).json({ token });
});
