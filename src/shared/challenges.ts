import raw from "../../data/challenges.json";

export type SetId = "original" | "expansion" | "mix";

export interface Opponent {
  level: "easy" | "medium" | "hard";
  name: string | null;
  flags: Record<string, number>;
}

export interface Challenge {
  id: string;
  set: SetId;
  group: string;
  slot: number;
  difficulty: number;
  players: number;
  name: string;
  description: string[];
  rules: string[];
  opponents: Opponent[];
}

export const CHALLENGES = raw as unknown as Challenge[];
export const CHALLENGE_BY_ID = new Map(CHALLENGES.map((c) => [c.id, c]));

export const SETS: { id: SetId; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "expansion", label: "Expansion" },
  { id: "mix", label: "Random Mix" },
];

export const GROUP_LABELS: Record<string, string> = {
  classic: "Classic",
  cheap: "Low-Priced Lands",
  immortals: "Immortals",
  epic: "Epic Game",
  impacts: "Deep Impact",
  time_travellers: "Time Travelers",
  fate: "Fate",
  gods: "Gods",
  wonders: "Wonders",
  kidnappers: "Kidnappers",
  mix: "Mix",
};

/** Groups of a set in game order, each with its challenges ordered by slot. */
export function groupsOf(set: SetId): { group: string; challenges: Challenge[] }[] {
  const groups = new Map<string, Challenge[]>();
  for (const c of CHALLENGES) {
    if (c.set !== set) continue;
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }
  return [...groups].map(([group, challenges]) => ({ group, challenges }));
}
