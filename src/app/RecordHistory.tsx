import { useState } from "preact/hooks";
import type { Entry } from "../shared/api";
import { PlayerLink, ProofLink } from "./components";
import { formatDate } from "./data";

interface RecordStep {
  t: number;
  date: string;
  score: number;
  player: string;
  proof: string | null;
  /** Gain over the previous record, null for the first. */
  gain: number | null;
}

/** Each time the record of a challenge went up, in date order. */
function recordSteps(entries: Entry[], verifiedOnly: boolean): RecordStep[] {
  const counted = entries
    .filter((e) => !e.b && (!verifiedOnly || e.u))
    .sort((a, b) => a.t.localeCompare(b.t) || a.id - b.id);
  const steps: RecordStep[] = [];
  for (const e of counted) {
    const prev = steps[steps.length - 1];
    if (prev && e.s <= prev.score) continue;
    steps.push({ t: Date.parse(e.t), date: e.t, score: e.s, player: e.p, proof: e.u, gain: prev ? e.s - prev.score : null });
  }
  return steps;
}

const W = 800;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

/** Round ticks from at most `min` (and 0) to at least `max`, so every value stays inside the plot. */
function niceTicks(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [Math.floor(lo / step) * step];
  while (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function RecordHistory({ entries, verifiedOnly }: { entries: Entry[]; verifiedOnly: boolean }) {
  const steps = recordSteps(entries, verifiedOnly);
  const [hover, setHover] = useState<number | null>(null);
  if (steps.length === 0) return null;

  const now = Date.now();
  const t0 = steps[0].t;
  const t1 = Math.max(now, steps[steps.length - 1].t + 1);
  // Records only go up, so the first is the lowest (it can be negative: a lost game).
  const yTicks = niceTicks(steps[0].score, steps[steps.length - 1].score);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1] > yMin ? yTicks[yTicks.length - 1] : yMin + 1;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Step line: hold each record flat until the next one, then extend to today.
  let path = `M${x(steps[0].t)},${y(steps[0].score)}`;
  for (let i = 1; i < steps.length; i++) path += `H${x(steps[i].t)}V${y(steps[i].score)}`;
  path += `H${x(t1)}`;

  // Year ticks (or a start/end pair when the range is short).
  const years: number[] = [];
  for (let yr = new Date(t0).getFullYear() + 1; Date.UTC(yr, 0, 1) < t1; yr++) years.push(Date.UTC(yr, 0, 1));

  const active = hover === null ? null : steps[hover];

  return (
    <section class="record-history">
      <h3 class="subhead">Record history</h3>
      {steps.length > 1 && (
        <div class="chart-wrap" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Record over time; details in the table below">
            {yTicks.map((v) => (
              <g>
                <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
                <text class="axis" x={PAD.left - 8} y={y(v)} text-anchor="end" dominant-baseline="middle">
                  {v}
                </text>
              </g>
            ))}
            {years.map((t) => (
              <text class="axis" x={x(t)} y={H - 8} text-anchor="middle">
                {new Date(t).getUTCFullYear()}
              </text>
            ))}
            <path class="record-line" d={path} />
            {steps.map((s, i) => (
              <g onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}>
                <circle class="hit" cx={x(s.t)} cy={y(s.score)} r={14} />
                <circle class={hover === i ? "marker active" : "marker"} cx={x(s.t)} cy={y(s.score)} r={5} />
              </g>
            ))}
          </svg>
          {active && (
            <div
              class="chart-tooltip"
              style={{
                left: `${(x(active.t) / W) * 100}%`,
                top: `${(y(active.score) / H) * 100}%`,
              }}
            >
              <strong>{active.score}</strong> by {active.player}
              <div class="muted">
                {formatDate(active.date)}
                {active.gain !== null && ` · +${active.gain}`}
              </div>
            </div>
          )}
        </div>
      )}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Record holder</th>
              <th class="num">Domination</th>
              <th class="num">Improvement</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {[...steps].reverse().map((s) => (
              <tr>
                <td class="muted">{formatDate(s.date)}</td>
                <td>
                  <PlayerLink name={s.player} />
                </td>
                <td class="num score">{s.score}</td>
                <td class="num muted">{s.gain === null ? "first" : `+${s.gain}`}</td>
                <td>
                  <ProofLink url={s.proof} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
