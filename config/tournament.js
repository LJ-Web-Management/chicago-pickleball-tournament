// All tournament structure that rarely changes lives here in code,
// so the database only ever stores people and results, not schedule data.

const DIVISIONS = {
  men: {
    key: 'men',
    label: "Men's",
    teams: 24,
    courts: 6,
    poolSize: 4, // teams / courts
  },
  women: {
    key: 'women',
    label: "Women's",
    teams: 16,
    courts: 4,
    poolSize: 4,
  },
  kids: {
    key: 'kids',
    label: 'Kids',
    teams: 8,
    courts: 2,
    poolSize: 4,
  },
};

const DIVISION_ORDER = ['men', 'women', 'kids'];

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', 'XXL'];

const TOURNAMENT = {
  matchSlotMinutes: 30,
  roundRobinSlots: 8, // 4 hours / 30 min
  eliminationSlots: 8, // 4 hours / 30 min
  // Times are informational (used to compute a human-readable start time per slot).
  // Edit these to match actual event start times.
  roundRobinStart: '09:00',
  eliminationStart: '14:00',
  // How many teams advance out of each pool into the elimination bracket.
  advancePerPool: 2,
  // Registration fee per player. Change freely -- picked up on next deploy.
  registrationFeeCents: 4000,
};

function playerCap(divisionKey) {
  return DIVISIONS[divisionKey].teams * 2;
}

function teamCap(divisionKey) {
  return DIVISIONS[divisionKey].teams;
}

module.exports = {
  DIVISIONS,
  DIVISION_ORDER,
  SHIRT_SIZES,
  TOURNAMENT,
  playerCap,
  teamCap,
};
