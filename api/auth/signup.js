const { sql, ensureSchema } = require('../../lib/db');
const { hashPassword, signUserToken } = require('../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');

  const normalizedEmail = String(email).trim().toLowerCase();
  const { rows: existing } = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  if (existing.length > 0) throw new HttpError(409, 'An account with that email already exists');

  const passwordHash = await hashPassword(password);
  const { rows } = await sql`
    INSERT INTO users (email, password_hash) VALUES (${normalizedEmail}, ${passwordHash}) RETURNING id, email
  `;
  const user = rows[0];
  const token = signUserToken(user);
  res.status(201).json({ token, user: { id: user.id, email: user.email } });
});
