const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { DIVISIONS } = require('../../config/tournament');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();
  requireUser(req);

  const { division, q } = req.query;
  if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');

  const search = q ? `%${String(q).toLowerCase()}%` : '%';
  const { rows } = await sql`
    SELECT id, first_name, last_name, random_opt_in
    FROM players
    WHERE division = ${division} AND status = 'active' AND team_id IS NULL
      AND (LOWER(first_name) LIKE ${search} OR LOWER(last_name) LIKE ${search})
    ORDER BY first_name ASC
  `;
  res.status(200).json({
    players: rows.map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      randomOptIn: r.random_opt_in,
    })),
  });
});
