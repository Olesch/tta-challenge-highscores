export const MIN_SCORE = 0;
export const MAX_SCORE = 9999;
export const MAX_NAME_LENGTH = 32;

/** Collapse whitespace so "Himmelstosh " and "Himmelstosh" are one player. */
export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function playerKey(name: string): string {
  return cleanName(name).toLowerCase();
}

export function validateName(name: string): string | null {
  const n = cleanName(name);
  if (n.length < 2) return "Name must be at least 2 characters.";
  if (n.length > MAX_NAME_LENGTH) return `Name must be at most ${MAX_NAME_LENGTH} characters.`;
  if (/[<>]/.test(n)) return "Name contains invalid characters.";
  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score)) return "Score must be a whole number.";
  if (score < MIN_SCORE || score > MAX_SCORE) return `Score must be between ${MIN_SCORE} and ${MAX_SCORE}.`;
  return null;
}

/**
 * Returns the canonical Discord message link, or null if `url` is not a message in the guild.
 * Accepts discordapp.com, ptb. and canary. variants.
 */
export function normalizeProofUrl(url: string, guildId: string): string | null {
  const m = url
    .trim()
    .match(/^https?:\/\/(?:www\.|ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\/?$/);
  if (!m || m[1] !== guildId) return null;
  return `https://discord.com/channels/${m[1]}/${m[2]}/${m[3]}`;
}
