requireLogin();

let currentDivision = 'men';
let currentStage = 'round_robin';
let cachedData = null;

document.querySelectorAll('#divisionTabs button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#divisionTabs button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentDivision = btn.dataset.division;
    load();
  });
});
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
  const winnerBadge = m.winner
    ? `<span class="badge win">Winner: Team #${m.winner}</span>`
    : m.is_bye
    ? '<span class="badge tie">BYE</span>'
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

  const sets = m.sets || [];
  const showTieHint = stage === 'elimination' && sets.length >= 2 && sets[0] !== sets[1];
  const rowsToShow = showTieHint || sets.length >= 2 ? 3 : sets.length + 1;

  let setsHtml = '';
  for (let i = 0; i < Math.min(rowsToShow, 3); i++) {
    const chosen = sets[i];
    const label = stage === 'elimination' && i === 2 && sets[0] !== sets[1] ? 'Tiebreak' : `Set ${i + 1}`;
    setsHtml += `
      <div class="set-row">
        <span>${label}</span>
        <button class="setBtn ${chosen === 'A' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${stage}" data-key="${m.match_key}" data-index="${i}" data-side="A">Team #${m.team_a}</button>
        <button class="setBtn ${chosen === 'B' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${stage}" data-key="${m.match_key}" data-index="${i}" data-side="B">Team #${m.team_b}</button>
      </div>`;
  }

  return `
    <div class="match-card">
      <div class="meta">Court ${m.court} &middot; ${m.start_time}</div>
      <div class="teams"><span>${teamLabel(m.team_a, m.team_a_players)} vs ${teamLabel(m.team_b, m.team_b_players)}</span> ${winnerBadge}</div>
      ${setsHtml}
    </div>`;
}

function wireButtons() {
  document.querySelectorAll('.setBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { division, stage, key, index, side } = btn.dataset;
      const match = (stage === 'round_robin' ? cachedData.roundRobin : cachedData.elimination).find((m) => m.match_key === key);
      const newSets = (match.sets || []).slice(0, Number(index));
      newSets[Number(index)] = side;
      try {
        await Api.post('/matches/result', { division, stage, matchKey: key, sets: newSets });
        await load();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

load();
