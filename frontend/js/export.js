// Client-side CSV export -- the schedule is already loaded in the page (it
// comes from the API, which computes it from settings + results), so this
// just serializes whatever's on screen. No backend endpoint needed.
function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function matchesToCsv(matches) {
  const header = ['Division', 'Stage', 'Round', 'Court', 'Time', 'Team A', 'Team A Players', 'Team B', 'Team B Players', 'Winner'];
  const rows = matches.map((m) => [
    m.division,
    m.stage === 'round_robin' ? 'Round Robin' : 'Elimination',
    m.round,
    m.court,
    m.start_time,
    m.team_a ? `Team #${m.team_a}` : 'TBD',
    (m.team_a_players || []).join(' & '),
    m.team_b ? `Team #${m.team_b}` : 'TBD',
    (m.team_b_players || []).join(' & '),
    m.is_bye ? 'Bye' : m.winner ? `Team #${m.winner}` : '',
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function downloadCsv(filename, matches) {
  const csv = matchesToCsv(matches);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
