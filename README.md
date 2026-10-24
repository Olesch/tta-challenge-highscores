# TtA Challenge Highscores

Scoreboard for the challenges of the *Through the Ages* app. Replaces the Google Sheet + Form.

- Anyone can submit scores, no accounts. A score with a Discord message link (from the TtA server) counts as **verified**;
  without one it is saved but only shown under "All scores".
- Anyone can download all scores as CSV or JSON (footer of every page).
- Pages: highscores (with pooled and best-single-player totals), challenge rankings, players, player profile,
  compare two players, submit, weekly-challenge winners (history), admin.

Stack: one Cloudflare Worker (serves the Preact frontend and a small `/api`) + a D1 database. Fits the free plan.

## Develop

```bash
npm install
npm run db:migrate:local
npm run db:import:local
npm run dev
```

`.dev.vars` holds the local admin password (`ADMIN_TOKEN`).

## Deploy (first time)

```bash
npx wrangler login
npx wrangler d1 create tta-challenges
```

Paste the printed `database_id` into `wrangler.jsonc`, then:

```bash
npm run db:migrate:remote
npm run db:import:remote
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

Optional spam protection: create a Turnstile widget in the Cloudflare dashboard, put its site key in
`TURNSTILE_SITE_KEY` (wrangler.jsonc) and its secret with `npx wrangler secret put TURNSTILE_SECRET`.

`db:import:remote` replaces every entry that came from the sheet, which undoes admin edits to them.
It asks you to type a confirmation phrase and saves a backup to `backups/` first.

Backups: `npm run db:backup:remote` saves the live database to `backups/tta-challenges-latest.sql`.
Restore one with `npx wrangler d1 execute tta-challenges --remote --file=backups/<file>.sql`.

## Data

- `data/challenges.json` — the 97 challenges, generated from the game files:
  `python tools/extract_challenges.py "D:/Games/GOG/Through the Ages"`
- `public/img/` — challenge pictures and group backgrounds, cut from the game's atlas:
  `python tools/extract_images.py "D:/Games/GOG/Through the Ages"`
- `seed/import.sql`, `data/weekly.json` — generated from the old sheet (download as .xlsx):
  `python tools/import_sheet.py sheet.xlsx`

The Python tools need `pip install pyyaml pillow openpyxl`.

## Admin

Open `/admin` and enter `ADMIN_TOKEN`. You can hide entries (cheats, mistakes), edit a score or proof link,
and merge two player names (e.g. typos like "Wawrzienic" → "Wawrzyniec").
