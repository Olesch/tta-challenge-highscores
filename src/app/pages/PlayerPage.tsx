import { useMemo, useState } from "preact/hooks";
import { CHALLENGES, CHALLENGE_BY_ID, SETS, type SetId } from "../../shared/challenges";
import { playerKey } from "../../shared/validation";
import { BugTag, Loading, MeasureToggle, ProofLink, Stat, Tabs, VerifiedToggle } from "../components";
import {
  type PlayerSummary,
  type Stats,
  computeStats,
  formatDate,
  formatMeasure,
  measureOf,
  useEntries,
  useMeasure,
  useVerifiedOnly,
} from "../data";
import { Link, challengeHref } from "../router";
import { SetGrid } from "../SetGrid";

export function PlayerPage({ name }: { name: string }) {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [set, setSet] = useState<SetId>("original");
  const [measure, setMeasure] = useMeasure();
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  if (!stats) return <Loading error={error} />;
  const key = playerKey(name);
  const player = stats.players.get(key);
  const known = entries!.some((e) => playerKey(e.p) === key);

  if (!player) {
    return (
      <>
        <h1>{name}</h1>
        {known && verifiedOnly ? (
          <p>
            {name} has no verified entries yet.{" "}
            <button class="link" onClick={() => setVerifiedOnly(false)}>
              Show all entries
            </button>
          </p>
        ) : (
          <p class="muted">No entries for this player.</p>
        )}
      </>
    );
  }

  const setCount = (s: SetId) => CHALLENGES.filter((c) => c.set === s).length;
  const recent = entries!.filter((e) => playerKey(e.p) === key).slice(-10).reverse();

  return (
    <>
      <h1>{player.name}</h1>
      <div class="sticky-bar">
        <div class="bar-group">
          <Tabs value={set} options={SETS} onChange={setSet} />
          <span class="muted">
            {measure === "rating" ? "Rating" : "Total"}{" "}
            <strong>{formatMeasure(measureOf(player, measure, set), measure)}</strong> ·{" "}
            {CHALLENGES.filter((c) => c.set === set && player.bests.has(c.id)).length} / {setCount(set)} played
          </span>
        </div>
        <div class="bar-group">
          <MeasureToggle value={measure} onChange={setMeasure} />
          <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
        </div>
      </div>
      <div class="stats">
        <Stat
          label={measure === "rating" ? "Rating" : "Total domination"}
          value={formatMeasure(measureOf(player, measure), measure)}
        />
        <Stat label="Records held" value={player.records} />
        <Stat label="Challenges played" value={`${player.played} / ${CHALLENGES.length}`} />
        <Stat label="Verified" value={player.verified} />
      </div>
      <p>
        <Link class="button" href={`/compare?a=${encodeURIComponent(player.name)}`}>
          Compare with someone…
        </Link>
      </p>

      <SetGrid
        set={set}
        cell={(c) => {
          const b = player.bests.get(c.id);
          if (!b) return <span class="muted">—</span>;
          const board = stats.boards.get(c.id)!;
          return (
            <span
              class={b.rank === 1 ? "record" : ""}
              title={measure === "rating" ? `Domination ${b.score}` : `${Math.round(b.pct)}% of the record`}
            >
              <strong>{measure === "rating" ? `${Math.round(b.pct)}%` : b.score}</strong>{" "}
              <span class="muted">
                #{b.rank}/{board.length}
              </span>
              {b.proof ? (
                <a class="proof-dot" href={b.proof} target="_blank" rel="noopener noreferrer" title="Open proof">
                  ✓
                </a>
              ) : null}
            </span>
          );
        }}
      />

      <PlayNext player={player} stats={stats} />

      <h2>Latest submissions</h2>
      <ul class="plain">
        {recent.map((e) => {
          const c = CHALLENGE_BY_ID.get(e.c)!;
          return (
            <li>
              <span class="muted">{formatDate(e.t)}</span> — <Link href={challengeHref(c.id)}>{c.name}</Link>{" "}
              <span class="muted">({SETS.find((s) => s.id === c.set)!.label})</span>: <strong>{e.s}</strong>
              {e.b ? <BugTag /> : null} <ProofLink url={e.u} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Suggestions: records within reach, and challenges not played yet. */
function PlayNext({ player, stats }: { player: PlayerSummary; stats: Stats }) {
  const SHOW = 8;
  const closest = [...player.bests.values()]
    .filter((b) => b.rank > 1)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, SHOW);
  const unplayed = CHALLENGES.filter((c) => !player.bests.has(c.id)).sort(
    (a, b) => a.difficulty - b.difficulty || (stats.boards.get(b.id)?.length ?? 0) - (stats.boards.get(a.id)?.length ?? 0),
  );
  if (closest.length === 0 && unplayed.length === 0) return null;
  const setLabel = (id: SetId) => SETS.find((s) => s.id === id)!.label;

  return (
    <>
      <h2>What to play next</h2>
      <div class="play-next">
        {closest.length > 0 && (
          <div>
            <h3 class="subhead">Records within reach</h3>
            <p class="muted">Where {player.name}'s best is closest to the record.</p>
            <div class="table-wrap">
              <table>
                <tbody>
                  {closest.map((b) => {
                    const c = CHALLENGE_BY_ID.get(b.challengeId)!;
                    const record = stats.boards.get(c.id)![0];
                    return (
                      <tr>
                        <td>
                          <Link href={challengeHref(c.id)}>{c.name}</Link>{" "}
                          <span class="muted">({setLabel(c.set)})</span>
                        </td>
                        <td class="num">{Math.round(b.pct)}%</td>
                        <td class="num muted" title={`Record: ${record.score} by ${record.player}`}>
                          {record.score - b.score + 1} to beat
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {unplayed.length > 0 && (
          <div>
            <h3 class="subhead">Not played yet ({unplayed.length})</h3>
            <p class="muted">Easiest first. Every new challenge raises the rating.</p>
            <div class="table-wrap">
              <table>
                <tbody>
                  {unplayed.slice(0, SHOW).map((c) => (
                    <tr>
                      <td>
                        <Link href={challengeHref(c.id)}>{c.name}</Link>{" "}
                        <span class="muted">({setLabel(c.set)})</span>
                      </td>
                      <td class="num muted">difficulty {c.difficulty}</td>
                      <td class="num muted">{stats.boards.get(c.id)?.length ?? 0} players</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unplayed.length > SHOW && <p class="muted">…and {unplayed.length - SHOW} more.</p>}
          </div>
        )}
      </div>
    </>
  );
}
