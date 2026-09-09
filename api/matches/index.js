const { sql, ensureSchema } = require('../../lib/db');
const { withHandler, HttpError, methodGuard } = require('../../lib/http');
const { DIVISIONS } = require('../../config/tournament');
const { getRoundRobinMatches, getEliminationMatches } = require('../../lib/bracket');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();
  const { division } = req.query;
  if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');

  const { rows: rosterRows } = await sql`
    SELECT t.team_number, p.first_name, p.last_name
    FROM teams t LEFT JOIN players p ON p.team_id = t.id AND p.status = 'active'
    WHERE t.division = ${division}
  `;
  const roster = {};
  rosterRows.forEach((r) => {
    if (!roster[r.team_number]) roster[r.team_number] = [];
    if (r.first_name) roster[r.team_number].push(`${r.first_name} ${r.last_name}`);
  });

  const roundRobin = await getRoundRobinMatches(division);
  const elimination = await getEliminationMatches(division);

  const enrich = (m) => ({
    ...m,
    team_a_players: m.team_a ? roster[m.team_a] || [] : [],
    team_b_players: m.team_b ? roster[m.team_b] || [] : [],
  });

  res.status(200).json({
    division,
    roundRobin: roundRobin.map(enrich),
    elimination: elimination.map(enrich),
  });
});
