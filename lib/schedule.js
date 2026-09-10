const { poolSize } = require('./settings');

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

// Deterministic from settings alone: which team numbers belong in a given pool.
function teamNumbersForPool(division, poolIndex) {
  const numbers = [];
  for (let t = 1; t <= division.teams; t++) {
    if (poolIndexForTeam(t, division.courts) === poolIndex) numbers.push(t);
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

// Fully computed from settings + team numbers -- no DB needed for the
// round-robin structure itself. Returns a flat list of match descriptors.
function buildRoundRobinSchedule(divisionKey, settings) {
  const div = settings.divisions[divisionKey];
  const size = poolSize(div);
  const rounds = roundRobinRounds(size);
  const flatPairs = []; // [[posA,posB], ...] in play order
  rounds.forEach((pairs) => pairs.forEach((pair) => flatPairs.push(pair)));

  const matches = [];
  for (let poolIndex = 0; poolIndex < div.courts; poolIndex++) {
    const teamNumbers = teamNumbersForPool(div, poolIndex);
    flatPairs.forEach(([posA, posB], matchIndex) => {
      const slotIndex = matchIndex; // one match per slot per court
      matches.push({
        division: divisionKey,
        stage: 'round_robin',
        match_key: `${divisionKey}-rr-p${poolIndex}-m${matchIndex}`,
        round: Math.floor(matchIndex / (size / 2)) + 1,
        pool_index: poolIndex,
        court: poolIndex + 1,
        slot_index: slotIndex,
        start_time: addMinutes(settings.roundRobinStart, slotIndex * settings.matchSlotMinutes),
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
