import { CHALLENGE_BY_ID, GROUP_LABELS, SETS } from "../shared/challenges";
import { loadEntries } from "./data";

const COLUMNS = ["id", "date", "player", "set", "group", "challenge_id", "challenge", "players", "domination", "verified", "proof_url", "bugged"];

async function rows() {
  const entries = await loadEntries(true);
  return entries.map((e) => {
    const c = CHALLENGE_BY_ID.get(e.c)!;
    return {
      id: e.id,
      date: e.t,
      player: e.p,
      set: SETS.find((s) => s.id === c.set)!.label,
      group: GROUP_LABELS[c.group],
      challenge_id: c.id,
      challenge: c.name,
      players: c.players,
      domination: e.s,
      verified: e.u ? "yes" : "no",
      proof_url: e.u ?? "",
      bugged: e.b ? "yes" : "no",
    };
  });
}

function csvCell(value: unknown): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function save(content: string, type: string, ext: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tta-challenge-dominations-${new Date().toISOString().slice(0, 10)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Every visible entry, one row per submitted domination. */
export async function downloadAll(format: "csv" | "json") {
  const data = await rows();
  if (format === "json") return save(JSON.stringify(data, null, 1), "application/json", "json");
  // BOM so Excel opens the UTF-8 file with the right encoding.
  const lines = [COLUMNS.join(","), ...data.map((r) => COLUMNS.map((k) => csvCell(r[k as keyof typeof r])).join(","))];
  save("﻿" + lines.join("\r\n"), "text/csv;charset=utf-8", "csv");
}
