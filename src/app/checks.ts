import type { Entry } from "../shared/api";
import { playerKey } from "../shared/validation";

/** An unproven entry this many times above everyone else's best is probably a typo or a bug. */
export const SUSPICIOUS_FACTOR = 2;

export interface Records {
  /** Best counted score per challenge, any proof. */
  all: Map<string, Entry>;
  /** Best counted score per challenge with proof (the official record). */
  verified: Map<string, Entry>;
}

/** Current records, ignoring bugged entries and optionally one player's entries (to compare them with everyone else). */
export function records(entries: Entry[], excludePlayer?: string): Records {
  const excludeKey = excludePlayer === undefined ? null : playerKey(excludePlayer);
  const all = new Map<string, Entry>();
  const verified = new Map<string, Entry>();
  for (const e of entries) {
    if (e.b || playerKey(e.p) === excludeKey) continue;
    if (!all.has(e.c) || e.s > all.get(e.c)!.s) all.set(e.c, e);
    if (e.u && (!verified.has(e.c) || e.s > verified.get(e.c)!.s)) verified.set(e.c, e);
  }
  return { all, verified };
}

/** Player names that have used each proof link. */
export function proofOwners(entries: Entry[]): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.u) continue;
    if (!owners.has(e.u)) owners.set(e.u, new Set());
    owners.get(e.u)!.add(e.p);
  }
  return owners;
}

/** Names other than `player` that already used `proof`. */
export function otherProofOwners(owners: Map<string, Set<string>>, proof: string | null, player: string): string[] {
  if (!proof) return [];
  return [...(owners.get(proof) ?? [])].filter((p) => playerKey(p) !== playerKey(player));
}

/** True for an entry without proof that is far above everyone else's best. */
export function isFarAbove(score: number, proof: string | null | undefined, othersBest: Entry | undefined): boolean {
  return !proof && !!othersBest && othersBest.s > 0 && score > othersBest.s * SUSPICIOUS_FACTOR;
}
