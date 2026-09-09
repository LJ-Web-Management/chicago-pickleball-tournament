const { sql, ensureSchema } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');
const { SHIRT_SIZES } = require('../../config/tournament');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['PUT']);
  await ensureSchema();
  const user = requireUser(req);
  const id = Number(req.query.id);

  const { rows } = await sql`SELECT * FROM players WHERE id = ${id} AND user_id = ${user.sub} AND status = 'active'`;
  const player = rows[0];
  if (!player) throw new HttpError(404, 'Player not found');

  const { firstName, lastName, shirtSize } = req.body || {};
  if (shirtSize && !SHIRT_SIZES.includes(shirtSize)) throw new HttpError(400, 'Invalid shirt size');

  const { rows: updated } = await sql`
    UPDATE players SET
      first_name = ${firstName ? firstName.trim() : player.first_name},
      last_name = ${lastName ? lastName.trim() : player.last_name},
      shirt_size = ${shirtSize || player.shirt_size}
    WHERE id = ${id}
    RETURNING id, first_name, last_name, shirt_size, division, paid, status
  `;
  res.status(200).json({ player: updated[0] });
});
