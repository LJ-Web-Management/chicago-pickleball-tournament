const { DIVISIONS, TOURNAMENT } = require('../config/tournament');

// Standard round-robin "circle method": returns rounds of disjoint pairs
// (0-indexed positions), each team appearing at most once per round so
// rest is spread out evenly when matches are played sequentially on court.
function roundRobinRounds(n) {
  const arr = [...Array(n).keys()];
  if (n % 2 !== 0) arr.push(-1); // bye slot, shouldn't happen (pool sizes are even)
  const m = arr.length;
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

function poolIndexForTeam(teamNumber, courts) {
  return (teamNumber - 1) % courts;
}

// Deterministic from config alone: which team numbers belong in a given pool.
function teamNumbersForPool(divisionKey, poolIndex) {
  const div = DIVISIONS[divisionKey];
  const numbers = [];
  for (let t = 1; t <= div.teams; t++) {
    if (poolIndexForTeam(t, div.courts) === poolIndex) numbers.push(t);
  }
  return numbers;
}

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Fully computed from config + team numbers -- no DB needed for the
// round-robin structure itself. Returns a flat list of match descriptors.
function buildRoundRobinSchedule(divisionKey) {
  const div = DIVISIONS[divisionKey];
  const rounds = roundRobinRounds(div.poolSize);
  const flatPairs = []; // [[posA,posB], ...] in play order
  rounds.forEach((pairs) => pairs.forEach((pair) => flatPairs.push(pair)));

  const matches = [];
  for (let poolIndex = 0; poolIndex < div.courts; poolIndex++) {
    const teamNumbers = teamNumbersForPool(divisionKey, poolIndex);
    flatPairs.forEach(([posA, posB], matchIndex) => {
      const slotIndex = matchIndex; // one match per slot per court
      matches.push({
        division: divisionKey,
        stage: 'round_robin',
        match_key: `${divisionKey}-rr-p${poolIndex}-m${matchIndex}`,
        round: Math.floor(matchIndex / (div.poolSize / 2)) + 1,
        pool_index: poolIndex,
        court: poolIndex + 1,
        slot_index: slotIndex,
        start_time: addMinutes(TOURNAMENT.roundRobinStart, slotIndex * TOURNAMENT.matchSlotMinutes),
        team_a: teamNumbers[posA],
        team_b: teamNumbers[posB],
      });
    });
  }
  return matches;
}

module.exports = {
  roundRobinRounds,
  poolIndexForTeam,
  teamNumbersForPool,
  buildRoundRobinSchedule,
  addMinutes,
};
