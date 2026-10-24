// Guarded replacement of the imported sheet data in the live database.
// Re-importing wipes admin edits to sheet entries (hidden flags, merged names, fixed proofs)
// and gives them new ids, so this asks for confirmation and takes a backup first.
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const PHRASE = "replace live sheet data";

if (!process.stdin.isTTY) {
  console.error("Refusing to run without an interactive terminal.");
  process.exit(1);
}

console.log(`
This REPLACES every sheet-imported entry in the LIVE database with seed/import.sql.
Scores submitted on the website are kept, but admin changes to imported entries
(hidden entries, merged names, edited scores or proofs) are lost.
A backup of the whole database is saved to backups/ first.
`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`Type "${PHRASE}" to continue: `);
rl.close();
if (answer.trim() !== PHRASE) {
  console.log("Cancelled, nothing changed.");
  process.exit(1);
}

const wrangler = (...args) => {
  const res = spawnSync("npx", ["wrangler", ...args], { stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`wrangler ${args[0]} ${args[1]} failed; stopping.`);
    process.exit(res.status ?? 1);
  }
};

mkdirSync("backups", { recursive: true });
const backup = `backups/tta-challenges-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
wrangler("d1", "export", "tta-challenges", "--remote", `--output=${backup}`);
console.log(`Backup saved to ${backup}`);
wrangler("d1", "execute", "tta-challenges", "--remote", "--file=seed/import.sql");
console.log("Done. Restore with: npx wrangler d1 execute tta-challenges --remote --file=" + backup);
