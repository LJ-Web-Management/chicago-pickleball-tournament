const { sql, ensureSchema } = require('../../lib/db');
const { withHandler, methodGuard } = require('../../lib/http');
const { DIVISION_ORDER } = require('../../config/tournament');

module.exports = withHandler(async (req, res) => {
  methodGuard(req, ['GET']);
  await ensureSchema();

  const { rows } = await sql`
    SELECT p.id, p.first_name, p.last_name, p.division, p.team_id, t.team_number,
           partner.first_name AS partner_first_name, partner.last_name AS partner_last_name
    FROM players p
    LEFT JOIN teams t ON t.id = p.team_id
    LEFT JOIN players partner ON partner.team_id = p.team_id AND partner.id <> p.id AND partner.status = 'active'
    WHERE p.status = 'active'
  `;

  const order = Object.fromEntries(DIVISION_ORDER.map((d, i) => [d, i]));
  rows.sort((a, b) => {
    const divDiff = (order[a.division] ?? 99) - (order[b.division] ?? 99);
    if (divDiff !== 0) return divDiff;
    return a.first_name.localeCompare(b.first_name);
  });

  const players = rows.map((r) => ({
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    division: r.division,
    teamNumber: r.team_number || null,
    hasPartner: !!r.partner_first_name,
    partnerName: r.partner_first_name ? `${r.partner_first_name} ${r.partner_last_name}` : null,
  }));

  res.status(200).json({ players });
});
