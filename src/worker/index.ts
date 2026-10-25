import { CHALLENGE_BY_ID } from "../shared/challenges";
import type { AdminEntry, Config, Entry, SubmitRequest } from "../shared/api";
import { cleanName, normalizeProofUrl, playerKey, validateName, validateScore } from "../shared/validation";
import { withPreview } from "./preview";

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  DISCORD_GUILD_ID: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET?: string;
  ADMIN_TOKEN?: string;
}

/** Max scores one IP may submit per hour. */
const HOURLY_LIMIT = 150;
/** How long an isolate keeps the entry list before re-reading D1. */
const ENTRIES_TTL_MS = 30_000;

let entriesCache: { at: number; body: string; list: Entry[] } | null = null;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    try {
      const res = await route(request, env, url);
      if (res) return res;
      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Internal error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function route(request: Request, env: Env, url: URL): Promise<Response | null> {
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/config" && method === "GET") {
    const config: Config = { turnstileSiteKey: env.TURNSTILE_SITE_KEY, discordGuildId: env.DISCORD_GUILD_ID };
    return json(config);
  }
  if (pathname === "/api/entries" && method === "GET") return listEntries(env);
  if (method === "GET" && !pathname.startsWith("/api/")) {
    // Page routes the Worker runs first for (see wrangler.jsonc): serve the app with link-preview tags.
    return withPreview(await env.ASSETS.fetch(request), url, await loadEntries(env));
  }
  if (pathname === "/api/entries" && method === "POST") return submit(request, env);

  if (pathname.startsWith("/api/admin/")) {
    requireAdmin(request, env);
    if (pathname === "/api/admin/entries" && method === "GET") return adminList(env);
    const m = pathname.match(/^\/api\/admin\/entries\/(\d+)$/);
    if (m && method === "PATCH") return adminUpdate(request, env, Number(m[1]));
    if (pathname === "/api/admin/rename" && method === "POST") return adminRename(request, env);
  }
  return null;
}

async function loadEntries(env: Env): Promise<Entry[]> {
  await refreshEntries(env);
  return entriesCache!.list;
}

async function refreshEntries(env: Env) {
  if (!entriesCache || Date.now() - entriesCache.at > ENTRIES_TTL_MS) {
    const { results } = await env.DB.prepare(
      `SELECT id, challenge_id AS c, player AS p, score AS s, proof_url AS u, created_at AS t, bugged AS b
       FROM entries WHERE hidden = 0 ORDER BY id`,
    ).all<Entry>();
    entriesCache = { at: Date.now(), body: JSON.stringify(results), list: results };
  }
}

async function listEntries(env: Env): Promise<Response> {
  await refreshEntries(env);
  return new Response(entriesCache!.body, {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=15" },
  });
}

async function submit(request: Request, env: Env): Promise<Response> {
  const body = await readJson<SubmitRequest>(request);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";

  if (env.TURNSTILE_SECRET) await verifyTurnstile(env.TURNSTILE_SECRET, body.turnstileToken, ip);

  const nameError = validateName(String(body.player ?? ""));
  if (nameError) throw new HttpError(400, nameError);
  const player = cleanName(body.player);

  if (!Array.isArray(body.scores) || body.scores.length === 0) throw new HttpError(400, "Enter at least one domination.");
  if (body.scores.length > CHALLENGE_BY_ID.size) throw new HttpError(400, "Too many entries.");

  const seen = new Set<string>();
  const rows = body.scores.map((s) => {
    const challenge = CHALLENGE_BY_ID.get(String(s.challengeId));
    if (!challenge) throw new HttpError(400, `Unknown challenge "${s.challengeId}".`);
    if (seen.has(challenge.id)) throw new HttpError(400, `"${challenge.name}" is listed twice.`);
    seen.add(challenge.id);
    const score = Number(s.score);
    const scoreError = validateScore(score);
    if (scoreError) throw new HttpError(400, `${challenge.name}: ${scoreError}`);
    let proof: string | null = null;
    if (s.proofUrl && s.proofUrl.trim()) {
      proof = normalizeProofUrl(s.proofUrl, env.DISCORD_GUILD_ID);
      if (!proof) throw new HttpError(400, `${challenge.name}: the proof must be a link to a message in the TtA Discord server.`);
    }
    return { challengeId: challenge.id, score, proof };
  });

  const ipHash = await sha256(`${ip}|${env.ADMIN_TOKEN ?? ""}`);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM entries WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')`,
  )
    .bind(ipHash)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) + rows.length > HOURLY_LIMIT) {
    throw new HttpError(429, "Too many submissions from your connection. Please try again in an hour.");
  }

  const insert = env.DB.prepare(
    `INSERT INTO entries (challenge_id, player, player_key, score, proof_url, ip_hash) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  await env.DB.batch(rows.map((r) => insert.bind(r.challengeId, player, playerKey(player), r.score, r.proof, ipHash)));
  entriesCache = null;
  return json({ ok: true, count: rows.length }, 201);
}

async function verifyTurnstile(secret: string, token: string | undefined, ip: string) {
  if (!token) throw new HttpError(400, "Please complete the captcha.");
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const outcome = await res.json<{ success: boolean }>();
  if (!outcome.success) throw new HttpError(400, "Captcha check failed, please try again.");
}

function requireAdmin(request: Request, env: Env) {
  const expected = env.ADMIN_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !timingSafeEqual(given, expected)) throw new HttpError(401, "Wrong admin password.");
}

async function adminList(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, challenge_id AS c, player AS p, score AS s, proof_url AS u, created_at AS t,
            hidden, hidden_reason AS hiddenReason, source, ip_hash AS ipHash, bugged AS b
     FROM entries ORDER BY id DESC`,
  ).all<Omit<AdminEntry, "hidden"> & { hidden: number }>();
  return json(results.map((r) => ({ ...r, hidden: r.hidden === 1 })));
}

async function adminUpdate(request: Request, env: Env, id: number): Promise<Response> {
  const body = await readJson<{
    hidden?: boolean;
    hiddenReason?: string | null;
    proofUrl?: string | null;
    score?: number;
    bugged?: boolean;
  }>(request);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.hidden !== undefined) {
    sets.push("hidden = ?", "hidden_reason = ?");
    args.push(body.hidden ? 1 : 0, body.hidden ? (body.hiddenReason ?? null) : null);
  }
  if (body.proofUrl !== undefined) {
    // Admins may store any link (e.g. imported CDN screenshots), but not arbitrary text.
    const proof = body.proofUrl?.trim() || null;
    if (proof && !/^https:\/\//.test(proof)) throw new HttpError(400, "Proof must be an https link.");
    sets.push("proof_url = ?");
    args.push(proof);
  }
  if (body.score !== undefined) {
    const scoreError = validateScore(Number(body.score));
    if (scoreError) throw new HttpError(400, scoreError);
    sets.push("score = ?");
    args.push(Number(body.score));
  }
  if (body.bugged !== undefined) {
    sets.push("bugged = ?");
    args.push(body.bugged ? 1 : 0);
  }
  if (sets.length === 0) throw new HttpError(400, "Nothing to update.");
  const res = await env.DB.prepare(`UPDATE entries SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...args, id)
    .run();
  if (res.meta.changes === 0) throw new HttpError(404, "Entry not found.");
  entriesCache = null;
  return json({ ok: true });
}

/** Merge all entries of one player name into another (fixes typos like "Wawrzienic"). */
async function adminRename(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ from: string; to: string }>(request);
  const nameError = validateName(String(body.to ?? ""));
  if (nameError) throw new HttpError(400, nameError);
  const to = cleanName(body.to);
  const res = await env.DB.prepare(`UPDATE entries SET player = ?, player_key = ? WHERE player_key = ?`)
    .bind(to, playerKey(to), playerKey(String(body.from ?? "")))
    .run();
  entriesCache = null;
  return json({ ok: true, changed: res.meta.changes });
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  return crypto.subtle.timingSafeEqual(ea, eb);
}
