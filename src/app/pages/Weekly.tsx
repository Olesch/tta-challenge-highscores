import weekly from "../../../data/weekly.json";
import { CHALLENGE_BY_ID } from "../../shared/challenges";
import { PlayerLink } from "../components";
import { formatDate } from "../data";
import { Link, challengeHref } from "../router";

interface Placing {
  name: string;
  score: number;
}

interface Week {
  number: number;
  date: string;
  challengeId: string;
  winners: Placing[];
  runnersUp: Placing[];
}

const WEEKS = weekly as Week[];

function Placings({ list }: { list: Placing[] }) {
  if (list.length === 0) return <span class="muted">—</span>;
  return (
    <>
      {list.map((p, i) => (
        <span>
          {i > 0 && (list[i - 1].score === p.score ? " & " : ", ")}
          <PlayerLink name={p.name} /> <span class="muted">{p.score}</span>
        </span>
      ))}
    </>
  );
}

export function Weekly() {
  const wins = new Map<string, number>();
  for (const w of WEEKS) for (const p of w.winners) wins.set(p.name, (wins.get(p.name) ?? 0) + 1);
  const champions = [...wins].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <h1>Weekly Challenge winners</h1>
      <p class="lead">
        From September 2024 to July 2025, a Random Mix challenge was featured every week, and the best verified score by
        Sunday 15:00 (European time) won. The event has ended; here are its champions, for old times' sake.
      </p>

      <p class="champions">
        {champions.map(([name, n]) => (
          <span class="chip">
            <PlayerLink name={name} /> × {n}
          </span>
        ))}
      </p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Week of</th>
              <th>Challenge</th>
              <th>Winner</th>
              <th>Runner-up</th>
            </tr>
          </thead>
          <tbody>
            {WEEKS.map((w) => {
              const c = CHALLENGE_BY_ID.get(w.challengeId)!;
              return (
                <tr>
                  <td class="num">{w.number}</td>
                  <td class="muted">{formatDate(w.date)}</td>
                  <td>
                    <Link class="inline-challenge" href={challengeHref(c.id)}>
                      <img src={`/img/challenges/${c.id}.jpg`} alt="" width={34} height={28} loading="lazy" />
                      {c.name}
                    </Link>
                  </td>
                  <td>
                    <Placings list={w.winners} />
                  </td>
                  <td>
                    <Placings list={w.runnersUp} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
