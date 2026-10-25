import { useMemo, useState } from "preact/hooks";
import { CHALLENGES, CHALLENGE_BY_ID, SETS, type SetId } from "../../shared/challenges";
import { playerKey } from "../../shared/validation";
import { BugTag, Loading, MeasureToggle, ProofLink, Stat, Tabs } from "../components";
import {
  type Best,
  type Measure,
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
  const [set, setSet] = useState<SetId>("mix");
  const [measure, setMeasure] = useMeasure();
  const [asIfVerified, setAsIfVerified] = useState(false);
  const key = playerKey(name);
  const unproven = entries ? entries.filter((e) => !e.u && !e.b && playerKey(e.p) === key).length : 0;
  const whatIf = verifiedOnly && asIfVerified && unproven > 0;
  const stats = useMemo(
    () => entries && computeStats(entries, verifiedOnly, whatIf ? key : undefined),
    [entries, verifiedOnly, whatIf, key],
  );

  if (!stats) return <Loading error={error} />;
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
          <div class="segmented" role="group" aria-label="Which entries to count">
            <button
              class={verifiedOnly && !whatIf ? "active" : ""}
              onClick={() => {
                setVerifiedOnly(true);
                setAsIfVerified(false);
              }}
            >
              Verified only
            </button>
            {unproven > 0 && (
              <button
                class={whatIf ? "active" : ""}
                title={`Count ${player.name}'s unproven entries as if they were verified`}
                onClick={() => {
                  setVerifiedOnly(true);
                  setAsIfVerified(true);
                }}
              >
                As if verified
              </button>
            )}
            <button class={!verifiedOnly ? "active" : ""} onClick={() => setVerifiedOnly(false)}>
              All entries
            </button>
          </div>
        </div>
      </div>
      {whatIf && (
        <p class="what-if">
          <strong>What if:</strong> all {unproven} unproven {unproven === 1 ? "entry" : "entries"} of {player.name}{" "}
          count as verified, measured against the official records (which stay as they are), so a best above the
          record rates over 100%. Post the screenshots in Discord and add the links to make it official.
        </p>
      )}
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
                #{b.rank}/{board.length + (board.some((o) => o.key === key) ? 0 : 1)}
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

      <PlayNext player={player} stats={stats} measure={measure} />

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
function PlayNext({ player, stats, measure }: { player: PlayerSummary; stats: Stats; measure: Measure }) {
  const SHOW = 8;
  const gap = (b: Best) => stats.boards.get(b.challengeId)![0].score - b.score;
  const closest = [...player.bests.values()]
    .filter((b) => b.rank > 1)
    .sort((a, b) => (measure === "rating" ? b.pct - a.pct : gap(a) - gap(b)))
    .slice(0, SHOW);
  const lowest = [...player.bests.values()]
    .filter((b) => b.rank > 1)
    .sort((a, b) => (measure === "rating" ? a.pct - b.pct : a.score - b.score))
    .slice(0, SHOW);
  const unplayed = CHALLENGES.length - player.played;
  if (closest.length === 0 && lowest.length === 0 && unplayed === 0) return null;
  const setLabel = (id: SetId) => SETS.find((s) => s.id === id)!.label;

  return (
    <>
      <h2>What to play next</h2>
      <div class="play-next">
        {closest.length > 0 && (
          <div>
            <h3 class="subhead">Records within reach</h3>
            <p class="muted">
              Where {player.name}'s best is closest to the record
              {measure === "rating" ? " (in % of the record)" : " (fewest points to beat it)"}.
            </p>
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
        {(lowest.length > 0 || unplayed > 0) && (
          <div>
            <h3 class="subhead">Lowest results</h3>
            <p class="muted">
              {measure === "rating"
                ? `Where ${player.name}'s best is the lowest % of the record: the most rating to gain.`
                : `${player.name}'s lowest best dominations.`}
            </p>
            {lowest.length > 0 && (
              <div class="table-wrap">
                <table>
                  <tbody>
                    {lowest.map((b) => {
                      const c = CHALLENGE_BY_ID.get(b.challengeId)!;
                      const record = stats.boards.get(c.id)![0];
                      return (
                        <tr>
                          <td>
                            <Link href={challengeHref(c.id)}>{c.name}</Link>{" "}
                            <span class="muted">({setLabel(c.set)})</span>
                          </td>
                          <td class="num">{Math.round(b.pct)}%</td>
                          <td class="num muted" title={`Record by ${record.player}`}>
                            {b.score} of {record.score}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {unplayed > 0 && (
              <p class="muted">
                Plus {unplayed} {unplayed === 1 ? "challenge" : "challenges"} not played yet, each counting as 0%.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
