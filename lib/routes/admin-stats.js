const { sql, ensureSchema } = require('../db');
const { requireAdmin } = require('../auth');
const { withHandler, methodGuard } = require('../http');
const { DIVISIONS, DIVISION_ORDER, playerCap, teamCap } = require('../../config/tournament');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();
  requireAdmin(req);

  const { rows: playerCounts } = await sql`
    SELECT division, COUNT(*)::int AS c, COUNT(*) FILTER (WHERE paid)::int AS paid_c
    FROM players WHERE status = 'active' GROUP BY division
  `;
  const { rows: teamCounts } = await sql`SELECT division, COUNT(*)::int AS c FROM teams GROUP BY division`;
  const { rows: userCount } = await sql`SELECT COUNT(*)::int AS c FROM users`;

  const playerMap = Object.fromEntries(playerCounts.map((r) => [r.division, r]));
  const teamMap = Object.fromEntries(teamCounts.map((r) => [r.division, r.c]));

  const divisions = DIVISION_ORDER.map((key) => ({
    division: key,
    label: DIVISIONS[key].label,
    players: playerMap[key]?.c || 0,
    playerCap: playerCap(key),
    playersPaid: playerMap[key]?.paid_c || 0,
    teams: teamMap[key] || 0,
    teamCap: teamCap(key),
  }));

  const totalPlayers = divisions.reduce((sum, d) => sum + d.players, 0);

  res.status(200).json({ divisions, totalPlayers, totalAccounts: userCount[0].c });
});
