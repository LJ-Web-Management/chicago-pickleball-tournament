const { sql, ensureSchema } = require('../../lib/db');
const { comparePassword, signUserToken } = require('../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const normalizedEmail = String(email).trim().toLowerCase();
  const { rows } = await sql`SELECT id, email, password_hash FROM users WHERE email = ${normalizedEmail}`;
  const user = rows[0];
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) throw new HttpError(401, 'Invalid email or password');

  const token = signUserToken(user);
  res.status(200).json({ token, user: { id: user.id, email: user.email } });
});
