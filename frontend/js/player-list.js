requireLogin();

async function load(settings) {
  const el = document.getElementById('playerListContent');
  try {
    const data = await Api.get('/players/list');
    if (data.players.length === 0) { el.innerHTML = '<p class="muted">No players registered yet.</p>'; return; }
    let currentDivision = null;
    let html = '';
    data.players.forEach((p) => {
      if (p.division !== currentDivision) {
        currentDivision = p.division;
        if (html) html += '</table>';
        html += `<h2>${Branding.divisionLabel(settings, p.division)}</h2><table><thead><tr><th>Name</th><th>Team #</th><th>Partner</th></tr></thead><tbody>`;
      }
      html += `<tr><td>${p.firstName} ${p.lastName}</td><td>${p.teamNumber || '--'}</td><td>${p.hasPartner ? p.partnerName : '<span class="muted">no partner yet</span>'}</td></tr>`;
    });
    html += '</table>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

(async () => {
  const settings = await Branding.init('playerList');
  if (!settings) return;
  load(settings);
})();
