requireLogin();

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', 'XXL'];
let currentSettings = null;

function label(divisionKey) {
  return Branding.divisionLabel(currentSettings, divisionKey);
}

async function loadPlayers() {
  const listEl = document.getElementById('playersList');
  try {
    const data = await Api.get('/players');
    if (data.players.length === 0) {
      listEl.innerHTML = '<p class="muted">No players added yet.</p>';
      return;
    }
    listEl.innerHTML = '';
    data.players.forEach((p) => {
      const div = document.createElement('div');
      div.className = 'match-card';
      div.innerHTML = `
        <div class="teams">
          <span>${p.first_name} ${p.last_name}</span>
          <span class="badge ${p.paid ? 'win' : 'pending'}">${p.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div class="meta">${label(p.division)} &middot; Shirt: ${p.shirt_size} &middot;
          ${p.team_number ? `Team #${p.team_number}` : 'No team yet'}</div>
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="secondary editBtn" data-id="${p.id}" data-first="${p.first_name}" data-last="${p.last_name}" data-shirt="${p.shirt_size}">Edit</button>
          <button class="danger rescindBtn" data-id="${p.id}" data-paid="${p.paid}">Rescind Registration</button>
        </div>
      `;
      listEl.appendChild(div);
    });

    listEl.querySelectorAll('.editBtn').forEach((btn) =>
      btn.addEventListener('click', () => editPlayer(btn.dataset))
    );
    listEl.querySelectorAll('.rescindBtn').forEach((btn) =>
      btn.addEventListener('click', () => rescindPlayer(btn.dataset.id, btn.dataset.paid === 'true'))
    );
  } catch (err) {
    listEl.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

async function editPlayer(dataset) {
  const firstName = prompt('First name', dataset.first);
  if (firstName === null) return;
  const lastName = prompt('Last name', dataset.last);
  if (lastName === null) return;
  const shirtSize = prompt(`Shirt size (${SHIRT_SIZES.join('/')})`, dataset.shirt);
  if (shirtSize === null) return;
  try {
    await Api.put(`/players/${dataset.id}`, { firstName, lastName, shirtSize });
    loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

async function rescindPlayer(id, paid) {
  if (!confirm('Are you sure you want to rescind this registration? This cannot be undone from the app.')) return;
  try {
    const data = await Api.post(`/players/${id}/rescind`);
    if (data.refundNote) alert(data.refundNote);
    loadPlayers();
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('addBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('addError');
  const noticeEl = document.getElementById('addNotice');
  clearError(errEl);
  noticeEl.hidden = true;
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const shirtSize = document.getElementById('shirtSize').value;
  const division = document.getElementById('division').value;
  if (!firstName || !lastName) {
    showError(errEl, new Error('First and last name are required'));
    return;
  }
  try {
    await Api.post('/players', { firstName, lastName, shirtSize, division });
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    noticeEl.textContent = 'Player added!';
    noticeEl.hidden = false;
    loadPlayers();
  } catch (err) {
    showError(errEl, err);
  }
});

(async () => {
  currentSettings = await Branding.init('playerInfo');
  if (!currentSettings) return;

  const shirtSelect = document.getElementById('shirtSize');
  SHIRT_SIZES.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    shirtSelect.appendChild(opt);
  });

  const divisionSelect = document.getElementById('division');
  divisionSelect.innerHTML = currentSettings.divisionOrder
    .map((key) => `<option value="${key}">${label(key)}</option>`)
    .join('');

  loadPlayers();
})();
