import { useMemo, useState } from "preact/hooks";
import { Loading, MeasureToggle, PlayerLink, VerifiedToggle } from "../components";
import {
  type Measure,
  type PlayerSummary,
  computeStats,
  formatDate,
  formatMeasure,
  measureOf,
  useEntries,
  useMeasure,
  useVerifiedOnly,
} from "../data";

type SortKey = "name" | "overall" | "played" | "verified" | "records" | "original" | "expansion" | "mix" | "lastActive";

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "Player" },
  { key: "overall", label: "", num: true },
  { key: "records", label: "Records", num: true },
  { key: "played", label: "Played", num: true },
  { key: "verified", label: "Verified", num: true },
  { key: "original", label: "Original", num: true },
  { key: "expansion", label: "Expansion", num: true },
  { key: "mix", label: "Mix", num: true },
  { key: "lastActive", label: "Last entry" },
];

function sortValue(p: PlayerSummary, key: SortKey, measure: Measure): string | number {
  if (key === "original" || key === "expansion" || key === "mix") return measureOf(p, measure, key);
  if (key === "overall") return measureOf(p, measure);
  if (key === "name") return p.name.toLowerCase();
  return p[key];
}

export function Players() {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [measure, setMeasure] = useMeasure();
  const [sort, setSort] = useState<SortKey>("overall");
  const [query, setQuery] = useState("");
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  if (!stats) return <Loading error={error} />;

  const q = query.trim().toLowerCase();
  const rows = [...stats.players.values()]
    .filter((p) => !q || p.key.includes(q))
    .sort((a, b) => {
      const va = sortValue(a, sort, measure);
      const vb = sortValue(b, sort, measure);
      if (typeof va === "string")
        return sort === "name" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return (vb as number) - va;
    });

  return (
    <>
      <h1>Players</h1>
      <p class="lead">
        Switch between <strong>Rating</strong>: each best domination as a percentage of the record (holding the record =
        100%), averaged over all 97 challenges so unplayed ones count as 0%; and <strong>Total</strong>: the plain sum
        of each player's best dominations. Click a column to sort.
      </p>
      <div class="sticky-bar">
        <input
          class="search"
          type="search"
          placeholder="Search players…"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="bar-group">
          <MeasureToggle value={measure} onChange={setMeasure} />
          <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th class={c.num ? "num sortable" : "sortable"} aria-sort={sort === c.key ? "descending" : undefined}>
                  <button onClick={() => setSort(c.key)}>
                    {c.key === "overall" ? (measure === "rating" ? "Rating" : "Total") : c.label}
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
                <td class="num score">{formatMeasure(measureOf(p, measure), measure)}</td>
                <td class="num">{p.records || ""}</td>
                <td class="num">{p.played}</td>
                <td class="num">{p.verified}</td>
                <td class="num">{formatMeasure(measureOf(p, measure, "original"), measure)}</td>
                <td class="num">{formatMeasure(measureOf(p, measure, "expansion"), measure)}</td>
                <td class="num">{formatMeasure(measureOf(p, measure, "mix"), measure)}</td>
                <td class="muted">{formatDate(p.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
