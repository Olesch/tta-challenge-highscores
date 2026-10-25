import type { Entry } from "../shared/api";
import { CHALLENGES, CHALLENGE_BY_ID, SETS } from "../shared/challenges";
import { countedScore, playerKey } from "../shared/validation";

/**
 * Link previews (Open Graph tags) for Discord and other chat apps: they read these tags
 * from the HTML, which the single-page app can't provide on its own.
 * Uses the official numbers: verified, non-bugged entries only.
 */
interface Preview {
  title: string;
  description: string;
  image: string;
  largeImage: boolean;
}

const SITE = "TtA Challenge Highscores";

function officialBests(entries: Entry[]): Map<string, Map<string, { player: string; score: number }>> {
  // challenge -> player key -> best
  const bests = new Map<string, Map<string, { player: string; score: number }>>();
  for (const e of entries) {
    if (e.b || !e.u) continue;
    if (!bests.has(e.c)) bests.set(e.c, new Map());
    const byPlayer = bests.get(e.c)!;
    const key = playerKey(e.p);
    if (!byPlayer.has(key) || e.s > byPlayer.get(key)!.score) byPlayer.set(key, { player: e.p, score: e.s });
  }
  return bests;
}

function topOf(byPlayer: Map<string, { player: string; score: number }> | undefined) {
  if (!byPlayer) return null;
  let top: { player: string; score: number } | null = null;
  for (const b of byPlayer.values()) if (!top || b.score > top.score) top = b;
  return top;
}

function challengePreview(id: string, entries: Entry[], origin: string): Preview | null {
  const c = CHALLENGE_BY_ID.get(id);
  if (!c) return null;
  const byPlayer = officialBests(entries).get(id);
  const top = topOf(byPlayer);
  const set = SETS.find((s) => s.id === c.set)!.label;
  const record = top ? `Record: ${top.score} by ${top.player}` : "No verified record yet";
  const players = byPlayer?.size ?? 0;
  return {
    title: `${c.name} (${set})`,
    description: `${record} · ${players} verified ${players === 1 ? "player" : "players"} · ${c.players} players, difficulty ${c.difficulty}/6. ${c.rules[c.rules.length - 1] ?? ""}`,
    image: `${origin}/img/challenges/${c.id}.jpg`,
    largeImage: false,
  };
}

function playerPreview(name: string, entries: Entry[], origin: string): Preview | null {
  const key = playerKey(name);
  const own = entries.filter((e) => playerKey(e.p) === key);
  if (own.length === 0) return null;
  const displayName = own[own.length - 1].p;
  const bests = officialBests(entries);
  let played = 0;
  let records = 0;
  let pctSum = 0;
  for (const [, byPlayer] of bests) {
    const mine = byPlayer.get(key);
    if (!mine) continue;
    const top = topOf(byPlayer)!;
    played++;
    if (mine.score === top.score) records++;
    const record = countedScore(top.score);
    pctSum += record > 0 ? (100 * countedScore(mine.score)) / record : 0;
  }
  const rating = (pctSum / CHALLENGES.length).toFixed(1);
  return {
    title: displayName,
    description:
      played > 0
        ? `Rating ${rating}% · ${records} ${records === 1 ? "record" : "records"} · ${played}/${CHALLENGES.length} challenges verified`
        : `${own.length} entries, none verified yet`,
    image: `${origin}/img/groups/epic.jpg`,
    largeImage: true,
  };
}

function homePreview(entries: Entry[], origin: string): Preview {
  const players = new Set(entries.map((e) => playerKey(e.p))).size;
  return {
    title: "Domination Highscores",
    description: `Fan-made leaderboard for the ${CHALLENGES.length} challenges of the Through the Ages app: ${players} players, ${entries.length} entries. Records, ratings and player comparisons.`,
    image: `${origin}/img/groups/mix.jpg`,
    largeImage: true,
  };
}

function previewFor(url: URL, entries: Entry[]): Preview | null {
  const path = decodeURIComponent(url.pathname);
  let m: RegExpMatchArray | null;
  if (path === "/") return homePreview(entries, url.origin);
  if ((m = path.match(/^\/challenge\/(.+)$/))) return challengePreview(m[1], entries, url.origin);
  if ((m = path.match(/^\/player\/(.+)$/))) return playerPreview(m[1], entries, url.origin);
  return null;
}

/** Adds title and Open Graph tags to the app's HTML for this URL. */
export function withPreview(page: Response, url: URL, entries: Entry[]): Response {
  const isHtml = page.headers.get("content-type")?.includes("text/html");
  const preview = isHtml ? previewFor(url, entries) : null;
  if (!preview) return page;
  const tags: [string, string][] = [
    ["og:site_name", SITE],
    ["og:type", "website"],
    ["og:url", url.href],
    ["og:title", preview.title],
    ["og:description", preview.description],
    ["og:image", preview.image],
    ["twitter:card", preview.largeImage ? "summary_large_image" : "summary"],
  ];
  return new HTMLRewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(`${preview.title} · TtA Challenges`);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", preview.description);
      },
    })
    .on("head", {
      element(el) {
        const html = tags
          .map(([prop, content]) => `<meta property="${prop}" content="${escapeAttr(content)}" />`)
          .join("");
        el.append(html, { html: true });
      },
    })
    .transform(page);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
