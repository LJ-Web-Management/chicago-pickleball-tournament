requireLogin();
let players = [];
let currentSettings = null;

async function load() {
  const el = document.getElementById('playersList');
  try {
    const data = await Api.get('/players');
    players = data.players;
    if (players.length === 0) { el.innerHTML = '<p class="muted">Add players under Player Info first.</p>'; return; }
    el.innerHTML = players.map((p) => `
      <label style="display:flex; align-items:center; gap:8px; font-size:1rem; color:inherit;">
        <input type="checkbox" class="payCheck" value="${p.id}" ${p.paid ? 'checked disabled' : ''} />
        ${p.first_name} ${p.last_name} -- ${Branding.divisionLabel(currentSettings, p.division)}
        <span class="badge ${p.paid ? 'win' : 'pending'}">${p.paid ? 'Paid' : 'Unpaid'}</span>
      </label>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

document.getElementById('payBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('payError');
  const noticeEl = document.getElementById('payNotice');
  clearError(errEl);
  noticeEl.hidden = true;
  const ids = Array.from(document.querySelectorAll('.payCheck:checked:not(:disabled)')).map((c) => Number(c.value));
  if (ids.length === 0) { showError(errEl, new Error('Select at least one unpaid player')); return; }
  try {
    const data = await Api.post('/payment/create-session', { playerIds: ids });
    if (data.enabled) {
      if (data.url) { window.location.href = data.url; return; }
      noticeEl.textContent = 'All selected players are already paid.';
      noticeEl.hidden = false;
    } else {
      noticeEl.textContent = `${data.message} (Amount due: $${(data.amountDueCents / 100).toFixed(2)})`;
      noticeEl.hidden = false;
    }
  } catch (err) {
    showError(errEl, err);
  }
});

(async () => {
  currentSettings = await Branding.init('feePayment');
  if (!currentSettings) return;
  const fee = (currentSettings.registrationFeeCents / 100).toFixed(2);
  document.getElementById('feeNote').textContent = `Registration fee: $${fee} per player.`;
  load();
})();
