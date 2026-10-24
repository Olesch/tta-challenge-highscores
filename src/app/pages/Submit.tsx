import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { SubmitRequest } from "../../shared/api";
import { CHALLENGES, GROUP_LABELS, SETS, type SetId, groupsOf } from "../../shared/challenges";
import { normalizeProofUrl, playerKey, validateName, validateScore } from "../../shared/validation";
import { PlayerPicker, Tabs } from "../components";
import { computeStats, loadConfig, loadEntries, useEntries } from "../data";
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
        scores: filled.map((c) => ({ challengeId: c.id, score: Number(rows[c.id].score), proofUrl: proofFor(c.id) || undefined })),
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
      <div class="help">
        <p>
          Enter your <strong>domination</strong> for any challenges you like: your final score minus the score of the
          second-place player. You only need to fill in the ones you want to add or improve.
        </p>
        <p>
          <strong>To get an entry verified:</strong> post a screenshot of the result in the TtA Discord challenge channel,
          then right-click the message → <em>Copy Message Link</em> and paste it below. Entries without a link are saved
          and show up under “All entries”, but not in the official highscores.
        </p>
      </div>

      <div class="form-row">
        <label for="player">Your TtA username</label>
        <PlayerPicker id="player" value={name} onInput={setName} names={names} placeholder="e.g. Himmelstosh" />
        {me && (
          <span class="muted">
            Known player · {me.played} challenges · <Link href={playerHref(me.name)}>profile</Link>
          </span>
        )}
      </div>

      <div class="form-row">
        <label for="shared-proof">Discord link for all entries below (optional)</label>
        <input
          id="shared-proof"
          type="url"
          placeholder="https://discord.com/channels/…"
          value={sharedProof}
          onInput={(e) => setSharedProof((e.target as HTMLInputElement).value)}
        />
        <span class="muted">Used for every entry that doesn't have its own link.</span>
      </div>

      <Tabs
        value={set}
        options={SETS.map((s) => {
          const n = filled.filter((c) => c.set === s.id).length;
          return { id: s.id, label: n ? `${s.label} (${n})` : s.label };
        })}
        onChange={setSet}
      />

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
                    inputMode="numeric"
                    min={0}
                    step={1}
                    placeholder="Domination"
                    aria-label={`${c.name} domination`}
                    value={row.score}
                    onInput={(e) => setRow(c.id, { score: (e.target as HTMLInputElement).value })}
                  />
                  <input
                    class="proof-input"
                    type="url"
                    placeholder={sharedProof ? "uses link above" : "Discord link (optional)"}
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
        <button class="primary" disabled={!canSubmit} onClick={submit}>
          {busy ? "Saving…" : "Submit"}
        </button>
      </div>
    </>
  );
}
