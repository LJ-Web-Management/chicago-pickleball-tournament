// Tournament settings (division sizes/courts, fee, event title, which pages
// are enabled, etc.) live in config/settings.json in the repo rather than a
// database table -- this data changes rarely, and keeping it as a versioned
// file is what "move this app to a different tournament" should mean: edit
// a handful of numbers/labels, not touch code. Admin edits commit the file
// back to GitHub; every request reads the current value with a short cache
// so changes show up quickly without needing a full redeploy.
const DEFAULT_SETTINGS = require('../config/settings.json');
const { readFile, writeFile } = require('./github');
const { HttpError } = require('./http');

const TTL_MS = 20000;
let cache = null; // { value, fetchedAt }

async function getSettings() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.value;
  try {
    const content = await readFile('config/settings.json');
    const value = JSON.parse(content);
    cache = { value, fetchedAt: Date.now() };
    return value;
  } catch (err) {
    if (cache) return cache.value; // serve the last known-good value on a transient failure
    return DEFAULT_SETTINGS;
  }
}

function validateSettings(s) {
  if (!s || typeof s !== 'object') throw new HttpError(400, 'Settings must be an object');
  if (!s.eventTitle || typeof s.eventTitle !== 'string') throw new HttpError(400, 'eventTitle is required');
  if (!Number.isInteger(s.registrationFeeCents) || s.registrationFeeCents < 0) {
    throw new HttpError(400, 'registrationFeeCents must be a non-negative integer');
  }
  if (!Number.isInteger(s.matchSlotMinutes) || s.matchSlotMinutes <= 0) {
    throw new HttpError(400, 'matchSlotMinutes must be a positive integer');
  }
  if (!/^\d{2}:\d{2}$/.test(s.roundRobinStart || '') || !/^\d{2}:\d{2}$/.test(s.eliminationStart || '')) {
    throw new HttpError(400, 'roundRobinStart/eliminationStart must be HH:MM');
  }
  if (!Number.isInteger(s.advancePerPool) || s.advancePerPool < 1) {
    throw new HttpError(400, 'advancePerPool must be a positive integer');
  }
  if (!s.divisions || typeof s.divisions !== 'object') throw new HttpError(400, 'divisions is required');
  for (const [key, div] of Object.entries(s.divisions)) {
    if (!div.label || typeof div.label !== 'string') throw new HttpError(400, `${key}.label is required`);
    if (!Number.isInteger(div.teams) || div.teams <= 0) throw new HttpError(400, `${key}.teams must be a positive integer`);
    if (!Number.isInteger(div.courts) || div.courts <= 0) throw new HttpError(400, `${key}.courts must be a positive integer`);
    if (div.teams % div.courts !== 0) {
      throw new HttpError(400, `${key}: teams (${div.teams}) must divide evenly by courts (${div.courts}) so every court gets an equal-size pool`);
    }
  }
  if (!Array.isArray(s.divisionOrder) || s.divisionOrder.length !== Object.keys(s.divisions).length) {
    throw new HttpError(400, 'divisionOrder must list every division key');
  }
  if (!s.pages || typeof s.pages !== 'object') throw new HttpError(400, 'pages is required');
}

async function updateSettings(patch, actor) {
  const current = await getSettings();
  const next = { ...current, ...patch, rulesUploadedAt: current.rulesUploadedAt };
  validateSettings(next);
  const content = Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64');
  await writeFile('config/settings.json', content, `Update tournament settings (${actor})`);
  cache = { value: next, fetchedAt: Date.now() };
  return next;
}

async function markRulesUploaded(actor) {
  const current = await getSettings();
  const next = { ...current, rulesUploadedAt: new Date().toISOString() };
  const content = Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64');
  await writeFile('config/settings.json', content, `Record rules document upload (${actor})`);
  cache = { value: next, fetchedAt: Date.now() };
  return next;
}

function poolSize(division) {
  return division.teams / division.courts;
}

function playerCap(settings, divisionKey) {
  return settings.divisions[divisionKey].teams * 2;
}

function teamCap(settings, divisionKey) {
  return settings.divisions[divisionKey].teams;
}

module.exports = { getSettings, updateSettings, markRulesUploaded, validateSettings, poolSize, playerCap, teamCap, DEFAULT_SETTINGS };
