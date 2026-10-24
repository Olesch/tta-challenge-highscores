import { useMemo, useState } from "preact/hooks";
import { CHALLENGES, CHALLENGE_BY_ID, SETS, type SetId } from "../../shared/challenges";
import { playerKey } from "../../shared/validation";
import { Loading, ProofLink, Stat, Tabs, VerifiedToggle } from "../components";
import { computeStats, formatDate, useEntries, useVerifiedOnly } from "../data";
import { Link, challengeHref } from "../router";
import { SetGrid } from "../SetGrid";

export function PlayerPage({ name }: { name: string }) {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [set, setSet] = useState<SetId>("original");
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
            {name} has no verified scores yet.{" "}
            <button class="link" onClick={() => setVerifiedOnly(false)}>
              Show all scores
            </button>
          </p>
        ) : (
          <p class="muted">No scores for this player.</p>
        )}
      </>
    );
  }

  const setCount = (s: SetId) => CHALLENGES.filter((c) => c.set === s).length;
  const recent = entries!.filter((e) => playerKey(e.p) === key).slice(-10).reverse();

  return (
    <>
      <div class="page-head">
        <h1>{player.name}</h1>
        <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
      </div>
      <div class="stats">
        <Stat label="Records held" value={player.records} />
        <Stat label="Challenges played" value={`${player.played} / ${CHALLENGES.length}`} />
        <Stat label="Verified" value={player.verified} />
        <Stat label="Total score" value={player.total} />
      </div>
      <p>
        <Link class="button" href={`/compare?a=${encodeURIComponent(player.name)}`}>
          Compare with someone…
        </Link>
      </p>

      <div class="toolbar">
        <Tabs value={set} options={SETS} onChange={setSet} />
        <span class="muted">
          Total <strong>{player.totals[set]}</strong> · {CHALLENGES.filter((c) => c.set === set && player.bests.has(c.id)).length} /{" "}
          {setCount(set)} played
        </span>
      </div>
      <SetGrid
        set={set}
        cell={(c) => {
          const b = player.bests.get(c.id);
          if (!b) return <span class="muted">—</span>;
          const board = stats.boards.get(c.id)!;
          return (
            <span class={b.rank === 1 ? "record" : ""}>
              <strong>{b.score}</strong>{" "}
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

      <h2>Latest submissions</h2>
      <ul class="plain">
        {recent.map((e) => {
          const c = CHALLENGE_BY_ID.get(e.c)!;
          return (
            <li>
              <span class="muted">{formatDate(e.t)}</span> — <Link href={challengeHref(c.id)}>{c.name}</Link>{" "}
              <span class="muted">({SETS.find((s) => s.id === c.set)!.label})</span>: <strong>{e.s}</strong>{" "}
              <ProofLink url={e.u} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
