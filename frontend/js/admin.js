function showAdminPanel() {
  document.getElementById('loginCard').hidden = true;
  document.getElementById('adminPanel').hidden = false;
  document.getElementById('adminLogoutBtn').hidden = false;
  loadStats();
}

if (Api.getAdminToken()) showAdminPanel();

document.getElementById('adminLoginBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('adminLoginError');
  clearError(errEl);
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value;
  try {
    const data = await Api.post('/admin/login', { username, password });
    Api.setAdminToken(data.token);
    showAdminPanel();
  } catch (err) {
    showError(errEl, err);
  }
});

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  window.location.reload();
});

// ---- Top-level tabs ----
document.querySelectorAll('#adminPanel > .tabs > button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#adminPanel > .tabs > button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    ['stats', 'players', 'matches'].forEach((t) => {
      document.getElementById(`${t}Tab`).hidden = t !== btn.dataset.tab;
    });
    if (btn.dataset.tab === 'players') loadPlayers();
    if (btn.dataset.tab === 'matches') loadMatches();
  });
});

// ---- Stats ----
async function loadStats() {
  const el = document.getElementById('statsContent');
  try {
    const data = await Api.get('/admin/stats', { admin: true });
    el.innerHTML = `
      <p><strong>${data.totalPlayers}</strong> players registered across <strong>${data.totalAccounts}</strong> accounts.</p>
      <table>
        <thead><tr><th>Division</th><th>Players</th><th>Paid</th><th>Teams</th></tr></thead>
        <tbody>
          ${data.divisions
            .map(
              (d) => `<tr><td>${d.label}</td><td>${d.players} / ${d.playerCap}</td><td>${d.playersPaid}</td><td>${d.teams} / ${d.teamCap}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

// ---- Players ----
let allPlayers = [];
async function loadPlayers() {
  const el = document.getElementById('playersContent');
  try {
    const data = await Api.get('/admin/players', { admin: true });
    allPlayers = data.players;
    renderPlayers();
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}
document.getElementById('playerSearch').addEventListener('input', renderPlayers);

function renderPlayers() {
  const el = document.getElementById('playersContent');
  const q = document.getElementById('playerSearch').value.toLowerCase();
  const filtered = allPlayers.filter(
    (p) => `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q)
  );
  if (filtered.length === 0) {
    el.innerHTML = '<p class="muted">No matching players.</p>';
    return;
  }
  el.innerHTML = filtered
    .map(
      (p) => `
    <div class="match-card">
      <div class="teams"><span>${p.first_name} ${p.last_name}</span>
        <span class="badge ${p.status === 'active' ? 'win' : 'tie'}">${p.status}</span></div>
      <div class="meta">${p.email} &middot; ${divisionLabel(p.division)} &middot; Shirt ${p.shirt_size} &middot;
        ${p.team_number ? `Team #${p.team_number}` : 'No team'} &middot; ${p.paid ? 'Paid' : 'Unpaid'}</div>
      <button class="secondary editPlayerBtn" data-id="${p.id}">Edit</button>
    </div>`
    )
    .join('');

  el.querySelectorAll('.editPlayerBtn').forEach((btn) =>
    btn.addEventListener('click', () => editAdminPlayer(Number(btn.dataset.id)))
  );
}

async function editAdminPlayer(id) {
  const p = allPlayers.find((x) => x.id === id);
  const firstName = prompt('First name', p.first_name);
  if (firstName === null) return;
  const lastName = prompt('Last name', p.last_name);
  if (lastName === null) return;
  const shirtSize = prompt('Shirt size', p.shirt_size);
  if (shirtSize === null) return;
  const division = prompt("Division (men/women/kids)", p.division);
  if (division === null) return;
  const paidStr = prompt('Paid? (yes/no)', p.paid ? 'yes' : 'no');
  if (paidStr === null) return;
  const statusStr = prompt('Status (active/rescinded)', p.status);
  if (statusStr === null) return;
  try {
    await Api.put(
      `/admin/players/${id}`,
      { firstName, lastName, shirtSize, division, paid: paidStr.toLowerCase().startsWith('y'), status: statusStr },
      { admin: true }
    );
    loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

// ---- Matches ----
let adminDivision = 'men';
let adminStage = 'round_robin';
let adminMatchData = null;

document.getElementById('matchDivision').addEventListener('change', (e) => {
  adminDivision = e.target.value;
  loadMatches();
});
document.querySelectorAll('#matchesTab .tabs button[data-stage]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#matchesTab .tabs button[data-stage]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    adminStage = btn.dataset.stage;
    renderAdminMatches();
  });
});

document.getElementById('generateBracketBtn').addEventListener('click', () => generateBracket(false));
document.getElementById('regenerateBracketBtn').addEventListener('click', () => {
  if (confirm('This overwrites the existing elimination bracket for this division. Continue?')) generateBracket(true);
});

async function generateBracket(force) {
  try {
    await Api.post('/admin/matches/generate-bracket', { division: adminDivision, force }, { admin: true });
    loadMatches();
  } catch (err) {
    alert(err.message);
  }
}

async function loadMatches() {
  const el = document.getElementById('adminMatchesContent');
  el.innerHTML = '<p class="muted">Loading...</p>';
  try {
    adminMatchData = await Api.get(`/matches?division=${adminDivision}`);
    renderAdminMatches();
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

function renderAdminMatches() {
  const el = document.getElementById('adminMatchesContent');
  const genBtn = document.getElementById('generateBracketBtn');
  const regenBtn = document.getElementById('regenerateBracketBtn');
  if (!adminMatchData) return;

  if (adminStage === 'elimination') {
    genBtn.hidden = adminMatchData.elimination.length > 0;
    regenBtn.hidden = adminMatchData.elimination.length === 0;
  } else {
    genBtn.hidden = true;
    regenBtn.hidden = true;
  }

  const list = adminStage === 'round_robin' ? adminMatchData.roundRobin : adminMatchData.elimination;
  if (list.length === 0) {
    el.innerHTML = '<div class="card"><p class="muted">No matches yet.</p></div>';
    return;
  }
  el.innerHTML = `<div class="card">${list.map(adminMatchCardHtml).join('')}</div>`;
  wireAdminButtons();
}

function adminMatchCardHtml(m) {
  const teamAName = m.team_a ? `Team #${m.team_a}` : 'TBD';
  const teamBName = m.team_b ? `Team #${m.team_b}` : 'TBD';
  const winnerBadge = m.winner ? `<span class="badge win">Winner: Team #${m.winner}</span>` : m.is_bye ? '<span class="badge tie">BYE</span>' : '';

  let setsHtml = '';
  if (!m.is_bye && m.team_a && m.team_b) {
    for (let i = 0; i < 3; i++) {
      const chosen = (m.sets || [])[i];
      setsHtml += `
        <div class="set-row">
          <span>Set ${i + 1}</span>
          <button class="setBtn ${chosen === 'A' ? 'chosen' : ''}" data-stage="${m.stage}" data-key="${m.match_key}" data-index="${i}" data-side="A">${teamAName}</button>
          <button class="setBtn ${chosen === 'B' ? 'chosen' : ''}" data-stage="${m.stage}" data-key="${m.match_key}" data-index="${i}" data-side="B">${teamBName}</button>
        </div>`;
    }
  }

  const canUndo = m.winner !== null && !m.is_bye;
  const canEditTeams = m.stage === 'elimination' && m.winner === null && !m.is_bye;

  return `
    <div class="match-card">
      <div class="meta">${m.stage === 'round_robin' ? `Court ${m.court}` : `Round ${m.round}, Court ${m.court}`} &middot; ${m.start_time}</div>
      <div class="teams"><span>${teamAName} vs ${teamBName}</span> ${winnerBadge}</div>
      ${setsHtml}
      <div style="display:flex; gap:10px; margin-top:8px;">
        ${canUndo ? `<button class="danger undoBtn" data-stage="${m.stage}" data-key="${m.match_key}">Undo Result</button>` : ''}
        ${canEditTeams ? `<button class="secondary setTeamsBtn" data-key="${m.match_key}" data-a="${m.team_a || ''}" data-b="${m.team_b || ''}">Edit Matchup</button>` : ''}
      </div>
    </div>`;
}

function wireAdminButtons() {
  document.querySelectorAll('.setBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { stage, key, index, side } = btn.dataset;
      const list = stage === 'round_robin' ? adminMatchData.roundRobin : adminMatchData.elimination;
      const match = list.find((m) => m.match_key === key);
      const newSets = (match.sets || []).slice(0, Number(index));
      newSets[Number(index)] = side;
      try {
        await Api.post('/matches/result', { division: adminDivision, stage, matchKey: key, sets: newSets }, { admin: true });
        loadMatches();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.querySelectorAll('.undoBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Undo this result?')) return;
      try {
        await Api.post('/admin/matches/undo', { division: adminDivision, stage: btn.dataset.stage, matchKey: btn.dataset.key }, { admin: true });
        loadMatches();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  document.querySelectorAll('.setTeamsBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const teamA = prompt('Team A number (blank = TBD)', btn.dataset.a);
      if (teamA === null) return;
      const teamB = prompt('Team B number (blank = TBD)', btn.dataset.b);
      if (teamB === null) return;
      try {
        await Api.post(
          '/admin/matches/set-teams',
          { division: adminDivision, matchKey: btn.dataset.key, teamA: teamA ? Number(teamA) : null, teamB: teamB ? Number(teamB) : null },
          { admin: true }
        );
        loadMatches();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}
