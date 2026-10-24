import { useMemo, useState } from "preact/hooks";
import { Loading, PlayerLink, VerifiedToggle } from "../components";
import { type PlayerSummary, computeStats, formatDate, useEntries, useVerifiedOnly } from "../data";

type SortKey = "name" | "played" | "verified" | "records" | "total" | "original" | "expansion" | "mix" | "lastActive";

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "Player" },
  { key: "records", label: "Records", num: true },
  { key: "played", label: "Played", num: true },
  { key: "verified", label: "Verified", num: true },
  { key: "original", label: "Original", num: true },
  { key: "expansion", label: "Expansion", num: true },
  { key: "mix", label: "Mix", num: true },
  { key: "total", label: "Total", num: true },
  { key: "lastActive", label: "Last entry" },
];

function sortValue(p: PlayerSummary, key: SortKey): string | number {
  if (key === "original" || key === "expansion" || key === "mix") return p.totals[key];
  if (key === "name") return p.name.toLowerCase();
  return p[key];
}

export function Players() {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [sort, setSort] = useState<SortKey>("total");
  const [query, setQuery] = useState("");
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  if (!stats) return <Loading error={error} />;

  const q = query.trim().toLowerCase();
  const rows = [...stats.players.values()]
    .filter((p) => !q || p.key.includes(q))
    .sort((a, b) => {
      const va = sortValue(a, sort);
      const vb = sortValue(b, sort);
      if (typeof va === "string") return sort === "name" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return (vb as number) - va;
    });

  return (
    <>
      <h1>Players</h1>
      <p class="lead">
        Totals add up each player's best domination per challenge. Click a column to sort.
      </p>
      <div class="sticky-bar">
        <input
          class="search"
          type="search"
          placeholder="Search players…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th class={c.num ? "num sortable" : "sortable"} aria-sort={sort === c.key ? "descending" : undefined}>
                  <button onClick={() => setSort(c.key)}>
                    {c.label}
                    {sort === c.key ? " ▾" : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr>
                <td>
                  <PlayerLink name={p.name} />
                </td>
                <td class="num">{p.records || ""}</td>
                <td class="num">{p.played}</td>
                <td class="num">{p.verified}</td>
                <td class="num">{p.totals.original}</td>
                <td class="num">{p.totals.expansion}</td>
                <td class="num">{p.totals.mix}</td>
                <td class="num score">{p.total}</td>
                <td class="muted">{formatDate(p.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
