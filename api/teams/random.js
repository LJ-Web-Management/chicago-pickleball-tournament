const { sql, ensureSchema } = require('../../lib/db');
const { requireUser } = require('../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');
const { formTeam } = require('../../lib/teams');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const user = requireUser(req);
  const { playerId, optIn = true } = req.body || {};
  if (!playerId) throw new HttpError(400, 'playerId is required');

  const { rows } = await sql`SELECT * FROM players WHERE id = ${playerId} AND user_id = ${user.sub} AND status = 'active'`;
  const player = rows[0];
  if (!player) throw new HttpError(404, 'Player not found on your account');
  if (player.team_id) throw new HttpError(409, 'That player already has a team');

  if (!optIn) {
    await sql`UPDATE players SET random_opt_in = false WHERE id = ${playerId}`;
    res.status(200).json({ status: 'opted_out' });
    return;
  }

  // Look for someone else already waiting in the same division.
  const { rows: waiting } = await sql`
    SELECT id FROM players
    WHERE division = ${player.division} AND status = 'active' AND team_id IS NULL
      AND random_opt_in = true AND id <> ${playerId}
    ORDER BY created_at ASC LIMIT 1
  `;

  if (waiting.length > 0) {
    const team = await formTeam(player.division, playerId, waiting[0].id);
    res.status(200).json({ status: 'team_formed', team });
    return;
  }

  await sql`UPDATE players SET random_opt_in = true WHERE id = ${playerId}`;
  res.status(200).json({ status: 'waiting' });
});
