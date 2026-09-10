requireLogin();

const tabFind = document.getElementById('tabFind');
const tabRequests = document.getElementById('tabRequests');
const findPanel = document.getElementById('findPanel');
const requestsPanel = document.getElementById('requestsPanel');

tabFind.addEventListener('click', () => {
  tabFind.classList.add('active');
  tabRequests.classList.remove('active');
  findPanel.hidden = false;
  requestsPanel.hidden = true;
});
tabRequests.addEventListener('click', () => {
  tabRequests.classList.add('active');
  tabFind.classList.remove('active');
  requestsPanel.hidden = false;
  findPanel.hidden = true;
  loadRequests();
});

let myPlayers = [];
let selectedPlayer = null;

async function loadMyPlayers() {
  const select = document.getElementById('myPlayerSelect');
  const errEl = document.getElementById('findError');
  try {
    const data = await Api.get('/players');
    myPlayers = data.players.filter((p) => !p.team_id);
    if (myPlayers.length === 0) {
      select.innerHTML = '<option value="">No unteamed players -- add one under Player Info</option>';
      return;
    }
    select.innerHTML = myPlayers
      .map((p) => `<option value="${p.id}">${p.first_name} ${p.last_name} (${divisionLabel(p.division)})</option>`)
      .join('');
    selectedPlayer = myPlayers[0];
    select.addEventListener('change', () => {
      selectedPlayer = myPlayers.find((p) => p.id === Number(select.value));
      document.getElementById('searchResults').innerHTML = '';
      refreshRandomStatus();
    });
    refreshRandomStatus();
  } catch (err) {
    showError(errEl, err);
  }
}

function refreshRandomStatus() {
  const el = document.getElementById('randomStatus');
  const btn = document.getElementById('randomBtn');
  if (selectedPlayer && selectedPlayer.random_opt_in) {
    el.textContent = 'Waiting for a random match...';
    el.hidden = false;
    btn.textContent = 'Cancel Random Assignment';
  } else {
    el.hidden = true;
    btn.textContent = 'Opt In to Random Assignment';
  }
}

document.getElementById('randomBtn').addEventListener('click', async () => {
  if (!selectedPlayer) return;
  try {
    const optIn = !selectedPlayer.random_opt_in;
    const data = await Api.post('/teams/random', { playerId: selectedPlayer.id, optIn });
    if (data.status === 'team_formed') {
      alert(`Team formed! Team #${data.team.teamNumber}`);
    }
    await loadMyPlayers();
  } catch (err) {
    alert(err.message);
  }
});

let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(e.target.value), 300);
});

async function runSearch(q) {
  const resultsEl = document.getElementById('searchResults');
  if (!selectedPlayer) {
    resultsEl.innerHTML = '<p class="muted">Select one of your players first.</p>';
    return;
  }
  try {
    const data = await Api.get(`/players/available?division=${selectedPlayer.division}&q=${encodeURIComponent(q)}`);
    const others = data.players.filter((p) => p.id !== selectedPlayer.id);
    if (others.length === 0) {
      resultsEl.innerHTML = '<p class="muted">No unteamed players found.</p>';
      return;
    }
    resultsEl.innerHTML = others
      .map(
        (p) => `
      <div class="match-card">
        <div class="teams"><span>${p.firstName} ${p.lastName}${p.randomOptIn ? ' <span class="badge win">random opt-in</span>' : ''}</span></div>
        <button class="primary requestBtn" data-id="${p.id}">Send Team Request</button>
      </div>`
      )
      .join('');
    resultsEl.querySelectorAll('.requestBtn').forEach((btn) =>
      btn.addEventListener('click', () => sendRequest(btn.dataset.id))
    );
  } catch (err) {
    resultsEl.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

async function sendRequest(toPlayerId) {
  try {
    const data = await Api.post('/teams/request', { fromPlayerId: selectedPlayer.id, toPlayerId: Number(toPlayerId) });
    if (data.status === 'team_formed') {
      alert(`Team formed! Team #${data.team.teamNumber}`);
      loadMyPlayers();
    } else {
      alert('Request sent!');
    }
  } catch (err) {
    alert(err.message);
  }
}

async function loadRequests() {
  const incEl = document.getElementById('incomingList');
  const outEl = document.getElementById('outgoingList');
  try {
    const data = await Api.get('/teams/requests');
    incEl.innerHTML = data.incoming.length
      ? data.incoming
          .map(
            (r) => `
        <div class="match-card">
          <div class="teams"><span>${r.fromName} (${divisionLabel(r.division)})</span></div>
          <div style="display:flex; gap:10px;">
            <button class="primary acceptBtn" data-id="${r.id}">Accept</button>
            <button class="danger rejectBtn" data-id="${r.id}">Reject</button>
          </div>
        </div>`
          )
          .join('')
      : '<p class="muted">No incoming requests.</p>';

    outEl.innerHTML = data.outgoing.length
      ? data.outgoing
          .map(
            (r) => `<div class="match-card"><div class="teams"><span>${r.toName} (${divisionLabel(r.division)})</span><span class="badge pending">pending</span></div></div>`
          )
          .join('')
      : '<p class="muted">No outgoing requests.</p>';

    incEl.querySelectorAll('.acceptBtn').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try {
          const data = await Api.post(`/teams/requests/${btn.dataset.id}/accept`);
          alert(`Team formed! Team #${data.team.teamNumber}`);
          loadRequests();
        } catch (err) {
          alert(err.message);
        }
      })
    );
    incEl.querySelectorAll('.rejectBtn').forEach((btn) =>
      btn.addEventListener('click', async () => {
        try {
          await Api.post(`/teams/requests/${btn.dataset.id}/reject`);
          loadRequests();
        } catch (err) {
          alert(err.message);
        }
      })
    );
  } catch (err) {
    incEl.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

(async () => {
  const settings = await Branding.init('teamSelection');
  if (!settings) return;
  divisionLabel = (key) => Branding.divisionLabel(settings, key);
  loadMyPlayers();
})();
