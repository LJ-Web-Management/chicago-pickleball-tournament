const { sql } = require('./db');
const { teamNumbersForPool, buildRoundRobinSchedule, addMinutes } = require('./schedule');
const { HttpError } = require('./http');

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard tournament bracket seeding order, e.g. seedOrder(8) = [1,8,4,5,2,7,3,6]
function seedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const len = order.length * 2;
    const next = [];
    for (const s of order) {
      next.push(s);
      next.push(len + 1 - s);
    }
    order = next;
  }
  return order;
}

function setResult(sets) {
  const aWins = sets.filter((s) => s === 'A').length;
  const bWins = sets.filter((s) => s === 'B').length;
  let winnerSide = null;
  if (aWins > bWins) winnerSide = 'A';
  else if (bWins > aWins) winnerSide = 'B';
  return { aWins, bWins, winnerSide };
}

// Combines the pure round-robin schedule template with whatever results
// have been recorded in the DB so far.
async function getRoundRobinMatches(divisionKey, settings) {
  const template = buildRoundRobinSchedule(divisionKey, settings);
  const { rows } = await sql`
    SELECT match_key, sets, winner, updated_at FROM matches
    WHERE division = ${divisionKey} AND stage = 'round_robin'
  `;
  const byKey = Object.fromEntries(rows.map((r) => [r.match_key, r]));
  return template.map((m) => {
    const recorded = byKey[m.match_key];
    return {
      ...m,
      sets: recorded ? recorded.sets : [],
      winner: recorded ? recorded.winner : null,
      updated_at: recorded ? recorded.updated_at : null,
    };
  });
}

// Standings per pool: [{ team_number, wins, losses, ties, points, setDiff }]
async function computeStandings(divisionKey, settings) {
  const div = settings.divisions[divisionKey];
  const { rows: teamRows } = await sql`SELECT team_number FROM teams WHERE division = ${divisionKey}`;
  const existingTeams = new Set(teamRows.map((t) => t.team_number));
  const matches = await getRoundRobinMatches(divisionKey, settings);

  const pools = [];
  for (let poolIndex = 0; poolIndex < div.courts; poolIndex++) {
    const teamNumbers = teamNumbersForPool(div, poolIndex).filter((t) => existingTeams.has(t));
    const stats = Object.fromEntries(
      teamNumbers.map((t) => [t, { team_number: t, wins: 0, losses: 0, ties: 0, points: 0, setDiff: 0, played: 0 }])
    );
    matches
      .filter((m) => m.pool_index === poolIndex && m.sets.length > 0)
      .forEach((m) => {
        const { aWins, bWins, winnerSide } = setResult(m.sets);
        if (!stats[m.team_a] || !stats[m.team_b]) return; // team not registered
        stats[m.team_a].played += 1;
        stats[m.team_b].played += 1;
        stats[m.team_a].setDiff += aWins - bWins;
        stats[m.team_b].setDiff += bWins - aWins;
        if (winnerSide === 'A') {
          stats[m.team_a].wins += 1;
          stats[m.team_a].points += 2;
          stats[m.team_b].losses += 1;
        } else if (winnerSide === 'B') {
          stats[m.team_b].wins += 1;
          stats[m.team_b].points += 2;
          stats[m.team_a].losses += 1;
        } else {
          stats[m.team_a].ties += 1;
          stats[m.team_b].ties += 1;
          stats[m.team_a].points += 1;
          stats[m.team_b].points += 1;
        }
      });
    const ranked = Object.values(stats).sort(
      (a, b) => b.points - a.points || b.setDiff - a.setDiff || a.team_number - b.team_number
    );
    pools.push({ poolIndex, court: poolIndex + 1, standings: ranked });
  }
  return pools;
}

// Builds bracket match descriptors in-memory (not yet persisted).
function buildBracketMatches(divisionKey, seededTeamNumbers, settings) {
  const div = settings.divisions[divisionKey];
  const n = seededTeamNumbers.length;
  const size = nextPow2(n);
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);

  const matches = [];
  for (let round = 1; round <= totalRounds; round++) {
    const matchesThisRound = size / Math.pow(2, round);
    for (let i = 0; i < matchesThisRound; i++) {
      const match_key = `${divisionKey}-el-r${round}-m${i}`;
      let team_a = null;
      let team_b = null;
      if (round === 1) {
        const seedA = order[i * 2];
        const seedB = order[i * 2 + 1];
        team_a = seedA <= n ? seededTeamNumbers[seedA - 1] : null;
        team_b = seedB <= n ? seededTeamNumbers[seedB - 1] : null;
      }
      const feeds_match_key = round < totalRounds ? `${divisionKey}-el-r${round + 1}-m${Math.floor(i / 2)}` : null;
      const feeds_slot = i % 2 === 0 ? 'a' : 'b';
      matches.push({ round, matchIndexInRound: i, match_key, team_a, team_b, feeds_match_key, feeds_slot });
    }
  }

  // Assign courts/slots round by round, chunked by number of courts.
  let slotCursor = 0;
  for (let round = 1; round <= totalRounds; round++) {
    const roundMatches = matches.filter((m) => m.round === round);
    roundMatches.forEach((m, idx) => {
      const chunk = Math.floor(idx / div.courts);
      m.slot_index = slotCursor + chunk;
      m.court = (idx % div.courts) + 1;
      m.start_time = addMinutes(settings.eliminationStart, m.slot_index * settings.matchSlotMinutes);
    });
    const chunks = Math.ceil(roundMatches.length / div.courts);
    slotCursor += chunks;
  }

  // Mark byes: round 1 matches where exactly one side is null.
  matches.forEach((m) => {
    if (m.round === 1 && (m.team_a === null) !== (m.team_b === null)) {
      m.is_bye = true;
      m.winner = m.team_a ?? m.team_b;
    } else {
      m.is_bye = false;
      m.winner = null;
    }
  });

  return matches;
}

async function upsertMatch(divisionKey, m) {
  await sql`
    INSERT INTO matches (division, stage, match_key, round, court, slot_index, team_a, team_b, sets, winner, is_bye, feeds_match_key, feeds_slot, updated_at)
    VALUES (${divisionKey}, 'elimination', ${m.match_key}, ${m.round}, ${m.court}, ${m.slot_index}, ${m.team_a}, ${m.team_b}, '[]', ${m.winner}, ${m.is_bye}, ${m.feeds_match_key}, ${m.feeds_slot}, now())
    ON CONFLICT (division, stage, match_key) DO UPDATE SET
      round = EXCLUDED.round, court = EXCLUDED.court, slot_index = EXCLUDED.slot_index,
      team_a = EXCLUDED.team_a, team_b = EXCLUDED.team_b, is_bye = EXCLUDED.is_bye,
      feeds_match_key = EXCLUDED.feeds_match_key, feeds_slot = EXCLUDED.feeds_slot
  `;
}

async function propagateWinner(divisionKey, matchKey) {
  const { rows } = await sql`SELECT * FROM matches WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${matchKey}`;
  const match = rows[0];
  if (!match || match.winner === null || !match.feeds_match_key) return;
  const field = match.feeds_slot === 'a' ? 'team_a' : 'team_b';
  if (field === 'a') {
    await sql`UPDATE matches SET team_a = ${match.winner} WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${match.feeds_match_key}`;
  } else {
    await sql`UPDATE matches SET team_b = ${match.winner} WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${match.feeds_match_key}`;
  }
  // If the destination match is itself a fully-formed bye-less pairing that now
  // has a bye because it never got its other side, nothing more to do here --
  // a normal match just waits for both sides to be filled and played.
}

async function generateBracket(divisionKey, force, settings) {
  const { rows: existing } = await sql`SELECT COUNT(*)::int AS c FROM matches WHERE division = ${divisionKey} AND stage = 'elimination'`;
  if (existing[0].c > 0 && !force) {
    throw new HttpError(409, 'Elimination bracket already generated for this division. Pass force=true to regenerate.');
  }
  if (force) {
    await sql`DELETE FROM matches WHERE division = ${divisionKey} AND stage = 'elimination'`;
  }

  const pools = await computeStandings(divisionKey, settings);
  const advance = settings.advancePerPool;
  const winners = pools.map((p) => p.standings[0]).filter(Boolean);
  const runnerUps = pools.map((p) => p.standings[1]).filter(Boolean);
  // extra ranks (3rd, 4th...) only matter if advancePerPool > 2, handled generically:
  const others = [];
  if (advance > 2) {
    for (let rank = 2; rank < advance; rank++) {
      pools.forEach((p) => p.standings[rank] && others.push(p.standings[rank]));
    }
  }
  const rankGroup = (group) => group.sort((a, b) => b.points - a.points || b.setDiff - a.setDiff || a.team_number - b.team_number);
  const seededTeamNumbers = [...rankGroup(winners), ...rankGroup(runnerUps), ...rankGroup(others)].map((s) => s.team_number);

  if (seededTeamNumbers.length < 2) {
    throw new HttpError(400, 'Not enough teams with recorded standings to generate a bracket yet.');
  }

  const matches = buildBracketMatches(divisionKey, seededTeamNumbers, settings);
  for (const m of matches) {
    await upsertMatch(divisionKey, m);
  }
  for (const m of matches) {
    if (m.is_bye) await propagateWinner(divisionKey, m.match_key);
  }
  return getEliminationMatches(divisionKey);
}

async function getEliminationMatches(divisionKey) {
  const { rows } = await sql`
    SELECT * FROM matches WHERE division = ${divisionKey} AND stage = 'elimination' ORDER BY round ASC, slot_index ASC, court ASC
  `;
  return rows;
}

async function recordResult(divisionKey, stage, matchKey, sets, updatedBy, settings) {
  const { aWins, bWins, winnerSide } = setResult(sets);

  if (stage === 'elimination') {
    const { rows } = await sql`SELECT * FROM matches WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${matchKey}`;
    const existing = rows[0];
    if (!existing) throw new HttpError(404, 'Match not found -- has the elimination bracket been generated yet?');
    if (existing.is_bye) throw new HttpError(400, 'This match is a bye and has no result to record.');
    if (!existing.team_a || !existing.team_b) throw new HttpError(400, 'Both teams for this match are not yet determined.');
    if (aWins === bWins && sets.length >= 2) {
      throw new HttpError(400, 'Elimination matches cannot end tied -- play a 3rd set as a single-point tiebreaker.');
    }
    const winner = winnerSide === 'A' ? existing.team_a : winnerSide === 'B' ? existing.team_b : null;
    await sql`
      UPDATE matches SET sets = ${JSON.stringify(sets)}, winner = ${winner}, updated_by = ${updatedBy}, updated_at = now()
      WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${matchKey}
    `;
    if (winner !== null) await propagateWinner(divisionKey, matchKey);
    return { match_key: matchKey, winner, sets };
  }

  // round_robin: upsert, since these are computed on the fly and not pre-inserted
  const template = buildRoundRobinSchedule(divisionKey, settings).find((m) => m.match_key === matchKey);
  if (!template) throw new HttpError(404, 'Unknown round-robin match');
  const winner = winnerSide === 'A' ? template.team_a : winnerSide === 'B' ? template.team_b : null;
  await sql`
    INSERT INTO matches (division, stage, match_key, round, court, slot_index, team_a, team_b, sets, winner, updated_by, updated_at)
    VALUES (${divisionKey}, 'round_robin', ${matchKey}, ${template.round}, ${template.court}, ${template.slot_index}, ${template.team_a}, ${template.team_b}, ${JSON.stringify(sets)}, ${winner}, ${updatedBy}, now())
    ON CONFLICT (division, stage, match_key) DO UPDATE SET sets = ${JSON.stringify(sets)}, winner = ${winner}, updated_by = ${updatedBy}, updated_at = now()
  `;
  return { match_key: matchKey, winner, sets };
}

async function clearPropagation(divisionKey, feedsMatchKey, feedsSlot) {
  const { rows } = await sql`SELECT * FROM matches WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${feedsMatchKey}`;
  const dest = rows[0];
  if (!dest) return;
  const hadWinner = dest.winner !== null;
  const field = feedsSlot === 'a' ? 'team_a' : 'team_b';
  if (field === 'a') {
    await sql`UPDATE matches SET team_a = NULL, sets = ${hadWinner ? '[]' : dest.sets}, winner = ${hadWinner ? null : dest.winner} WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${feedsMatchKey}`;
  } else {
    await sql`UPDATE matches SET team_b = NULL, sets = ${hadWinner ? '[]' : dest.sets}, winner = ${hadWinner ? null : dest.winner} WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${feedsMatchKey}`;
  }
  if (hadWinner && dest.feeds_match_key) {
    await clearPropagation(divisionKey, dest.feeds_match_key, dest.feeds_slot);
  }
}

async function undoResult(divisionKey, stage, matchKey) {
  if (stage === 'round_robin') {
    await sql`UPDATE matches SET sets = '[]', winner = NULL WHERE division = ${divisionKey} AND stage = 'round_robin' AND match_key = ${matchKey}`;
    return;
  }
  const { rows } = await sql`SELECT * FROM matches WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${matchKey}`;
  const match = rows[0];
  if (!match) throw new HttpError(404, 'Match not found');
  if (match.is_bye) throw new HttpError(400, 'Cannot undo a bye.');
  const hadWinner = match.winner !== null;
  await sql`UPDATE matches SET sets = '[]', winner = NULL WHERE division = ${divisionKey} AND stage = 'elimination' AND match_key = ${matchKey}`;
  if (hadWinner && match.feeds_match_key) {
    await clearPropagation(divisionKey, match.feeds_match_key, match.feeds_slot);
  }
}

module.exports = {
  nextPow2,
  seedOrder,
  setResult,
  getRoundRobinMatches,
  computeStandings,
  buildBracketMatches,
  generateBracket,
  getEliminationMatches,
  recordResult,
  undoResult,
};
