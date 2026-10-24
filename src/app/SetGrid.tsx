import type { ComponentChildren } from "preact";
import { type Challenge, GROUP_LABELS, type SetId, groupsOf } from "../shared/challenges";
import { Link, challengeHref } from "./router";

/** Compact grid of a set's challenges in game layout (group rows, slot columns). */
export function SetGrid({ set, cell }: { set: SetId; cell: (c: Challenge) => ComponentChildren }) {
  return (
    <div class="set-grid">
      {groupsOf(set).map(({ group, challenges }) => (
        <div class="set-grid-row">
          <div class="set-grid-label">{GROUP_LABELS[group]}</div>
          {challenges.map((c) => (
            <div class="set-grid-cell">
              <Link class="set-grid-name" href={challengeHref(c.id)} title={c.name}>
                <img src={`/img/challenges/${c.id}.jpg`} alt="" loading="lazy" width={34} height={28} />
                <span>{c.name}</span>
              </Link>
              <div class="set-grid-value">{cell(c)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
