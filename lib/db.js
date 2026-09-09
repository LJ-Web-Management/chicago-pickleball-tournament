const { neon } = require('@neondatabase/serverless');

let sqlInstance = null;
function getSqlInstance() {
  if (!sqlInstance) {
    const conn = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!conn) {
      throw new Error(
        'No database connection string found. Attach a Postgres database to this Vercel project (Storage tab) so DATABASE_URL/POSTGRES_URL is set.'
      );
    }
    sqlInstance = neon(conn);
  }
  return sqlInstance;
}
// Thin proxy so every file can keep using the `sql\`...\`` tagged-template
// call site without each one worrying about lazy connection-string lookup.
function sql(strings, ...values) {
  return getSqlInstance()(strings, ...values);
}

let schemaReady = null;

// Vercel serverless functions are stateless per cold start, so we lazily
// ensure the schema exists instead of running a separate migration step.
async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS team_counters (
        division TEXT PRIMARY KEY,
        next_number INTEGER NOT NULL DEFAULT 1
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        division TEXT NOT NULL,
        team_number INTEGER NOT NULL,
        pool_index INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(division, team_number)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        shirt_size TEXT NOT NULL,
        division TEXT NOT NULL,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        random_opt_in BOOLEAN NOT NULL DEFAULT false,
        paid BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'active', -- active | rescinded
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS team_requests (
        id SERIAL PRIMARY KEY,
        from_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        to_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        resolved_at TIMESTAMPTZ
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        division TEXT NOT NULL,
        stage TEXT NOT NULL, -- round_robin | elimination
        match_key TEXT NOT NULL, -- stable key computed from schedule/bracket structure
        round INTEGER NOT NULL DEFAULT 1,
        court INTEGER,
        slot_index INTEGER,
        team_a INTEGER,
        team_b INTEGER,
        sets JSONB NOT NULL DEFAULT '[]', -- e.g. ["A","B","A"]
        winner INTEGER,
        is_bye BOOLEAN NOT NULL DEFAULT false,
        feeds_match_key TEXT, -- which elimination match_key the winner advances to
        feeds_slot TEXT, -- 'a' or 'b' slot in the destination match
        updated_by TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(division, stage, match_key)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | refund_requested
        stripe_session_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
  })();
  return schemaReady;
}

module.exports = { sql, ensureSchema };
