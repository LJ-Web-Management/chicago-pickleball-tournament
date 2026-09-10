// Thin wrapper around the GitHub Contents API. Used so admin-editable but
// rarely-changing data (tournament settings, the rules PDF) lives as a
// versioned file in the repo instead of a database row/table.
const { HttpError } = require('./http');

function repoInfo() {
  const repo = process.env.GITHUB_REPO || 'LJ-Web-Management/chicago-pickleball-tournament';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token = process.env.GITHUB_TOKEN;
  return { repo, branch, token };
}

function rawUrl(path) {
  const { repo, branch } = repoInfo();
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
}

async function readFile(path) {
  const res = await fetch(rawUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub raw fetch failed for ${path}: ${res.status}`);
  return res;
}

async function writeFile(path, base64Content, message) {
  const { repo, branch, token } = repoInfo();
  if (!token) {
    throw new HttpError(500, 'GITHUB_TOKEN is not configured -- cannot save this to the repo.');
  }
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'chicago-pickleball-tournament-app',
    Accept: 'application/vnd.github+json',
  };

  const getRes = await fetch(`${apiUrl}?ref=${branch}`, { headers });
  let sha;
  if (getRes.status === 200) {
    sha = (await getRes.json()).sha;
  } else if (getRes.status !== 404) {
    throw new HttpError(502, `GitHub lookup failed for ${path}: ${getRes.status}`);
  }

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: base64Content, sha, branch }),
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new HttpError(502, `GitHub commit failed for ${path}: ${putRes.status} ${text.slice(0, 300)}`);
  }
  return putRes.json();
}

module.exports = { readFile, writeFile, repoInfo };
