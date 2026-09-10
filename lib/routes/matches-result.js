const { sql, ensureSchema } = require('../db');
const { requireUserOrAdmin } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { getSettings } = require('../settings');
const { buildRoundRobinSchedule } = require('../schedule');
const { recordResult } = require('../bracket');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['POST']);
  await ensureSchema();
  const auth = requireUserOrAdmin(req);
  const settings = await getSettings();
  const { division, stage, matchKey, sets } = req.body || {};

  if (!settings.divisions[division]) throw new HttpError(400, 'Invalid division');
  if (!['round_robin', 'elimination'].includes(stage)) throw new HttpError(400, 'Invalid stage');
  if (!matchKey) throw new HttpError(400, 'matchKey is required');
  if (!Array.isArray(sets) || sets.length === 0 || sets.some((s) => s !== 'A' && s !== 'B')) {
    throw new HttpError(400, 'sets must be a non-empty array of "A"/"B"');
  }
  if (sets.length > 3) throw new HttpError(400, 'A match has at most 3 sets');

  let teamA;
  let teamB;
  if (stage === 'round_robin') {
    const template = buildRoundRobinSchedule(division, settings).find((m) => m.match_key === matchKey);
    if (!template) throw new HttpError(404, 'Unknown round-robin match');
    teamA = template.team_a;
    teamB = template.team_b;
  } else {
    const { rows } = await sql`SELECT team_a, team_b FROM matches WHERE division = ${division} AND stage = 'elimination' AND match_key = ${matchKey}`;
    if (!rows[0]) throw new HttpError(404, 'Match not found');
    teamA = rows[0].team_a;
    teamB = rows[0].team_b;
  }

  if (!auth.isAdmin) {
    const { rows } = await sql`
      SELECT 1 FROM players p JOIN teams t ON t.id = p.team_id
      WHERE p.user_id = ${auth.userId} AND t.division = ${division} AND t.team_number = ANY(${[teamA, teamB]})
      LIMIT 1
    `;
    if (rows.length === 0) throw new HttpError(403, 'You can only submit results for a match your team is playing in');
  }

  const updatedBy = auth.isAdmin ? 'admin' : `user:${auth.userId}`;
  const result = await recordResult(division, stage, matchKey, sets, updatedBy, settings);
  res.status(200).json(result);
});
