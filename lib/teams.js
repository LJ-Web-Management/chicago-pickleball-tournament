const { sql } = require('./db');
const { HttpError } = require('./http');
const { DIVISIONS, teamCap } = require('../config/tournament');
const { poolIndexForTeam } = require('./schedule');

// Forms a team from two unteamed players, assigning the next sequential
// team number for the division. Tournament-scale traffic is low enough that
// we accept the small race window here rather than adding transaction
// plumbing on top of @vercel/postgres's pooled tagged-template client.
async function formTeam(divisionKey, playerIdA, playerIdB) {
  const div = DIVISIONS[divisionKey];
  const { rows: countRows } = await sql`SELECT COUNT(*)::int AS c FROM teams WHERE division = ${divisionKey}`;
  if (countRows[0].c >= teamCap(divisionKey)) {
    throw new HttpError(409, `Team cap reached for the ${div.label} division`);
  }

  const { rows: counterRows } = await sql`
    INSERT INTO team_counters (division, next_number) VALUES (${divisionKey}, 2)
    ON CONFLICT (division) DO UPDATE SET next_number = team_counters.next_number + 1
    RETURNING next_number - 1 AS assigned
  `;
  const teamNumber = counterRows[0].assigned;
  const poolIndex = poolIndexForTeam(teamNumber, div.courts);

  const { rows: teamRows } = await sql`
    INSERT INTO teams (division, team_number, pool_index) VALUES (${divisionKey}, ${teamNumber}, ${poolIndex})
    RETURNING id, team_number
  `;
  const team = teamRows[0];

  await sql`UPDATE players SET team_id = ${team.id} WHERE id IN (${playerIdA}, ${playerIdB})`;
  await sql`
    UPDATE team_requests SET status = 'cancelled', resolved_at = now()
    WHERE status = 'pending' AND (from_player_id IN (${playerIdA}, ${playerIdB}) OR to_player_id IN (${playerIdA}, ${playerIdB}))
  `;
  await sql`UPDATE players SET random_opt_in = false WHERE id IN (${playerIdA}, ${playerIdB})`;

  return { teamId: team.id, teamNumber: team.team_number };
}

module.exports = { formTeam };
