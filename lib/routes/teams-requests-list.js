const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, methodGuard } = require('../http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();
  const user = requireUser(req);

  const { rows: myPlayers } = await sql`SELECT id FROM players WHERE user_id = ${user.sub} AND status = 'active'`;
  const myIds = myPlayers.map((p) => p.id);
  if (myIds.length === 0) {
    res.status(200).json({ incoming: [], outgoing: [] });
    return;
  }

  const { rows: incoming } = await sql`
    SELECT tr.id, tr.status, tr.created_at, tr.to_player_id,
           f.first_name AS from_first_name, f.last_name AS from_last_name, f.division AS from_division
    FROM team_requests tr
    JOIN players f ON f.id = tr.from_player_id
    WHERE tr.to_player_id = ANY(${myIds}) AND tr.status = 'pending'
    ORDER BY tr.created_at DESC
  `;
  const { rows: outgoing } = await sql`
    SELECT tr.id, tr.status, tr.created_at, tr.from_player_id,
           t.first_name AS to_first_name, t.last_name AS to_last_name, t.division AS to_division
    FROM team_requests tr
    JOIN players t ON t.id = tr.to_player_id
    WHERE tr.from_player_id = ANY(${myIds}) AND tr.status = 'pending'
    ORDER BY tr.created_at DESC
  `;

  res.status(200).json({
    incoming: incoming.map((r) => ({
      id: r.id,
      toPlayerId: r.to_player_id,
      fromName: `${r.from_first_name} ${r.from_last_name}`,
      division: r.from_division,
      createdAt: r.created_at,
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      fromPlayerId: r.from_player_id,
      toName: `${r.to_first_name} ${r.to_last_name}`,
      division: r.to_division,
      createdAt: r.created_at,
    })),
  });
});
