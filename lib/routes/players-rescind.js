const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const user = requireUser(req);
  const id = Number(req.query.id);

  const { rows } = await sql`SELECT * FROM players WHERE id = ${id} AND user_id = ${user.sub} AND status = 'active'`;
  const player = rows[0];
  if (!player) throw new HttpError(404, 'Player not found');

  if (player.team_id) {
    // Deleting the team frees the partner (players.team_id -> ON DELETE SET NULL)
    // and releases the team number back into the pool.
    await sql`DELETE FROM teams WHERE id = ${player.team_id}`;
  }
  await sql`UPDATE team_requests SET status = 'cancelled' WHERE (from_player_id = ${id} OR to_player_id = ${id}) AND status = 'pending'`;
  await sql`UPDATE players SET status = 'rescinded', team_id = NULL, random_opt_in = false WHERE id = ${id}`;

  res.status(200).json({
    rescinded: true,
    refundNote: player.paid
      ? 'Your registration fee was already paid. Please contact the event organizers directly to arrange a refund.'
      : null,
  });
});
