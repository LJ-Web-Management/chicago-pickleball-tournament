const { sql, ensureSchema } = require('../../../lib/db');
const { requireAdmin } = require('../../../lib/auth');
const { withHandler, methodGuard } = require('../../../lib/http');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();
  requireAdmin(req);

  const { rows } = await sql`
    SELECT p.id, p.first_name, p.last_name, p.shirt_size, p.division, p.paid, p.status,
           p.random_opt_in, t.team_number, u.email
    FROM players p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN teams t ON t.id = p.team_id
    ORDER BY p.division ASC, p.first_name ASC
  `;
  res.status(200).json({ players: rows });
});
