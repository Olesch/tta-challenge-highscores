# TtA Challenge Highscores

Scoreboard for the challenges of the *Through the Ages* app. Replaces the Google Sheet + Form.

- Anyone can submit their domination (final score minus the second-place score), no accounts. An entry with a Discord message link (from the TtA server) counts as **verified**;
  without one it is saved but only shown under "All entries".
- Anyone can download all entries as CSV or JSON (footer of every page).
- **Rating** = each best domination as a % of the record, averaged over all 97 challenges (unplayed = 0%).
- Negative dominations (lost games) are accepted and ranked, but count as 0 in sums, pooled totals and ratings.
- Entries flagged as **bug** (e.g. the Final Mix scores from a since-fixed game bug) stay listed but never count
  for records, ranks, ratings or totals. Toggle the flag on the admin page.
- Submitting shows a review step first (new records, personal bests, likely typos, reused proof links).
- Challenge and player links show a preview card in Discord (Open Graph tags added by the Worker).
- Pages: highscores (with pooled and best-single-player totals), challenge rankings, players, player profile,
  compare two players, submit, weekly-challenge winners (history), admin.

Stack: one Cloudflare Worker (serves the Preact frontend and a small `/api`) + a D1 database. Fits the free plan.

## Everyday: change something and put it live

Needs [Node.js](https://nodejs.org) (LTS) and git. On a new computer, once:

```bash
git clone <this repository>
cd "Challenges TTA"
npm install
npx wrangler login
game-files.bat
```

`game-files.bat` recreates the challenge data and pictures from your installed game (see *Game files* below).

Then for every change:

1. Try it locally with `npm run dev` and open http://localhost:5173 (uses a local test database, see below).
2. Double-click **`deploy.bat`** (or run `npm run deploy`). It backs up the live database, applies any new
   migrations, builds and uploads. The site is live a few seconds later at
   https://tta-challenges.olesch.workers.dev.
3. Commit: `git add -A` and `git commit -m "what changed"`.

If the build stops with a TypeScript error, the message names the file and line; nothing was uploaded.
A database change goes into a new numbered file in `migrations/` (e.g. `0004_something.sql`);
`deploy.bat` applies it to the live database before uploading the code.

To undo a bad deploy: `npx wrangler rollback` (puts the previous version back), or check out the old commit and
deploy again.

## Develop (local test database)

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

## Game files (not in git)

The challenge texts and pictures belong to Czech Games Edition, so they are not stored in git. They are
generated from an installed copy of the game (Steam or GOG) and must exist before building or deploying:

```bash
game-files.bat "D:\Games\GOG\Through the Ages"
```

Without an argument it uses `D:/Games/GOG/Through the Ages` (or the `TTA_GAME_DIR` environment variable).
It needs Python 3 and installs `pyyaml` and `pillow` if they are missing. It writes:

- `data/challenges.json` — the 97 challenges (names, rules, opponents, difficulty), from the scenario files
- `public/img/challenges/` — challenge pictures, cut from `Atlases/scenarios_jpeg.jpg`
- `public/img/groups/` — group backgrounds

Run it again after a game update that changes challenges. The two scripts behind it,
`tools/extract_challenges.py` and `tools/extract_images.py`, can also be run separately.

## Data in git

- `public/img/examples/` — the two example screenshots on the submit page (our own screenshots)
- `seed/import.sql`, `data/weekly.json` — generated from the old sheet (download as .xlsx):
  `python tools/import_sheet.py sheet.xlsx`

The sheet import also needs `pip install openpyxl`.

## Admin

Set the password once (it is stored as an encrypted Cloudflare secret and can't be read back):

```bash
npx wrangler secret put ADMIN_TOKEN
```

Run it again to change it. Keep the password in your password manager. Then open `/admin` and enter it.
You can mark verified entries as checked once you have looked at their Discord proof (private, reset when the
proof link changes), hide entries (cheats, mistakes), mark entries as bug, edit a domination or proof link, merge two player
names, and filter for flagged entries (unproven scores over 2× everyone else's best, proof links used by two players).

## License

The code is released under the [MIT License](LICENSE). This does not cover *Through the Ages* itself: the
challenge texts and pictures belong to Czech Games Edition and are not part of this repository (see
*Game files*). The submitted results in `seed/` and `data/weekly.json` were collected by the TtA community.
