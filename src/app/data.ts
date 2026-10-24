import { useEffect, useState } from "preact/hooks";
import type { Config, Entry } from "../shared/api";
import { CHALLENGES, type Challenge, type SetId, CHALLENGE_BY_ID } from "../shared/challenges";
import { playerKey } from "../shared/validation";

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
  lastActive: string;
}

export interface Stats {
  entries: Entry[];
  /** Ranked best scores per challenge id. */
  boards: Map<string, Best[]>;
  players: Map<string, PlayerSummary>;
}

/**
 * Builds rankings. With `verifiedOnly`, only entries that link a Discord proof count;
 * otherwise every entry counts and a verified score wins a tie.
 */
export function computeStats(entries: Entry[], verifiedOnly: boolean): Stats {
  const names = new Map<string, string>();
  for (const e of entries) names.set(playerKey(e.p), e.p); // entries are in id order, so the newest name wins

  const bestByPair = new Map<string, Best>();
  for (const e of entries) {
    if (verifiedOnly && !e.u) continue;
    const key = playerKey(e.p);
    const pair = `${e.c}\u0000${key}`;
    const prev = bestByPair.get(pair);
    if (!prev || e.s > prev.score || (e.s === prev.score && e.u && !prev.proof)) {
      bestByPair.set(pair, { key, player: names.get(key)!, challengeId: e.c, score: e.s, proof: e.u, t: e.t, rank: 0 });
    }
  }

  const boards = new Map<string, Best[]>(CHALLENGES.map((c) => [c.id, []]));
  for (const b of bestByPair.values()) boards.get(b.challengeId)?.push(b);
  for (const board of boards.values()) {
    board.sort((a, b) => b.score - a.score || a.t.localeCompare(b.t));
    board.forEach((b, i) => (b.rank = i > 0 && board[i - 1].score === b.score ? board[i - 1].rank : i + 1));
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
      lastActive: "",
    });
  }
  for (const board of boards.values()) {
    for (const b of board) {
      const p = players.get(b.key)!;
      p.bests.set(b.challengeId, b);
      p.played++;
      if (b.proof) p.verified++;
      if (b.rank === 1) p.records++;
      p.total += b.score;
      p.totals[CHALLENGE_BY_ID.get(b.challengeId)!.set] += b.score;
    }
  }
  for (const e of entries) {
    const p = players.get(playerKey(e.p))!;
    if (e.t > p.lastActive) p.lastActive = e.t;
  }
  for (const [key, p] of players) if (p.played === 0) players.delete(key);

  return { entries, boards, players };
}

export interface ScopeTotal {
  /** Sum of the record on every challenge in scope ("if everyone pooled their best"). */
  pooled: number;
  /** Challenges in scope that have at least one score. */
  covered: number;
  size: number;
  /** Players ranked by the sum of their own bests in scope ("best single player"). */
  ranking: { name: string; total: number; played: number }[];
}

/** Totals over a set of challenges (a group, a set, or everything). */
export function scopeTotal(stats: Stats, challenges: Challenge[]): ScopeTotal {
  let pooled = 0;
  let covered = 0;
  for (const c of challenges) {
    const top = stats.boards.get(c.id)?.[0];
    if (top) {
      pooled += top.score;
      covered++;
    }
  }
  const ranking = [];
  for (const p of stats.players.values()) {
    let total = 0;
    let played = 0;
    for (const c of challenges) {
      const b = p.bests.get(c.id);
      if (b) {
        total += b.score;
        played++;
      }
    }
    if (played) ranking.push({ name: p.name, total, played });
  }
  ranking.sort((a, b) => b.total - a.total || b.played - a.played);
  return { pooled, covered, size: challenges.length, ranking };
}

let entriesPromise: Promise<Entry[]> | null = null;

export function loadEntries(force = false): Promise<Entry[]> {
  if (!entriesPromise || force) {
    entriesPromise = fetch("/api/entries", force ? { cache: "reload" } : undefined).then((r) => {
      if (!r.ok) throw new Error(`Could not load scores (${r.status})`);
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

/** Remembered toggle between "verified only" and "all scores". */
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

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
