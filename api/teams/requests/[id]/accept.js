const { sql, ensureSchema } = require('../../../../lib/db');
const { requireUser } = require('../../../../lib/auth');
const { withHandler, HttpError, methodGuard } = require('../../../../lib/http');
const { formTeam } = require('../../../../lib/teams');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const user = requireUser(req);
  const id = Number(req.query.id);

  const { rows } = await sql`
    SELECT tr.*, p.user_id AS to_user_id, p.division FROM team_requests tr
    JOIN players p ON p.id = tr.to_player_id
    WHERE tr.id = ${id} AND tr.status = 'pending'
  `;
  const request = rows[0];
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.to_user_id !== user.sub) throw new HttpError(403, 'This request was not sent to your players');

  await sql`UPDATE team_requests SET status = 'accepted', resolved_at = now() WHERE id = ${id}`;
  const team = await formTeam(request.division, request.from_player_id, request.to_player_id);
  res.status(200).json({ status: 'team_formed', team });
});
