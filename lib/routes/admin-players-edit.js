const { sql, ensureSchema } = require('../db');
const { requireAdmin } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { SHIRT_SIZES } = require('../../config/tournament');
const { getSettings } = require('../settings');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['PUT']);
  await ensureSchema();
  requireAdmin(req);
  const settings = await getSettings();
  const id = Number(req.query.id);

  const { rows } = await sql`SELECT * FROM players WHERE id = ${id}`;
  const player = rows[0];
  if (!player) throw new HttpError(404, 'Player not found');

  const { firstName, lastName, shirtSize, division, paid, status } = req.body || {};
  if (division && !settings.divisions[division]) throw new HttpError(400, 'Invalid division');
  if (shirtSize && !SHIRT_SIZES.includes(shirtSize)) throw new HttpError(400, 'Invalid shirt size');
  if (status && !['active', 'rescinded'].includes(status)) throw new HttpError(400, 'Invalid status');

  const { rows: updated } = await sql`
    UPDATE players SET
      first_name = ${firstName ?? player.first_name},
      last_name = ${lastName ?? player.last_name},
      shirt_size = ${shirtSize ?? player.shirt_size},
      division = ${division ?? player.division},
      paid = ${paid ?? player.paid},
      status = ${status ?? player.status}
    WHERE id = ${id}
    RETURNING id, first_name, last_name, shirt_size, division, paid, status
  `;
  res.status(200).json({ player: updated[0] });
});
