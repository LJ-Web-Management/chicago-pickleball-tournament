# Chicago Pickleball Doubles Tournament

Full-stack tournament app: **frontend on GitHub Pages**, **backend on Vercel** (Node serverless functions + Postgres).

- **Live site**: https://lj-web-management.github.io/chicago-pickleball-tournament/
- **Repo**: https://github.com/LJ-Web-Management/chicago-pickleball-tournament

- 3 divisions: Men's (24 teams / 6 courts), Women's (16 teams / 4 courts), Kids (8 teams / 2 courts) -- always 4 teams per court.
- 4-hour round robin (pools of 4 per court, full round robin within the pool) followed by a 4-hour standard single-elimination bracket, both auto-scheduled in 30-minute slots.
- Email/password accounts that can hold multiple players; team requests ("friend requests"), random assignment, auto-assigned team numbers.
- Player list, player info management (add/edit/rescind), fee payment (Stripe, wire up later), and an admin panel.

All schedule structure lives in code ([config/tournament.js](config/tournament.js), [lib/schedule.js](lib/schedule.js), [lib/bracket.js](lib/bracket.js)) so the database only ever stores people, teams, and results -- not the schedule itself.

## How the scheduling works

- **Round robin**: every division's `teams / courts` ratio is exactly 4, so each court hosts one pool of 4 teams playing a full round robin (6 matches) across the 8 available 30-minute slots (2 slots spare as buffer). Pool membership is a pure function of team number (`(team_number - 1) % courts`), so the whole round-robin schedule is computed on the fly -- nothing to generate or store.
- **Elimination**: after round robin, an admin clicks "Generate Elimination Bracket" for a division. The server ranks each pool (points, then set differential, then team number), takes the top 2 from every pool, and seeds them into a standard single-elimination bracket (byes auto-assigned to the top seeds when the team count isn't a power of 2). This *is* persisted, since it depends on results, and winners automatically propagate to the next round as results come in.
- **Set entry**: click which team won each set. Round robin ties are allowed. In elimination, if the first two sets split 1-1, the app requires a 3rd set (a single-point tiebreaker) before a winner is recorded.

## Repo layout

```
api/        Vercel serverless functions (the backend)
lib/        Shared backend logic: db, auth, scheduling, bracket engine
config/     Hardcoded tournament structure (divisions, courts, fees, etc.)
frontend/   Static site deployed to GitHub Pages
.github/workflows/pages.yml   Auto-deploys frontend/ to GitHub Pages on push
```

## One-time setup

### 1. Attach a Postgres database (Vercel dashboard)

1. Import this repo into Vercel (New Project -> pick this GitHub repo).
2. In the project, go to **Storage -> Create Database -> Postgres** (Neon). Accept the defaults and connect it to the project.
3. This automatically sets `DATABASE_URL` / `POSTGRES_URL` env vars for you -- no manual copy/paste needed.

### 2. Set environment variables (Vercel dashboard -> Settings -> Environment Variables)

| Variable | Value |
|---|---|
| `JWT_SECRET` | A long random string (e.g. run `openssl rand -hex 32`) |
| `ADMIN_USERNAME` | `admin52` |
| `ADMIN_PASSWORD` | `admin53` |
| `FRONTEND_ORIGIN` | `https://lj-web-management.github.io` |
| `STRIPE_SECRET_KEY` | (leave blank until Stripe is ready) |
| `STRIPE_WEBHOOK_SECRET` | (leave blank until Stripe is ready) |

Redeploy after setting these (Vercel does this automatically on save, or push a commit).

### 3. Point the frontend at your backend

Edit [frontend/js/config.js](frontend/js/config.js) and set `apiBase` to your Vercel deployment URL + `/api`, e.g.:

```js
apiBase: 'https://chicago-pickleball-tournament.vercel.app/api',
```

Commit and push -- GitHub Actions redeploys the Pages site automatically.

### 4. GitHub Pages (already on)

Pages is already enabled with **Source: GitHub Actions**. The included workflow ([.github/workflows/pages.yml](.github/workflows/pages.yml)) deploys `frontend/` on every push to `main` -- nothing to do here unless you fork/rename the repo.

## Admin panel

Go to `admin.html` on the deployed site. Log in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set above (defaults to `admin52` / `admin53`). From there you can:

- View registration counts/caps and payment status per division
- Edit any player's info (name, shirt size, division, paid flag, active/rescinded status)
- Override any match result, undo a result (automatically un-propagates it from the elimination bracket if needed)
- Manually correct an elimination matchup before it's been played
- Generate/regenerate the elimination bracket for a division

## Registration caps

Enforced server-side: 48 men's players (24 teams), 32 women's players (16 teams), 16 kids players (8 teams). Once a division's player cap is hit, new signups for that division are rejected until admin opens it up (edit `config/tournament.js` and redeploy, or free up a slot by rescinding/editing existing players).

## Stripe (added later)

The fee-payment page and `/api/payment/create-session` endpoint are fully wired to Stripe Checkout -- they just no-op with a friendly message until `STRIPE_SECRET_KEY` is set. Once you have Stripe keys:

1. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL` in Vercel.
2. Add a Stripe webhook pointing at `<your-vercel-url>/api/payment/webhook` for the `checkout.session.completed` event.

## Local development

```bash
npm install
npm run dev   # requires the Vercel CLI (npm i -g vercel) and `vercel link`
```

Open `frontend/index.html` directly in a browser (or serve it with any static server) and point `frontend/js/config.js` at `http://localhost:3000/api`.
