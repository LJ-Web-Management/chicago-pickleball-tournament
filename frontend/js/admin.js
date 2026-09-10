let currentSettings = null;

function divisionLabel(key) {
  return Branding.divisionLabel(currentSettings, key);
}

async function showAdminPanel() {
  document.getElementById('adminLogoutBtn').hidden = false;
  currentSettings = await Api.get('/settings');
  document.getElementById('loginCard').hidden = true;
  document.getElementById('adminPanel').hidden = false;
  populateDivisionDropdown();
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
const TABS = ['stats', 'players', 'matches', 'settings'];
document.querySelectorAll('#adminPanel > .tabs > button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#adminPanel > .tabs > button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    TABS.forEach((t) => {
      document.getElementById(`${t}Tab`).hidden = t !== btn.dataset.tab;
    });
    if (btn.dataset.tab === 'players') loadPlayers();
    if (btn.dataset.tab === 'matches') loadMatches();
    if (btn.dataset.tab === 'settings') renderSettingsForm();
  });
});

function populateDivisionDropdown() {
  const select = document.getElementById('matchDivision');
  select.innerHTML = currentSettings.divisionOrder.map((key) => `<option value="${key}">${divisionLabel(key)}</option>`).join('');
  adminDivision = currentSettings.divisionOrder[0];
}

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
      <div style="display:flex; gap:10px; margin-top:8px;">
        <button class="secondary editPlayerBtn" data-id="${p.id}">Edit</button>
        <button class="${p.paid ? 'secondary' : 'primary'} markPaidBtn" data-id="${p.id}" data-paid="${p.paid}">${p.paid ? 'Mark Unpaid' : 'Mark Paid'}</button>
      </div>
    </div>`
    )
    .join('');

  el.querySelectorAll('.editPlayerBtn').forEach((btn) =>
    btn.addEventListener('click', () => editAdminPlayer(Number(btn.dataset.id)))
  );
  el.querySelectorAll('.markPaidBtn').forEach((btn) =>
    btn.addEventListener('click', () => togglePaid(Number(btn.dataset.id), btn.dataset.paid !== 'true'))
  );
}

async function togglePaid(id, paid) {
  try {
    await Api.put(`/admin/players/${id}`, { paid }, { admin: true });
    loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

async function editAdminPlayer(id) {
  const p = allPlayers.find((x) => x.id === id);
  const firstName = prompt('First name', p.first_name);
  if (firstName === null) return;
  const lastName = prompt('Last name', p.last_name);
  if (lastName === null) return;
  const shirtSize = prompt('Shirt size', p.shirt_size);
  if (shirtSize === null) return;
  const division = prompt(`Division (${currentSettings.divisionOrder.join('/')})`, p.division);
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
let adminDivision = null;
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
document.getElementById('exportMatchesBtn').addEventListener('click', () => {
  if (!adminMatchData) return;
  const list = adminStage === 'round_robin' ? adminMatchData.roundRobin : adminMatchData.elimination;
  downloadCsv(`${adminDivision}-${adminStage}-schedule.csv`, list);
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
  const isTie = !m.winner && !m.is_bye && (m.sets || []).length > 0;
  const winnerBadge = m.winner
    ? `<span class="badge win">Winner: Team #${m.winner}</span>`
    : m.is_bye
    ? '<span class="badge tie">BYE</span>'
    : isTie
    ? '<span class="badge tie">Saved as a tie</span>'
    : '';

  let setsHtml = '';
  if (!m.is_bye && m.team_a && m.team_b) {
    const currentChoice = m.winner === m.team_a ? 'A' : m.winner === m.team_b ? 'B' : isTie ? 'TIE' : null;
    setsHtml = `
      <div class="set-row">
        <button class="setBtn ${currentChoice === 'A' ? 'chosen' : ''}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="A">${teamAName} Won</button>
        ${m.stage === 'round_robin' ? `<button class="setBtn ${currentChoice === 'TIE' ? 'chosen' : ''}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="TIE">Tie</button>` : ''}
        <button class="setBtn ${currentChoice === 'B' ? 'chosen' : ''}" data-stage="${m.stage}" data-key="${m.match_key}" data-choice="B">${teamBName} Won</button>
      </div>`;
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

function setsForChoice(choice) {
  if (choice === 'A') return ['A', 'A'];
  if (choice === 'B') return ['B', 'B'];
  return ['A', 'B']; // TIE
}

function wireAdminButtons() {
  document.querySelectorAll('.setBtn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { stage, key, choice } = btn.dataset;
      try {
        await Api.post('/matches/result', { division: adminDivision, stage, matchKey: key, sets: setsForChoice(choice) }, { admin: true });
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

// ---- Settings ----
const PAGE_LABELS = {
  matchTimings: 'Match Timings',
  myMatches: 'My Matches',
  playerInfo: 'Player Info',
  teamSelection: 'Team Selection',
  feePayment: 'Fee Payment',
  playerList: 'Player List',
};

function renderSettingsForm() {
  document.getElementById('setEventTitle').value = currentSettings.eventTitle;
  document.getElementById('setFee').value = (currentSettings.registrationFeeCents / 100).toFixed(2);
  document.getElementById('setSlotMinutes').value = currentSettings.matchSlotMinutes;
  document.getElementById('setRRStart').value = currentSettings.roundRobinStart;
  document.getElementById('setElimStart').value = currentSettings.eliminationStart;
  document.getElementById('setAdvance').value = currentSettings.advancePerPool;

  const divEl = document.getElementById('divisionSettings');
  divEl.innerHTML = currentSettings.divisionOrder
    .map((key) => {
      const d = currentSettings.divisions[key];
      return `
        <div style="border:1px solid var(--border); border-radius:8px; padding:10px; margin-bottom:10px;">
          <strong>${key}</strong>
          <label>Label</label>
          <input class="divLabel" data-key="${key}" value="${d.label}" />
          <label>Teams</label>
          <input class="divTeams" data-key="${key}" type="number" min="1" step="1" value="${d.teams}" />
          <label>Courts</label>
          <input class="divCourts" data-key="${key}" type="number" min="1" step="1" value="${d.courts}" />
        </div>`;
    })
    .join('');

  const pagesEl = document.getElementById('pageSettings');
  pagesEl.innerHTML = Object.keys(currentSettings.pages)
    .map(
      (key) => `
      <label style="display:flex; align-items:center; gap:8px; font-size:1rem; color:inherit; margin-bottom:6px;">
        <input type="checkbox" class="pageToggle" data-key="${key}" ${currentSettings.pages[key] ? 'checked' : ''} />
        ${PAGE_LABELS[key] || key}
      </label>`
    )
    .join('');

  const rulesStatus = document.getElementById('rulesStatus');
  rulesStatus.textContent = currentSettings.rulesUploadedAt
    ? `Rules document last uploaded ${new Date(currentSettings.rulesUploadedAt).toLocaleString()}.`
    : 'No rules document uploaded yet.';
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('settingsError');
  const noticeEl = document.getElementById('settingsNotice');
  clearError(errEl);
  noticeEl.hidden = true;

  const divisions = {};
  document.querySelectorAll('.divLabel').forEach((input) => {
    const key = input.dataset.key;
    divisions[key] = divisions[key] || {};
    divisions[key].label = input.value.trim();
  });
  document.querySelectorAll('.divTeams').forEach((input) => {
    divisions[input.dataset.key].teams = Number(input.value);
  });
  document.querySelectorAll('.divCourts').forEach((input) => {
    divisions[input.dataset.key].courts = Number(input.value);
  });

  const pages = {};
  document.querySelectorAll('.pageToggle').forEach((input) => {
    pages[input.dataset.key] = input.checked;
  });

  const patch = {
    eventTitle: document.getElementById('setEventTitle').value.trim(),
    registrationFeeCents: Math.round(Number(document.getElementById('setFee').value) * 100),
    matchSlotMinutes: Number(document.getElementById('setSlotMinutes').value),
    roundRobinStart: document.getElementById('setRRStart').value.trim(),
    eliminationStart: document.getElementById('setElimStart').value.trim(),
    advancePerPool: Number(document.getElementById('setAdvance').value),
    divisions,
    pages,
  };

  try {
    currentSettings = await Api.put('/admin/settings', patch, { admin: true });
    populateDivisionDropdown();
    noticeEl.textContent = 'Settings saved.';
    noticeEl.hidden = false;
  } catch (err) {
    showError(errEl, err);
  }
});

document.getElementById('uploadRulesBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('rulesError');
  const noticeEl = document.getElementById('rulesNotice');
  clearError(errEl);
  noticeEl.hidden = true;
  const fileInput = document.getElementById('rulesFile');
  const file = fileInput.files[0];
  if (!file) { showError(errEl, new Error('Choose a PDF file first')); return; }
  if (file.type !== 'application/pdf') { showError(errEl, new Error('File must be a PDF')); return; }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const data = await Api.post('/admin/rules', { base64 }, { admin: true });
    currentSettings.rulesUploadedAt = data.rulesUploadedAt;
    document.getElementById('rulesStatus').textContent = `Rules document last uploaded ${new Date(data.rulesUploadedAt).toLocaleString()}.`;
    noticeEl.textContent = 'Rules document uploaded.';
    noticeEl.hidden = false;
    fileInput.value = '';
  } catch (err) {
    showError(errEl, err);
  }
});
