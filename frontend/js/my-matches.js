requireLogin();

let myMatches = []; // flat list across divisions/stages, each tagged with .division/.stage

function teamLabel(number, players) {
  if (!number) return 'TBD';
  const names = players && players.length ? ` (${players.join(' & ')})` : '';
  return `Team #${number}${names}`;
}

function matchCardHtml(m) {
  const isTie = !m.winner && !m.is_bye && (m.sets || []).length > 0;
  const winnerBadge = m.winner
    ? `<span class="badge win">Winner: Team #${m.winner}</span>`
    : m.is_bye
    ? '<span class="badge tie">BYE</span>'
    : isTie
    ? '<span class="badge tie">Saved as a tie</span>'
    : '';

  if (m.is_bye) {
    return `
      <div class="match-card">
        <div class="meta">${m.stage === 'round_robin' ? 'Round Robin' : `Elimination -- Round ${m.round}`} &middot; Court ${m.court} &middot; ${m.start_time}</div>
        <div class="teams"><span>${teamLabel(m.team_a || m.team_b, m.team_a_players.length ? m.team_a_players : m.team_b_players)}</span> ${winnerBadge}</div>
      </div>`;
  }

  const currentChoice = m.winner === m.team_a ? 'A' : m.winner === m.team_b ? 'B' : isTie ? 'TIE' : null;

  return `
    <div class="match-card">
      <div class="meta">${m.stage === 'round_robin' ? 'Round Robin' : `Elimination -- Round ${m.round}`} &middot; Court ${m.court} &middot; ${m.start_time}</div>
      <div class="teams"><span>${teamLabel(m.team_a, m.team_a_players)} vs ${teamLabel(m.team_b, m.team_b_players)}</span> ${winnerBadge}</div>
      <div class="set-row">
        <button class="setBtn ${currentChoice === 'A' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="A">Team #${m.team_a} Won</button>
        ${m.stage === 'round_robin' ? `<button class="setBtn ${currentChoice === 'TIE' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="TIE">Tie</button>` : ''}
        <button class="setBtn ${currentChoice === 'B' ? 'chosen' : ''}" data-division="${m.division}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="B">Team #${m.team_b} Won</button>
      </div>
    </div>`;
}

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

async function load() {
  const el = document.getElementById('content');
  el.innerHTML = '<p class="muted">Loading...</p>';
  try {
    const { players } = await Api.get('/players');
    const teamed = players.filter((p) => p.team_number);
    const byDivision = {};
    teamed.forEach((p) => {
      byDivision[p.division] = byDivision[p.division] || new Set();
      byDivision[p.division].add(p.team_number);
    });

    if (Object.keys(byDivision).length === 0) {
      el.innerHTML = '<div class="card"><p class="muted">You do not have a team yet. Once you do, your matches will show up here.</p></div>';
      document.getElementById('exportBtn').hidden = true;
      return;
    }

    myMatches = [];
    for (const [division, teamNumbers] of Object.entries(byDivision)) {
      const data = await Api.get(`/matches?division=${division}`);
      const mine = (m) => teamNumbers.has(m.team_a) || teamNumbers.has(m.team_b);
      data.roundRobin.filter(mine).forEach((m) => myMatches.push({ ...m, division }));
      data.elimination.filter(mine).forEach((m) => myMatches.push({ ...m, division }));
    }

    if (myMatches.length === 0) {
      el.innerHTML = '<div class="card"><p class="muted">No matches found for your team yet.</p></div>';
      document.getElementById('exportBtn').hidden = true;
      return;
    }

    myMatches.sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0) || (a.court ?? 0) - (b.court ?? 0));
    el.innerHTML = `<div class="card">${myMatches.map(matchCardHtml).join('')}</div>`;
    document.getElementById('exportBtn').hidden = false;
    wireButtons();
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadCsv('my-matches.csv', myMatches);
});

(async () => {
  const settings = await Branding.init('myMatches');
  if (!settings) return;
  load();
})();
