const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { formTeam } = require('../teams');
const { getSettings } = require('../settings');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const user = requireUser(req);
  const settings = await getSettings();
  const { fromPlayerId, toPlayerId } = req.body || {};
  if (!fromPlayerId || !toPlayerId) throw new HttpError(400, 'fromPlayerId and toPlayerId are required');
  if (fromPlayerId === toPlayerId) throw new HttpError(400, 'A player cannot request themselves');

  const { rows: fromRows } = await sql`SELECT * FROM players WHERE id = ${fromPlayerId} AND user_id = ${user.sub} AND status = 'active'`;
  const fromPlayer = fromRows[0];
  if (!fromPlayer) throw new HttpError(404, 'Requesting player not found on your account');
  if (fromPlayer.team_id) throw new HttpError(409, 'That player already has a team');

  const { rows: toRows } = await sql`SELECT * FROM players WHERE id = ${toPlayerId} AND status = 'active'`;
  const toPlayer = toRows[0];
  if (!toPlayer) throw new HttpError(404, 'Requested player not found');
  if (toPlayer.team_id) throw new HttpError(409, 'That player already has a team');
  if (toPlayer.division !== fromPlayer.division) throw new HttpError(400, 'Players must be in the same division');

  // Mutual request already pending the other way: form the team immediately.
  const { rows: reciprocal } = await sql`
    SELECT id FROM team_requests WHERE from_player_id = ${toPlayerId} AND to_player_id = ${fromPlayerId} AND status = 'pending'
  `;
  if (reciprocal.length > 0) {
    await sql`UPDATE team_requests SET status = 'accepted', resolved_at = now() WHERE id = ${reciprocal[0].id}`;
    const team = await formTeam(fromPlayer.division, fromPlayerId, toPlayerId, settings);
    res.status(200).json({ status: 'team_formed', team });
    return;
  }

  // Target player opted into random assignment: auto-accept this request.
  if (toPlayer.random_opt_in) {
    const team = await formTeam(fromPlayer.division, fromPlayerId, toPlayerId, settings);
    res.status(200).json({ status: 'team_formed', team });
    return;
  }

  const { rows: existingPending } = await sql`
    SELECT id FROM team_requests WHERE from_player_id = ${fromPlayerId} AND to_player_id = ${toPlayerId} AND status = 'pending'
  `;
  if (existingPending.length > 0) throw new HttpError(409, 'Request already sent');

  await sql`INSERT INTO team_requests (from_player_id, to_player_id) VALUES (${fromPlayerId}, ${toPlayerId})`;
  res.status(201).json({ status: 'pending' });
});
