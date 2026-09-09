const { sql, ensureSchema } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../../lib/http');
const { DIVISIONS } = require('../../../config/tournament');

// Lets an admin correct an elimination matchup (e.g. a seeding mistake)
// before it has been played. Round-robin matchups aren't editable here --
// they're a pure function of team number, so fix the underlying team/player
// records instead.
module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  requireAdmin(req);
  const { division, matchKey, teamA, teamB } = req.body || {};
  if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');
  if (!matchKey) throw new HttpError(400, 'matchKey is required');

  const { rows } = await sql`SELECT * FROM matches WHERE division = ${division} AND stage = 'elimination' AND match_key = ${matchKey}`;
  const match = rows[0];
  if (!match) throw new HttpError(404, 'Match not found');
  if (match.winner !== null) throw new HttpError(409, 'This match already has a recorded result -- undo it first');

  await sql`UPDATE matches SET team_a = ${teamA ?? match.team_a}, team_b = ${teamB ?? match.team_b} WHERE id = ${match.id}`;
  res.status(200).json({ updated: true });
});
