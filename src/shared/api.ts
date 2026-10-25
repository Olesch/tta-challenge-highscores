/** Compact entry as served by GET /api/entries. */
export interface Entry {
  id: number;
  /** challenge id */
  c: string;
  /** player display name */
  p: string;
  /** score */
  s: number;
  /** proof url, null if unverified */
  u: string | null;
  /** ISO timestamp */
  t: string;
  /** 1 if obtained through a fixed game bug: listed, but never counted */
  b: number;
}

export interface SubmitScore {
  challengeId: string;
  score: number;
  proofUrl?: string;
}

export interface SubmitRequest {
  player: string;
  scores: SubmitScore[];
  turnstileToken?: string;
}

export interface AdminEntry extends Entry {
  hidden: boolean;
  hiddenReason: string | null;
  source: string;
  ipHash: string | null;
  /** An admin has looked at the Discord proof (admin-only, never public). */
  checked: boolean;
}

export interface Config {
  turnstileSiteKey: string;
  discordGuildId: string;
}
