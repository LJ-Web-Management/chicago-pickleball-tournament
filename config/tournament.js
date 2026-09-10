// Truly fixed, never-adjusted-per-tournament values live here. Everything
// that an admin might reasonably want to change when reusing this app for a
// different event (division sizes/courts, fee, event title, which pages are
// enabled) lives in config/settings.json instead -- see lib/settings.js.

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', 'XXL'];

module.exports = { SHIRT_SIZES };
