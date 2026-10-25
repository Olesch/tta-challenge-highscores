import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Entry, SubmitRequest } from "../../shared/api";
import { CHALLENGES, type Challenge, GROUP_LABELS, SETS, type SetId, groupsOf } from "../../shared/challenges";
import { normalizeProofUrl, playerKey, validateName, validateScore } from "../../shared/validation";
import { PlayerPicker, ProofLink, Tabs } from "../components";
import { SUSPICIOUS_FACTOR, otherProofOwners, proofOwners, records } from "../checks";
import { type Best, computeStats, loadConfig, loadEntries, useEntries } from "../data";
import { DISCORD_CHANNEL_URL } from "../links";
import { Link, playerHref } from "../router";

interface Row {
  score: string;
  proof: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; theme?: string }) => string;
      reset: (id?: string) => void;
    };
  }
}

export function Submit() {
  const { entries } = useEntries();
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("playerName") ?? "";
    } catch {
      return "";
    }
  });
  const [set, setSet] = useState<SetId>("original");
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [sharedProof, setSharedProof] = useState("");
  const [guildId, setGuildId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    loadConfig().then((cfg) => {
      setGuildId(cfg.discordGuildId);
      if (!cfg.turnstileSiteKey) return;
      const render = () => {
        if (captchaRef.current && window.turnstile && widgetId.current === null) {
          widgetId.current = window.turnstile.render(captchaRef.current, {
            sitekey: cfg.turnstileSiteKey,
            callback: setToken,
            theme: "dark",
          });
        }
      };
      if (window.turnstile) return render();
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = render;
      document.head.appendChild(script);
    });
  }, []);

  const stats = useMemo(() => entries && computeStats(entries, false), [entries]);
  const names = stats ? [...stats.players.values()].map((p) => p.name).sort((a, b) => a.localeCompare(b)) : [];
  const me = stats?.players.get(playerKey(name));

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { score: "", proof: "" }), ...patch } }));

  const filled = CHALLENGES.filter((c) => rows[c.id]?.score.trim());
  const proofFor = (id: string) => rows[id]?.proof.trim() || sharedProof.trim();

  const errors: string[] = [];
  const nameError = name.trim() ? validateName(name) : null;
  if (nameError) errors.push(nameError);
  for (const c of filled) {
    const scoreError = validateScore(Number(rows[c.id].score));
    if (scoreError) errors.push(`${c.name}: ${scoreError}`);
    const proof = proofFor(c.id);
    if (proof && guildId && !normalizeProofUrl(proof, guildId)) {
      errors.push(`${c.name}: the proof must be a Discord message link from the TtA server.`);
    }
  }

  const submit = async () => {
    setStatus(null);
    setBusy(true);
    try {
      const body: SubmitRequest = {
        player: name,
        scores: filled.map((c) => ({
          challengeId: c.id,
          score: Number(rows[c.id].score),
          proofUrl: proofFor(c.id) || undefined,
        })),
        turnstileToken: token || undefined,
      };
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; count?: number };
      if (!res.ok) throw new Error(data.error ?? `Submit failed (${res.status})`);
      try {
        localStorage.setItem("playerName", name.trim());
      } catch {
        /* storage unavailable */
      }
      setRows({});
      setSharedProof("");
      setReviewing(false);
      setStatus({ kind: "ok", text: `Saved ${data.count} ${data.count === 1 ? "entry" : "entries"}.` });
      await loadEntries(true);
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
      setToken("");
      if (widgetId.current !== null) window.turnstile?.reset(widgetId.current);
    }
  };

  const verifiedCount = filled.filter((c) => proofFor(c.id)).length;
  const canSubmit = !busy && name.trim() && filled.length > 0 && errors.length === 0;

  return (
    <>
      <h1>Submit domination</h1>
      <section class="examples">
        <h2>What to post in Discord</h2>
        <p class="muted">For a verified entry, post at least these two screenshots of your game. Click to enlarge.</p>
        <div class="example-grid">
          <figure>
            <a href="/img/examples/result.jpg" target="_blank" rel="noopener">
              <img src="/img/examples/result.jpg" alt="Example: challenge results screen" width={1375} height={822} />
            </a>
            <figcaption>
              <strong>1. Challenge results</strong> — the final scores, with your own civilization in the background.
              Domination in this example: 374 − 293 = <strong>81</strong>.
            </figcaption>
          </figure>
          <figure>
            <a href="/img/examples/stats.jpg" target="_blank" rel="noopener">
              <img
                src="/img/examples/stats.jpg"
                alt="Example: culture statistics with leaders and wonders"
                width={1373}
                height={866}
              />
            </a>
            <figcaption>
              <strong>2. Statistics</strong> — the culture graph together with the leaders and wonders of every player.
            </figcaption>
          </figure>
          <figure>
            <div class="example-more" aria-hidden="true">
              ?
            </div>
            <figcaption>
              <strong>3. Anything else</strong> — feel free to post even more interesting images.
            </figcaption>
          </figure>
        </div>
      </section>
      <div class="help">
        <p>
          Enter your <strong>domination</strong> for any challenges you like: your final score minus the score of the
          second-place player. You only need to fill in the ones you want to add or improve.
        </p>
        <p>
          <strong>To get an entry verified:</strong> post both screenshots in the{" "}
          <a href={DISCORD_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
            TtA Discord challenge channel
          </a>
          , then right-click the message → <em>Copy Message Link</em> and paste it below. Entries without a link are
          saved and show up under “All entries”, but not in the official highscores.
        </p>
      </div>

      <div class="form-row">
        <label for="player">Your TtA username</label>
        <PlayerPicker id="player" value={name} onInput={setName} names={names} />
        {me && (
          <span class="muted">
            Known player · {me.played} challenges · <Link href={playerHref(me.name)}>profile</Link>
          </span>
        )}
      </div>

      <div class="form-row">
        <label for="shared-proof">Discord link for all entries below (optional, for verification)</label>
        <input
          id="shared-proof"
          type="url"
          placeholder="https://discord.com/channels/…"
          value={sharedProof}
          onInput={(e) => setSharedProof((e.target as HTMLInputElement).value)}
        />
        <span class="muted">Used for every entry that doesn't have its own link.</span>
      </div>

      {reviewing ? (
        <Review
          player={name.trim()}
          items={filled.map((c) => ({
            challenge: c,
            score: Number(rows[c.id].score),
            proof: normalizeProofUrl(proofFor(c.id), guildId),
          }))}
          entries={entries ?? []}
          myBests={me?.bests}
        />
      ) : (
        <>
          <div class="sticky-bar">
            <Tabs
              value={set}
              options={SETS.map((s) => {
                const n = filled.filter((c) => c.set === s.id).length;
                return { id: s.id, label: n ? `${s.label} (${n})` : s.label };
              })}
              onChange={setSet}
            />
          </div>

          <div class="submit-list">
            {groupsOf(set).map(({ group, challenges }) => (
              <fieldset>
                <legend>{GROUP_LABELS[group]}</legend>
                {challenges.map((c) => {
                  const best = me?.bests.get(c.id);
                  const row = rows[c.id] ?? { score: "", proof: "" };
                  const improved = row.score && best && Number(row.score) <= best.score;
                  return (
                    <div class="submit-row">
                      <img src={`/img/challenges/${c.id}.jpg`} alt="" width={56} height={47} loading="lazy" />
                      <div class="submit-name">
                        <div>{c.name}</div>
                        <div class="muted">
                          {c.players}P{best ? ` · your best ${best.score}${best.proof ? " ✓" : ""}` : ""}
                        </div>
                      </div>
                      <input
                        class="score-input"
                        type="number"
                        step={1}
                        placeholder="Domination"
                        aria-label={`${c.name} domination`}
                        value={row.score}
                        onInput={(e) => setRow(c.id, { score: (e.target as HTMLInputElement).value })}
                      />
                      <input
                        class="proof-input"
                        type="url"
                        placeholder={sharedProof ? "uses link above" : "Discord link (optional, for verification)"}
                        aria-label={`${c.name} proof link`}
                        value={row.proof}
                        onInput={(e) => setRow(c.id, { proof: (e.target as HTMLInputElement).value })}
                      />
                      {improved && <span class="hint">Not higher than your best</span>}
                    </div>
                  );
                })}
              </fieldset>
            ))}
          </div>
        </>
      )}

      <div class="submit-bar">
        <div>
          {filled.length === 0
            ? "Nothing entered yet."
            : `${filled.length} ${filled.length === 1 ? "entry" : "entries"} · ${verifiedCount} with proof`}
          {errors.length > 0 && (
            <ul class="error">
              {errors.slice(0, 5).map((e) => (
                <li>{e}</li>
              ))}
            </ul>
          )}
          {status && <p class={status.kind === "ok" ? "ok" : "error"}>{status.text}</p>}
          {status?.kind === "ok" && name && (
            <p>
              <Link href={playerHref(name.trim())}>See your profile →</Link>
            </p>
          )}
        </div>
        <div ref={captchaRef} />
        {reviewing ? (
          <div class="bar-buttons">
            <button disabled={busy} onClick={() => setReviewing(false)}>
              ← Back to editing
            </button>
            <button class="primary" disabled={!canSubmit} onClick={submit}>
              {busy ? "Saving…" : "Confirm & submit"}
            </button>
          </div>
        ) : (
          <button
            class="primary"
            disabled={!canSubmit}
            onClick={() => {
              setStatus(null);
              setReviewing(true);
              window.scrollTo(0, 0);
            }}
          >
            Check entries →
          </button>
        )}
      </div>
    </>
  );
}

interface ReviewItem {
  challenge: Challenge;
  score: number;
  proof: string | null;
}

/** Last look before saving: what each entry changes, plus anything that looks like a mistake. */
function Review({
  player,
  items,
  entries,
  myBests,
}: {
  player: string;
  items: ReviewItem[];
  entries: Entry[];
  myBests: Map<string, Best> | undefined;
}) {
  const current = records(entries);
  const others = records(entries, player);
  const owners = proofOwners(entries);
  const newRecords = items.filter(
    (i) => i.score >= 0 && i.score > (current.verified.get(i.challenge.id)?.s ?? -Infinity),
  ).length;

  return (
    <section class="review">
      <h2>Check your entries</h2>
      <p>
        Saving <strong>{items.length}</strong> {items.length === 1 ? "entry" : "entries"} as <strong>{player}</strong>.
        {newRecords > 0 && (
          <>
            {" "}
            <span class="badge record">
              ★ {newRecords} {newRecords === 1 ? "beats a record" : "beat records"}
            </span>
          </>
        )}
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Challenge</th>
              <th class="num">Domination</th>
              <th>Proof</th>
              <th class="num">Your best</th>
              <th class="num">Record</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ challenge: c, score, proof }) => {
              const mine = myBests?.get(c.id);
              const record = current.verified.get(c.id);
              const othersBest = others.all.get(c.id);
              const notes: { kind: "good" | "warn"; text: string }[] = [];
              if (score < 0) {
                notes.push({ kind: "warn", text: "Negative scores are not counted in your sums/percentages" });
              } else if (!record || score > record.s) {
                notes.push(
                  proof
                    ? { kind: "good", text: "★ New record!" }
                    : { kind: "good", text: "★ Beats the record (add proof to make it official)" },
                );
              }
              if (!mine) notes.push({ kind: "good", text: "First entry for this challenge" });
              else if (score > mine.score) notes.push({ kind: "good", text: `↑ +${score - mine.score} on your best` });
              else notes.push({ kind: "warn", text: "Not higher than your best" });
              if (othersBest && othersBest.s > 0 && score > othersBest.s * SUSPICIOUS_FACTOR) {
                notes.push({ kind: "warn", text: "More than double everyone else's best. Typo?" });
              }
              const reused = otherProofOwners(owners, proof, player);
              if (reused.length) notes.push({ kind: "warn", text: `Proof link already used by ${reused.join(", ")}` });
              return (
                <tr>
                  <td>
                    {c.name} <span class="muted">({SETS.find((s) => s.id === c.set)!.label})</span>
                  </td>
                  <td class="num score">{score}</td>
                  <td>{proof ? <ProofLink url={proof} /> : <span class="unverified">none</span>}</td>
                  <td class="num muted">{mine ? mine.score : "—"}</td>
                  <td class="num muted" title={record ? `${record.p}` : "No verified record yet"}>
                    {record ? record.s : "—"}
                  </td>
                  <td class="notes">
                    {notes.map((n) => (
                      <span class={`badge ${n.kind}`}>{n.text}</span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
