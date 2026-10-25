import { useEffect, useState } from "preact/hooks";
import type { Config, Entry } from "../shared/api";
import { CHALLENGES, type Challenge, type SetId, CHALLENGE_BY_ID } from "../shared/challenges";
import { countedScore, playerKey } from "../shared/validation";

/** A player's best score on one challenge. */
export interface Best {
  key: string;
  player: string;
  challengeId: string;
  score: number;
  proof: string | null;
  t: string;
  /** 1-based rank within the challenge (ties share a rank). */
  rank: number;
  /** Score as a percentage of the challenge record (100 = holds the record). */
  pct: number;
}

export interface PlayerSummary {
  key: string;
  name: string;
  bests: Map<string, Best>;
  played: number;
  verified: number;
  records: number;
  total: number;
  totals: Record<SetId, number>;
  /** Average of `pct` over every challenge (unplayed ones count as 0), 0–100. */
  rating: number;
  ratings: Record<SetId, number>;
  lastActive: string;
}

export interface Stats {
  entries: Entry[];
  /** Ranked best scores per challenge id. */
  boards: Map<string, Best[]>;
  players: Map<string, PlayerSummary>;
}

const SET_SIZES: Record<SetId, number> = { original: 0, expansion: 0, mix: 0 };
for (const c of CHALLENGES) SET_SIZES[c.set]++;

/**
 * Builds rankings. With `verifiedOnly`, only entries that link a Discord proof count;
 * otherwise every entry counts and a verified score wins a tie.
 * Entries flagged as bugged never count.
 */
/**
 * `trustKey` (the "as if verified" view): with verifiedOnly, this player's unproven entries also count, measured
 * against the official boards. The boards and everyone else stay unchanged, so a best above the official record
 * rates over 100%.
 */
export function computeStats(entries: Entry[], verifiedOnly: boolean, trustKey?: string): Stats {
  const names = new Map<string, string>();
  for (const e of entries) names.set(playerKey(e.p), e.p); // entries are in id order, so the newest name wins

  const bestByPair = new Map<string, Best>();
  for (const e of entries) {
    if (e.b || (verifiedOnly && !e.u)) continue;
    const key = playerKey(e.p);
    const pair = `${e.c}\u0000${key}`;
    const prev = bestByPair.get(pair);
    if (!prev || e.s > prev.score || (e.s === prev.score && e.u && !prev.proof)) {
      bestByPair.set(pair, { key, player: names.get(key)!, challengeId: e.c, score: e.s, proof: e.u, t: e.t, rank: 0, pct: 0 });
    }
  }

  const boards = new Map<string, Best[]>(CHALLENGES.map((c) => [c.id, []]));
  for (const b of bestByPair.values()) boards.get(b.challengeId)?.push(b);
  for (const board of boards.values()) {
    board.sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));
    board.forEach((b, i) => {
      b.rank = i > 0 && board[i - 1].score === b.score ? board[i - 1].rank : i + 1;
      const record = countedScore(board[0].score);
      b.pct = record > 0 ? (100 * countedScore(b.score)) / record : 0;
    });
  }

  const players = new Map<string, PlayerSummary>();
  for (const [key, name] of names) {
    players.set(key, {
      key,
      name,
      bests: new Map(),
      played: 0,
      verified: 0,
      records: 0,
      total: 0,
      totals: { original: 0, expansion: 0, mix: 0 },
      rating: 0,
      ratings: { original: 0, expansion: 0, mix: 0 },
      lastActive: "",
    });
  }
  const addBest = (b: Best) => {
    const p = players.get(b.key)!;
    p.bests.set(b.challengeId, b);
    p.played++;
    if (b.proof) p.verified++;
    if (b.rank === 1) p.records++;
    p.total += countedScore(b.score);
    const set = CHALLENGE_BY_ID.get(b.challengeId)!.set;
    p.totals[set] += countedScore(b.score);
    p.rating += b.pct / CHALLENGES.length;
    p.ratings[set] += b.pct / SET_SIZES[set];
  };
  const trusted = verifiedOnly && trustKey ? trustedBests(entries, trustKey, names.get(trustKey)!, boards) : null;
  for (const board of boards.values()) for (const b of board) if (!trusted || b.key !== trustKey) addBest(b);
  if (trusted) for (const b of trusted) addBest(b);
  for (const e of entries) {
    const p = players.get(playerKey(e.p))!;
    if (e.t > p.lastActive) p.lastActive = e.t;
  }
  for (const [key, p] of players) if (p.played === 0) players.delete(key);

  return { entries, boards, players };
}

/** One player's bests over all their entries, ranked and rated against the official boards (see computeStats). */
function trustedBests(entries: Entry[], key: string, name: string, boards: Map<string, Best[]>): Best[] {
  const best = new Map<string, Entry>();
  for (const e of entries) {
    if (e.b || playerKey(e.p) !== key) continue;
    const prev = best.get(e.c);
    if (!prev || e.s > prev.s || (e.s === prev.s && e.u && !prev.u)) best.set(e.c, e);
  }
  return [...best.values()].map((e) => {
    const board = boards.get(e.c) ?? [];
    const record = countedScore(board[0]?.score ?? 0);
    const counted = countedScore(e.s);
    return {
      key,
      player: name,
      challengeId: e.c,
      score: e.s,
      proof: e.u,
      t: e.t,
      rank: 1 + board.filter((o) => o.key !== key && o.score > e.s).length,
      pct: record > 0 ? (100 * counted) / record : counted > 0 ? 100 : 0,
    };
  });
}

export interface ScopeTotal {
  /** Sum of the record on every challenge in scope ("if everyone pooled their best"). */
  pooled: number;
  /** Challenges in scope that have at least one score. */
  covered: number;
  size: number;
  /** Players ranked by the sum of their own bests in scope ("best single player"). */
  ranking: { name: string; total: number; played: number; rating: number }[];
}

/** Totals over a set of challenges (a group, a set, or everything). */
export function scopeTotal(stats: Stats, challenges: Challenge[]): ScopeTotal {
  let pooled = 0;
  let covered = 0;
  for (const c of challenges) {
    const top = stats.boards.get(c.id)?.[0];
    if (top) {
      pooled += countedScore(top.score);
      covered++;
    }
  }
  const ranking = [];
  for (const p of stats.players.values()) {
    let total = 0;
    let played = 0;
    let pctSum = 0;
    for (const c of challenges) {
      const b = p.bests.get(c.id);
      if (b) {
        total += countedScore(b.score);
        played++;
        pctSum += b.pct;
      }
    }
    if (played) ranking.push({ name: p.name, total, played, rating: pctSum / challenges.length });
  }
  ranking.sort((a, b) => b.total - a.total || b.played - a.played);
  return { pooled, covered, size: challenges.length, ranking };
}

let entriesPromise: Promise<Entry[]> | null = null;

export function loadEntries(force = false): Promise<Entry[]> {
  if (!entriesPromise || force) {
    entriesPromise = fetch("/api/entries", force ? { cache: "reload" } : undefined).then((r) => {
      if (!r.ok) throw new Error(`Could not load the leaderboard (${r.status})`);
      return r.json();
    });
    entriesPromise.catch(() => (entriesPromise = null));
  }
  return entriesPromise;
}

export function useEntries(): { entries: Entry[] | null; error: string | null } {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadEntries().then(setEntries, (e: Error) => setError(e.message));
  }, []);
  return { entries, error };
}

let configPromise: Promise<Config> | null = null;
export function loadConfig(): Promise<Config> {
  configPromise ??= fetch("/api/config").then((r) => r.json());
  return configPromise;
}

/** Remembered toggle between "verified only" and "all entries". */
export function useVerifiedOnly(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem("verifiedOnly") !== "false";
    } catch {
      return true;
    }
  });
  const set = (v: boolean) => {
    setValue(v);
    try {
      localStorage.setItem("verifiedOnly", String(v));
    } catch {
      /* storage unavailable */
    }
  };
  return [value, set];
}

/** How players are compared: % rating, or the plain sum of best dominations. */
export type Measure = "rating" | "total";

export function useMeasure(): [Measure, (m: Measure) => void] {
  const [value, setValue] = useState<Measure>(() => {
    try {
      return localStorage.getItem("measure") === "rating" ? "rating" : "total";
    } catch {
      return "total";
    }
  });
  const set = (m: Measure) => {
    setValue(m);
    try {
      localStorage.setItem("measure", m);
    } catch {
      /* storage unavailable */
    }
  };
  return [value, set];
}

/** A player's overall value, or for one set, in the chosen measure. */
export function measureOf(p: PlayerSummary, m: Measure, set?: SetId): number {
  if (m === "rating") return set ? p.ratings[set] : p.rating;
  return set ? p.totals[set] : p.total;
}

export function formatMeasure(value: number, m: Measure): string {
  return m === "rating" ? formatRating(value) : String(value);
}

export function formatRating(rating: number): string {
  return `${rating.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  // Fixed English locale: the site is English-only, whatever the visitor's browser language.
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}
