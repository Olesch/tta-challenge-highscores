import { useEffect, useState } from "preact/hooks";
import type { AdminEntry } from "../../shared/api";
import { CHALLENGE_BY_ID } from "../../shared/challenges";
import { formatDate, loadEntries } from "../data";

function storedToken() {
  try {
    return sessionStorage.getItem("adminToken") ?? "";
  } catch {
    return "";
  }
}

export function Admin() {
  const [token, setToken] = useState(storedToken);
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<AdminEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const api = async (path: string, init?: RequestInit) => {
    const res = await fetch(`/api/admin/${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const data = await res.json();
    if (res.status === 401) {
      setToken("");
      sessionStorage.removeItem("adminToken");
    }
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
    return data;
  };

  const reload = () =>
    api("entries").then(
      (d) => {
        setEntries(d as AdminEntry[]);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );

  useEffect(() => {
    if (token) reload();
  }, [token]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await reload();
      loadEntries(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!token) {
    return (
      <>
        <h1>Admin</h1>
        <form
          class="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem("adminToken", password);
            setToken(password);
          }}
        >
          <label for="pw">Admin password</label>
          <input id="pw" type="password" value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
          <button class="primary">Sign in</button>
        </form>
        {error && <p class="error">{error}</p>}
      </>
    );
  }

  const q = filter.trim().toLowerCase();
  const rows = (entries ?? []).filter((e) => {
    if (!showHidden && e.hidden) return false;
    if (!q) return true;
    const c = CHALLENGE_BY_ID.get(e.c);
    return e.p.toLowerCase().includes(q) || e.c.includes(q) || (c?.name.toLowerCase().includes(q) ?? false);
  });

  return (
    <>
      <div class="page-head">
        <h1>Admin</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem("adminToken");
            setToken("");
          }}
        >
          Sign out
        </button>
      </div>
      {error && <p class="error">{error}</p>}

      <section class="admin-box">
        <h2>Merge player names</h2>
        <p class="muted">Moves every entry of the first name to the second (e.g. to fix a typo).</p>
        <div class="inline-form">
          <input placeholder="From" value={renameFrom} onInput={(e) => setRenameFrom((e.target as HTMLInputElement).value)} />
          <span>→</span>
          <input placeholder="To" value={renameTo} onInput={(e) => setRenameTo((e.target as HTMLInputElement).value)} />
          <button
            disabled={!renameFrom.trim() || !renameTo.trim()}
            onClick={() =>
              act(async () => {
                const r = (await api("rename", { method: "POST", body: JSON.stringify({ from: renameFrom, to: renameTo }) })) as {
                  changed: number;
                };
                setError(null);
                alert(`Moved ${r.changed} entries.`);
                setRenameFrom("");
                setRenameTo("");
              })
            }
          >
            Merge
          </button>
        </div>
      </section>

      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder="Filter by player or challenge…"
          value={filter}
          onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
        />
        <label class="check">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden((e.target as HTMLInputElement).checked)} />
          Show hidden
        </label>
        <span class="muted">{rows.length} entries</span>
      </div>

      {!entries ? (
        <p class="muted">Loading…</p>
      ) : (
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th class="num">ID</th>
                <th>Date</th>
                <th>Player</th>
                <th>Challenge</th>
                <th class="num">Domination</th>
                <th>Proof</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((e) => {
                const c = CHALLENGE_BY_ID.get(e.c);
                return (
                  <tr class={e.hidden ? "hidden-row" : ""}>
                    <td class="num">{e.id}</td>
                    <td class="muted">{formatDate(e.t)}</td>
                    <td>{e.p}</td>
                    <td>
                      {c?.name} <span class="muted">({c?.set})</span>
                    </td>
                    <td class="num">
                      <button
                        class="link"
                        title="Edit domination"
                        onClick={() => {
                          const v = prompt("New domination", String(e.s));
                          if (v !== null) act(() => api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ score: Number(v) }) }));
                        }}
                      >
                        {e.s}
                      </button>
                    </td>
                    <td>
                      {e.u ? (
                        <a href={e.u} target="_blank" rel="noopener noreferrer">
                          link
                        </a>
                      ) : (
                        <span class="muted">none</span>
                      )}{" "}
                      <button
                        class="link"
                        onClick={() => {
                          const v = prompt("Proof link (empty to remove)", e.u ?? "");
                          if (v !== null) act(() => api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ proofUrl: v }) }));
                        }}
                      >
                        edit
                      </button>
                    </td>
                    <td class="muted">
                      {e.source}
                      {e.ipHash ? ` · ${e.ipHash.slice(0, 6)}` : ""}
                    </td>
                    <td>
                      {e.hidden ? (
                        <button
                          title={e.hiddenReason ?? ""}
                          onClick={() => act(() => api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ hidden: false }) }))}
                        >
                          Unhide
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const reason = prompt("Reason for hiding (optional)", "");
                            if (reason !== null)
                              act(() =>
                                api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ hidden: true, hiddenReason: reason }) }),
                              );
                          }}
                        >
                          Hide
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 300 && <p class="muted">Showing the newest 300; use the filter to find older entries.</p>}
        </div>
      )}
    </>
  );
}
