import type { ComponentChildren } from "preact";
import type { Challenge } from "../shared/challenges";
import type { Best } from "./data";
import { Link, playerHref } from "./router";

export function ChallengeImage({ challenge, class: cls }: { challenge: Challenge; class?: string }) {
  return <img class={cls} src={`/img/challenges/${challenge.id}.jpg`} alt="" loading="lazy" width={340} height={284} />;
}

/** Difficulty as the game shows it: filled pips out of 6. */
export function Difficulty({ value }: { value: number }) {
  return (
    <span class="difficulty" title={`Difficulty ${value} of 6`} aria-label={`Difficulty ${value} of 6`}>
      {Array.from({ length: 6 }, (_, i) => (
        <span class={i < value ? "pip on" : "pip"} />
      ))}
    </span>
  );
}

export function ProofLink({ url }: { url: string | null }) {
  if (!url) return <span class="unverified" title="No proof linked">unverified</span>;
  return (
    <a class="proof" href={url} target="_blank" rel="noopener noreferrer" title="Open proof in Discord">
      ✓ proof
    </a>
  );
}

export function PlayerLink({ name }: { name: string }) {
  return <Link href={playerHref(name)}>{name}</Link>;
}

export function ScoreHolder({ best }: { best: Best | undefined }) {
  if (!best) return <span class="muted">No entry yet</span>;
  return (
    <span class="holder">
      <strong class="score">{best.score}</strong> <PlayerLink name={best.player} />
      {best.proof && (
        <a class="proof-dot" href={best.proof} target="_blank" rel="noopener noreferrer" title="Open proof in Discord">
          ✓
        </a>
      )}
    </span>
  );
}

export function VerifiedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div class="segmented" role="group" aria-label="Which entries to count">
      <button class={value ? "active" : ""} onClick={() => onChange(true)}>
        Verified only
      </button>
      <button class={!value ? "active" : ""} onClick={() => onChange(false)}>
        All entries
      </button>
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="tabs" role="tablist">
      {options.map((o) => (
        <button role="tab" aria-selected={o.id === value} class={o.id === value ? "active" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ComponentChildren }) {
  return (
    <div class="stat">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
  );
}

export function Loading({ error }: { error?: string | null }) {
  return <p class={error ? "error" : "muted"}>{error ?? "Loading…"}</p>;
}

export function PlayerPicker({
  id,
  value,
  onInput,
  names,
  placeholder,
}: {
  id: string;
  value: string;
  onInput: (v: string) => void;
  names: string[];
  placeholder?: string;
}) {
  return (
    <>
      <input
        id={id}
        list={`${id}-list`}
        value={value}
        placeholder={placeholder}
        autocomplete="off"
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      />
      <datalist id={`${id}-list`}>
        {names.map((n) => (
          <option value={n} />
        ))}
      </datalist>
    </>
  );
}

/** Marks an entry obtained through a since-fixed game bug. */
export function BugTag() {
  return (
    <span class="bug-tag" title="Obtained through a game bug that has since been fixed. Listed, but not counted anywhere.">
      bug
    </span>
  );
}
