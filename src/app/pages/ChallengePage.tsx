import { useMemo } from "preact/hooks";
import { CHALLENGE_BY_ID, GROUP_LABELS, SETS } from "../../shared/challenges";
import { ChallengeImage, Difficulty, Loading, PlayerLink, ProofLink, VerifiedToggle } from "../components";
import { computeStats, formatDate, useEntries, useVerifiedOnly } from "../data";
import { Link } from "../router";

const LEVEL_LABEL = { easy: "Easy AI", medium: "Medium AI", hard: "Top AI" };

export function ChallengePage({ id }: { id: string }) {
  const challenge = CHALLENGE_BY_ID.get(id);
  const { entries, error } = useEntries();
  const [verifiedOnly, setVerifiedOnly] = useVerifiedOnly();
  const stats = useMemo(() => entries && computeStats(entries, verifiedOnly), [entries, verifiedOnly]);

  if (!challenge) return <p class="error">Unknown challenge.</p>;
  const setLabel = SETS.find((s) => s.id === challenge.set)!.label;
  const board = stats?.boards.get(id) ?? [];
  const history = (entries ?? []).filter((e) => e.c === id).reverse();

  return (
    <>
      <p class="crumbs">
        <Link href="/">Highscores</Link> / {setLabel} / {GROUP_LABELS[challenge.group]}
      </p>
      <div class="challenge-head" style={{ "--group-bg": `url(/img/groups/${challenge.group}.jpg)` }}>
        <ChallengeImage challenge={challenge} class="challenge-img" />
        <div>
          <h1>{challenge.name}</h1>
          <p class="card-meta">
            {setLabel} · {challenge.players} players <Difficulty value={challenge.difficulty} />
          </p>
          {challenge.description.map((d) => (
            <p class="flavor">{d}</p>
          ))}
          <ul class="rules">
            {challenge.rules.map((r) => (
              <li>{r}</li>
            ))}
          </ul>
          <p class="opponents">
            Opponents:{" "}
            {challenge.opponents.map((o) => (
              <span class={`chip ${o.level}`}>{o.name ?? LEVEL_LABEL[o.level]}</span>
            ))}
          </p>
        </div>
      </div>

      <div class="page-head">
        <h2>Ranking</h2>
        <VerifiedToggle value={verifiedOnly} onChange={setVerifiedOnly} />
      </div>
      {!stats ? (
        <Loading error={error} />
      ) : board.length === 0 ? (
        <p class="muted">No {verifiedOnly ? "verified " : ""}scores yet.</p>
      ) : (
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="num">#</th>
                <th>Player</th>
                <th class="num">Score</th>
                <th>Proof</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {board.map((b) => (
                <tr class={b.rank === 1 ? "first" : ""}>
                  <td class="num">{b.rank}</td>
                  <td>
                    <PlayerLink name={b.player} />
                  </td>
                  <td class="num score">{b.score}</td>
                  <td>
                    <ProofLink url={b.proof} />
                  </td>
                  <td class="muted">{formatDate(b.t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <details class="history">
          <summary>All {history.length} submissions</summary>
          <div class="table-wrap">
            <table>
              <tbody>
                {history.map((e) => (
                  <tr>
                    <td class="muted">{formatDate(e.t)}</td>
                    <td>
                      <PlayerLink name={e.p} />
                    </td>
                    <td class="num">{e.s}</td>
                    <td>
                      <ProofLink url={e.u} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
