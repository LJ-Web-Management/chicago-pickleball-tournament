requireLogin();

let currentDivision = null;
let currentStage = 'round_robin';
let cachedData = null;

function wireDivisionTabs() {
  document.querySelectorAll('#divisionTabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#divisionTabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentDivision = btn.dataset.division;
      load();
    });
  });
}
document.querySelectorAll('#stageTabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#stageTabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentStage = btn.dataset.stage;
    render();
  });
});

async function load() {
  const el = document.getElementById('matchesContent');
  el.innerHTML = '<p class="muted">Loading...</p>';
  try {
    cachedData = await Api.get(`/matches?division=${currentDivision}`);
    render();
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

function teamLabel(number, players) {
  if (!number) return 'TBD';
  const names = players && players.length ? ` (${players.join(' & ')})` : '';
  return `Team #${number}${names}`;
}

function render() {
  const el = document.getElementById('matchesContent');
  if (!cachedData) return;

  if (currentStage === 'round_robin') {
    const byCourt = {};
    cachedData.roundRobin.forEach((m) => {
      byCourt[m.court] = byCourt[m.court] || [];
      byCourt[m.court].push(m);
    });
    el.innerHTML = Object.keys(byCourt)
      .sort((a, b) => a - b)
      .map((court) => `
        <div class="card">
          <h2>Court ${court}</h2>
          ${byCourt[court].map((m) => matchCardHtml(m, 'round_robin')).join('')}
        </div>
      `)
      .join('');
  } else {
    if (cachedData.elimination.length === 0) {
      el.innerHTML = '<div class="card"><p class="muted">The elimination bracket hasn\'t been generated yet -- check back once round robin wraps up.</p></div>';
      wireButtons();
      return;
    }
    const byRound = {};
    cachedData.elimination.forEach((m) => {
      byRound[m.round] = byRound[m.round] || [];
      byRound[m.round].push(m);
    });
    el.innerHTML = Object.keys(byRound)
      .sort((a, b) => a - b)
      .map((round) => `
        <div class="card">
          <h2>Round ${round}</h2>
          ${byRound[round].map((m) => matchCardHtml(m, 'elimination')).join('')}
        </div>
      `)
      .join('');
  }
  wireButtons();
}

function matchCardHtml(m, stage) {
  const isTie = !m.winner && !m.is_bye && (m.sets || []).length > 0;
  const winnerBadge = m.winner
    ? `<span class="badge win">Winner: Team #${m.winner}</span>`
    : m.is_bye
    ? '<span class="badge tie">BYE</span>'
    : isTie
    ? '<span class="badge tie">Saved as a tie</span>'
    : '';

  if (stage === 'elimination' && (!m.team_a || !m.team_b) && !m.is_bye) {
    return `
      <div class="match-card">
        <div class="meta">Court ${m.court} &middot; ${m.start_time}</div>
        <div class="teams"><span>${teamLabel(m.team_a, m.team_a_players)} vs ${teamLabel(m.team_b, m.team_b_players)}</span></div>
      </div>`;
  }

  if (m.is_bye) {
    return `
      <div class="match-card">
        <div class="meta">Court ${m.court} &middot; ${m.start_time}</div>
        <div class="teams"><span>${teamLabel(m.team_a || m.team_b, m.team_a_players.length ? m.team_a_players : m.team_b_players)}</span> ${winnerBadge}</div>
      </div>`;
  }

  const currentChoice = m.winner === m.team_a ? 'A' : m.winner === m.team_b ? 'B' : isTie ? 'TIE' : null;

  return `
    <div class="match-card">
      <div class="meta">Court ${m.court} &middot; ${m.start_time}</div>
      <div class="teams"><span>${teamLabel(m.team_a, m.team_a_players)} vs ${teamLabel(m.team_b, m.team_b_players)}</span> ${winnerBadge}</div>
      <div class="set-row">
        <button class="setBtn ${currentChoice === 'A' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${stage}" data-key="${m.match_key}" data-choice="A">Team #${m.team_a} Won</button>
        ${stage === 'round_robin' ? `<button class="setBtn ${currentChoice === 'TIE' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${stage}" data-key="${m.match_key}" data-choice="TIE">Tie</button>` : ''}
        <button class="setBtn ${currentChoice === 'B' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${stage}" data-key="${m.match_key}" data-choice="B">Team #${m.team_b} Won</button>
      </div>
    </div>`;
}

// Sends the minimal `sets` payload that produces the chosen outcome --
// the backend still tracks results as sets, but the UI only ever asks for
// a direct winner (or a tie, where that's allowed) rather than set-by-set.
function setsForChoice(choice) {
  if (choice === 'A') return ['A', 'A'];
  if (choice === 'B') return ['B', 'B'];
  return ['A', 'B']; // TIE
}

function wireButtons() {
  document.querySelectorAll('.setBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { division, stage, key, choice } = btn.dataset;
      try {
        await Api.post('/matches/result', { division, stage, matchKey: key, sets: setsForChoice(choice) });
        await load();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!cachedData) return;
  const matches = currentStage === 'round_robin' ? cachedData.roundRobin : cachedData.elimination;
  downloadCsv(`${currentDivision}-${currentStage}-schedule.csv`, matches);
});

(async () => {
  const settings = await Branding.init('matchTimings');
  if (!settings) return;

  const tabsEl = document.getElementById('divisionTabs');
  tabsEl.innerHTML = settings.divisionOrder
    .map((key, i) => `<button data-division="${key}" class="${i === 0 ? 'active' : ''}">${Branding.divisionLabel(settings, key)}</button>`)
    .join('');
  currentDivision = settings.divisionOrder[0];
  wireDivisionTabs();

  load();
})();
