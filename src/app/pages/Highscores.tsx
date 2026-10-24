import { useMemo, useState } from "preact/hooks";
import { CHALLENGES, GROUP_LABELS, SETS, type SetId, groupsOf } from "../../shared/challenges";
import { ChallengeImage, Difficulty, Loading, PlayerLink, ScoreHolder, Tabs, VerifiedToggle } from "../components";
import { type ScopeTotal, computeStats, scopeTotal, useEntries, useVerifiedOnly } from "../data";
import { Link, challengeHref } from "../router";

function readSet(): SetId {
  try {
    return (sessionStorage.getItem("set") as SetId) || "original";
  } catch {
    return "original";
  }
}

/** "Pooled 1234 · Best player: Name 1100" */
function TotalsLine({ total }: { total: ScopeTotal }) {
  const best = total.ranking[0];
  return (
    <span class="totals-line">
      <span title="Sum of every record in this scope — what all players together have achieved">
        Pooled <strong>{total.pooled}</strong>
        {total.covered < total.size && <span class="muted"> ({total.covered}/{total.size})</span>}
      </span>
      {best && (
        <span title="Highest sum of one player's own best scores in this scope">
          Best player <strong>{best.total}</strong> <PlayerLink name={best.name} />
        </span>
      )}
    </span>
  );
}

export function Highscores() {
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const [set, setSet] = useState<SetId>(readSet);
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  const chooseSet = (s: SetId) => {
    setSet(s);
    try {
      sessionStorage.setItem("set", s);
    } catch {
      /* storage unavailable */
    }
  };

  if (!stats) return <Loading error={error} />;

  const groups = groupsOf(set);
  const scopes = [
    ...SETS.map((s) => ({ label: s.label, total: scopeTotal(stats, CHALLENGES.filter((c) => c.set === s.id)) })),
    { label: "Everything", total: scopeTotal(stats, CHALLENGES) },
  ];
  const recordHolders = [...stats.players.values()].filter((p) => p.records > 0).sort((a, b) => b.records - a.records);

  return (
    <>
      <div class="page-head">
        <h1>Domination Highscores</h1>
        <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
      </div>
      <p class="lead">
        {verifiedOnly
          ? "Official records: only scores with a linked Discord proof count."
          : "All submitted scores, including ones without proof."}{" "}
        <Link href="/submit">Submit your scores →</Link>
      </p>

      <div class="toolbar">
        <Tabs value={set} options={SETS} onChange={chooseSet} />
        <TotalsLine total={scopes[SETS.findIndex((s) => s.id === set)].total} />
      </div>

      {groups.map(({ group, challenges }) => (
        <section class="group" style={{ "--group-bg": `url(/img/groups/${group}.jpg)` }}>
          <div class="group-head">
            <h2 class="group-title">{GROUP_LABELS[group] ?? group}</h2>
            <TotalsLine total={scopeTotal(stats, challenges)} />
          </div>
          <div class="cards">
            {challenges.map((c) => {
              const board = stats.boards.get(c.id) ?? [];
              return (
                <div class="card">
                  <Link class="card-link" href={challengeHref(c.id)} aria-label={c.name}>
                    <ChallengeImage challenge={c} class="card-img" />
                  </Link>
                  <div class="card-body">
                    <Link class="card-title" href={challengeHref(c.id)}>
                      {c.name}
                    </Link>
                    <div class="card-meta">
                      {c.players}P <Difficulty value={c.difficulty} />
                      <span class="muted">{board.length} players</span>
                    </div>
                    <div class="card-record">
                      <ScoreHolder best={board[0]} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2>Totals</h2>
        <p class="lead">
          <strong>Pooled</strong> adds up the record of every challenge, as if all players formed one team.{" "}
          <strong>Best single player</strong> is the highest sum of one player's own best scores.
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Scope</th>
                <th class="num">Pooled</th>
                <th class="num">Records set</th>
                <th>Best single player</th>
                <th>Runners-up</th>
              </tr>
            </thead>
            <tbody>
              {scopes.map(({ label, total }) => (
                <tr>
                  <td>{label}</td>
                  <td class="num score">{total.pooled}</td>
                  <td class="num">
                    {total.covered}/{total.size}
                  </td>
                  <td>
                    {total.ranking[0] ? (
                      <>
                        <strong>{total.ranking[0].total}</strong> <PlayerLink name={total.ranking[0].name} />{" "}
                        <span class="muted">
                          ({total.ranking[0].played}/{total.size} played)
                        </span>
                      </>
                    ) : (
                      <span class="muted">—</span>
                    )}
                  </td>
                  <td>
                    {total.ranking.slice(1, 4).map((r, i) => (
                      <span>
                        {i > 0 && ", "}
                        <PlayerLink name={r.name} /> <span class="muted">{r.total}</span>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Most records held</h2>
        {recordHolders.length === 0 ? (
          <p class="muted">No records yet.</p>
        ) : (
          <ol class="podium">
            {recordHolders.slice(0, 10).map((p) => (
              <li>
                <PlayerLink name={p.name} /> <span class="muted">— {p.records} records</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
