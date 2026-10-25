import { useMemo, useState } from "preact/hooks";
import { CHALLENGES, SETS, type SetId } from "../../shared/challenges";
import { playerKey } from "../../shared/validation";
import { Loading, MeasureToggle, PlayerLink, PlayerPicker, Stat, Tabs, VerifiedToggle } from "../components";
import { computeStats, formatMeasure, measureOf, useEntries, useMeasure, useVerifiedOnly } from "../data";
import { SetGrid } from "../SetGrid";

function readParam(name: string) {
  return new URL(location.href).searchParams.get(name) ?? "";
}

export function Compare() {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [a, setA] = useState(() => readParam("a"));
  const [b, setB] = useState(() => readParam("b"));
  const [set, setSet] = useState<SetId>("original");
  const [measure, setMeasure] = useMeasure();
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  const update = (which: "a" | "b", value: string) => {
    (which === "a" ? setA : setB)(value);
    const url = new URL(location.href);
    if (value) url.searchParams.set(which, value);
    else url.searchParams.delete(which);
    history.replaceState(null, "", url);
  };

  if (!stats) return <Loading error={error} />;

  const names = [...stats.players.values()].map((p) => p.name).sort((x, y) => x.localeCompare(y));
  const pa = stats.players.get(playerKey(a));
  const pb = stats.players.get(playerKey(b));

  let winsA = 0,
    winsB = 0,
    ties = 0,
    both = 0;
  if (pa && pb) {
    for (const c of CHALLENGES) {
      const sa = pa.bests.get(c.id)?.score;
      const sb = pb.bests.get(c.id)?.score;
      if (sa === undefined || sb === undefined) continue;
      both++;
      if (sa > sb) winsA++;
      else if (sb > sa) winsB++;
      else ties++;
    }
  }

  return (
    <>
      <h1>Compare players</h1>
      <div class="compare-pickers">
        <label>
          <span class="side-a">Player A</span>
          <PlayerPicker id="cmp-a" value={a} onInput={(v) => update("a", v)} names={names} placeholder="Name…" />
        </label>
        <span class="vs">vs</span>
        <label>
          <span class="side-b">Player B</span>
          <PlayerPicker id="cmp-b" value={b} onInput={(v) => update("b", v)} names={names} placeholder="Name…" />
        </label>
      </div>

      <div class="sticky-bar">
        <div class="bar-group">
          {pa && pb && <Tabs value={set} options={SETS} onChange={setSet} />}
          {pa && pb && (
            <span class="muted bar-note">
              <span class="side-a">■</span> {pa.name} ahead · <span class="side-b">■</span> {pb.name} ahead
            </span>
          )}
        </div>
        <div class="bar-group">
          <MeasureToggle value={measure} onChange={setMeasure} />
          <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
        </div>
      </div>

      {a && !pa && (
        <p class="muted">
          No {verifiedOnly ? "verified " : ""}entries for “{a}”.
        </p>
      )}
      {b && !pb && (
        <p class="muted">
          No {verifiedOnly ? "verified " : ""}entries for “{b}”.
        </p>
      )}

      {pa && pb && (
        <>
          <div class="stats">
            <Stat label={`${pa.name} wins`} value={<span class="side-a">{winsA}</span>} />
            <Stat label={`${pb.name} wins`} value={<span class="side-b">{winsB}</span>} />
            <Stat label="Ties" value={ties} />
            <Stat label="Played by both" value={both} />
          </div>

          <div class="table-wrap">
            <table class="compare-totals">
              <thead>
                <tr>
                  <th />
                  {SETS.map((s) => (
                    <th class="num">{s.label}</th>
                  ))}
                  <th class="num">{measure === "rating" ? "Rating" : "Total"}</th>
                  <th class="num">Records</th>
                </tr>
              </thead>
              <tbody>
                {[pa, pb].map((p, i) => (
                  <tr>
                    <td class={i === 0 ? "side-a" : "side-b"}>
                      <PlayerLink name={p.name} />
                    </td>
                    {SETS.map((s) => (
                      <td class="num">{formatMeasure(measureOf(p, measure, s.id), measure)}</td>
                    ))}
                    <td class="num score">{formatMeasure(measureOf(p, measure), measure)}</td>
                    <td class="num">{p.records}</td>
                  </tr>
                ))}
                <tr class="diff-row">
                  <td>Difference</td>
                  {SETS.map((s) => (
                    <td class="num">
                      <MeasureDiff
                        a={measureOf(pa, measure, s.id)}
                        b={measureOf(pb, measure, s.id)}
                        rating={measure === "rating"}
                      />
                    </td>
                  ))}
                  <td class="num">
                    <MeasureDiff a={measureOf(pa, measure)} b={measureOf(pb, measure)} rating={measure === "rating"} />
                  </td>
                  <td class="num">
                    <Diff value={pa.records - pb.records} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Per challenge</h2>
          <SetGrid
            set={set}
            cell={(c) => {
              const sa = pa.bests.get(c.id)?.score;
              const sb = pb.bests.get(c.id)?.score;
              if (sa === undefined && sb === undefined) return <span class="muted">—</span>;
              const lead = sa === undefined ? "b" : sb === undefined ? "a" : sa > sb ? "a" : sb > sa ? "b" : "";
              return (
                <span class={`cmp ${lead ? `lead-${lead}` : ""}`}>
                  <span class="side-a">{sa ?? "—"}</span>
                  <span class="muted"> : </span>
                  <span class="side-b">{sb ?? "—"}</span>
                  {sa !== undefined && sb !== undefined && (
                    <span class="cmp-diff">
                      {" "}
                      (<Diff value={sa - sb} />)
                    </span>
                  )}
                </span>
              );
            }}
          />
        </>
      )}
    </>
  );
}

/** Difference in the chosen measure; ratings are rounded to one decimal and shown in %. */
function MeasureDiff({ a, b, rating }: { a: number; b: number; rating: boolean }) {
  return rating ? <Diff value={Math.round((a - b) * 10) / 10} suffix="%" /> : <Diff value={a - b} />;
}

function Diff({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value === 0) return <span class="muted">±0{suffix}</span>;
  return (
    <span class={value > 0 ? "side-a" : "side-b"}>
      {value > 0 ? `+${value}` : value}
      {suffix}
    </span>
  );
}
