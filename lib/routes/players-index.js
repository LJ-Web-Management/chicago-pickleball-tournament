const { sql, ensureSchema } = require('../db');
const { requireUser } = require('../auth');
const { withHandler, HttpError, methodGuard } = require('../http');
const { DIVISIONS, SHIRT_SIZES, playerCap } = require('../../config/tournament');

module.exports = withHandler(async (req, res) => {
  await ensureSchema();

  if (req.method === 'GET') {
    const user = requireUser(req);
    const { rows } = await sql`
      SELECT p.id, p.first_name, p.last_name, p.shirt_size, p.division, p.paid, p.status, p.random_opt_in,
             p.team_id, t.team_number
      FROM players p
      LEFT JOIN teams t ON t.id = p.team_id
      WHERE p.user_id = ${user.sub} AND p.status = 'active'
      ORDER BY p.created_at ASC
    `;
    res.status(200).json({ players: rows });
    return;
  }

  if (req.method === 'POST') {
    const user = requireUser(req);
    const { firstName, lastName, shirtSize, division } = req.body || {};
    if (!firstName || !lastName || !shirtSize || !division) {
      throw new HttpError(400, 'firstName, lastName, shirtSize, and division are required');
    }
    if (!DIVISIONS[division]) throw new HttpError(400, 'Invalid division');
    if (!SHIRT_SIZES.includes(shirtSize)) throw new HttpError(400, 'Invalid shirt size');

    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int AS c FROM players WHERE division = ${division} AND status = 'active'
    `;
    if (countRows[0].c >= playerCap(division)) {
      throw new HttpError(409, `Registration is full for the ${DIVISIONS[division].label} division`);
    }

    const { rows } = await sql`
      INSERT INTO players (user_id, first_name, last_name, shirt_size, division)
      VALUES (${user.sub}, ${firstName.trim()}, ${lastName.trim()}, ${shirtSize}, ${division})
      RETURNING id, first_name, last_name, shirt_size, division, paid, status
    `;
    res.status(201).json({ player: rows[0] });
    return;
  }

  methodGuard(req, ['GET', 'POST']);
});
