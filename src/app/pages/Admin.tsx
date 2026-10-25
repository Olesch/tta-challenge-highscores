import { useEffect, useState } from "preact/hooks";
import type { AdminEntry } from "../../shared/api";
import { CHALLENGE_BY_ID } from "../../shared/challenges";
import { isFarAbove, otherProofOwners, proofOwners, records } from "../checks";
import { BugTag } from "../components";
import { formatDate, loadEntries } from "../data";

type View = "all" | "unchecked" | "checked" | "unverified" | "flagged" | "bug" | "hidden";
const PAGE_SIZES = [25, 50, 100, 250, 0]; // 0 = all

function storedPageSize(): number {
  try {
    const raw = localStorage.getItem("adminPageSize");
    return raw !== null && PAGE_SIZES.includes(Number(raw)) ? Number(raw) : 50;
  } catch {
    return 50;
  }
}

function storedToken() {
  try {
    return sessionStorage.getItem("adminToken") ?? "";
  } catch {
    return "";
  }
}

/** Remember that this browser belongs to an admin, so the header shows an Admin link (no secret is stored). */
function markAdminBrowser() {
  try {
    localStorage.setItem("isAdmin", "1");
  } catch {
    /* storage unavailable */
  }
}

export function Admin() {
  const [token, setToken] = useState(storedToken);
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<AdminEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<View>("all");
  const [pageSize, setPageSize] = useState(storedPageSize);
  const [page, setPage] = useState(1);
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
        markAdminBrowser();
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
          <input
            id="pw"
            type="password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          />
          <button class="primary">Sign in</button>
        </form>
        {error && <p class="error">{error}</p>}
      </>
    );
  }

  // Suspicious-entry checks run against what the public sees (hidden entries left out).
  const visible = (entries ?? []).filter((e) => !e.hidden);
  const owners = proofOwners(visible);
  const flagsOf = (e: AdminEntry): string[] => {
    const flags: string[] = [];
    const best = records(visible, e.p).all.get(e.c);
    if (!e.b && isFarAbove(e.s, e.u, best))
      flags.push(`no proof, over 2× everyone else's best (${best!.s} by ${best!.p})`);
    const others = otherProofOwners(owners, e.u, e.p);
    if (others.length) flags.push(`proof also used by ${others.join(", ")}`);
    return flags;
  };
  const flagged = new Map((entries ?? []).map((e) => [e.id, flagsOf(e)]));

  const inView: Record<View, (e: AdminEntry) => boolean> = {
    all: () => true,
    unchecked: (e) => !e.hidden && !!e.u && !e.checked,
    checked: (e) => !e.hidden && !!e.u && e.checked,
    unverified: (e) => !e.hidden && !e.u,
    flagged: (e) => flagged.get(e.id)!.length > 0,
    bug: (e) => !!e.b,
    hidden: (e) => e.hidden,
  };
  const count = (v: View) => (entries ?? []).filter(inView[v]).length;
  const VIEWS: { id: View; label: string }[] = [
    { id: "all", label: "All entries" },
    { id: "unchecked", label: "Verified – not checked yet" },
    { id: "checked", label: "Verified – checked" },
    { id: "unverified", label: "Unverified" },
    { id: "flagged", label: "Flagged" },
    { id: "bug", label: "Bug" },
    { id: "hidden", label: "Hidden" },
  ];

  const q = filter.trim().toLowerCase();
  const rows = (entries ?? []).filter((e) => {
    if (!inView[view](e)) return false;
    if (!q) return true;
    const c = CHALLENGE_BY_ID.get(e.c);
    return e.p.toLowerCase().includes(q) || e.c.includes(q) || (c?.name.toLowerCase().includes(q) ?? false);
  });

  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pages);
  const shown = pageSize ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;

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
          <input
            placeholder="From"
            value={renameFrom}
            onInput={(e) => setRenameFrom((e.target as HTMLInputElement).value)}
          />
          <span>→</span>
          <input placeholder="To" value={renameTo} onInput={(e) => setRenameTo((e.target as HTMLInputElement).value)} />
          <button
            disabled={!renameFrom.trim() || !renameTo.trim()}
            onClick={() =>
              act(async () => {
                const r = (await api("rename", {
                  method: "POST",
                  body: JSON.stringify({ from: renameFrom, to: renameTo }),
                })) as {
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
          onInput={(e) => {
            setFilter((e.target as HTMLInputElement).value);
            setPage(1);
          }}
        />
        <label class="check">
          Show
          <select
            value={view}
            onChange={(e) => {
              setView((e.target as HTMLSelectElement).value as View);
              setPage(1);
            }}
          >
            {VIEWS.map((v) => (
              <option value={v.id}>
                {v.label} ({count(v.id)})
              </option>
            ))}
          </select>
        </label>
        <label class="check">
          Per page
          <select
            value={pageSize}
            onChange={(e) => {
              const n = Number((e.target as HTMLSelectElement).value);
              setPageSize(n);
              setPage(1);
              try {
                localStorage.setItem("adminPageSize", String(n));
              } catch {
                /* storage unavailable */
              }
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option value={n}>{n || "All"}</option>
            ))}
          </select>
        </label>
        <span class="muted">{rows.length} entries</span>
      </div>

      {!entries ? (
        <p class="muted">Loading…</p>
      ) : (
        <>
          <Pager page={currentPage} pages={pages} onChange={setPage} />
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
                  <th>Flags</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => {
                  const c = CHALLENGE_BY_ID.get(e.c);
                  return (
                    <tr class={e.hidden ? "hidden-row" : e.u && !e.checked ? "unchecked-row" : ""}>
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
                            if (v !== null)
                              act(() =>
                                api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ score: Number(v) }) }),
                              );
                          }}
                        >
                          {e.s}
                        </button>
                        {e.b ? <BugTag /> : null}
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
                            if (v !== null)
                              act(() =>
                                api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ proofUrl: v }) }),
                              );
                          }}
                        >
                          edit
                        </button>
                        {e.u && (
                          <div class="check-cell">
                            {e.checked ? (
                              <span class="badge good">✓ checked</span>
                            ) : (
                              <span class="badge warn">not checked</span>
                            )}{" "}
                            <button
                              class="link"
                              onClick={() =>
                                act(() =>
                                  api(`entries/${e.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ checked: !e.checked }),
                                  }),
                                )
                              }
                            >
                              {e.checked ? "uncheck" : "mark checked"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td class="muted">
                        {e.source}
                        {e.ipHash ? ` · ${e.ipHash.slice(0, 6)}` : ""}
                      </td>
                      <td class="flags">
                        {flagged.get(e.id)!.map((f) => (
                          <div>⚠ {f}</div>
                        ))}
                      </td>
                      <td class="actions">
                        <button
                          title="Obtained through a fixed game bug: listed but never counted"
                          onClick={() =>
                            act(() =>
                              api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ bugged: !e.b }) }),
                            )
                          }
                        >
                          {e.b ? "Not a bug" : "Bug"}
                        </button>{" "}
                        {e.hidden ? (
                          <button
                            title={e.hiddenReason ?? ""}
                            onClick={() =>
                              act(() =>
                                api(`entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ hidden: false }) }),
                              )
                            }
                          >
                            Unhide
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const reason = prompt("Reason for hiding (optional)", "");
                              if (reason !== null)
                                act(() =>
                                  api(`entries/${e.id}`, {
                                    method: "PATCH",
                                    body: JSON.stringify({ hidden: true, hiddenReason: reason }),
                                  }),
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
          </div>
          <Pager page={currentPage} pages={pages} onChange={setPage} />
        </>
      )}
    </>
  );
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div class="pager">
      <button disabled={page === 1} onClick={() => onChange(1)} aria-label="First page">
        «
      </button>
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹ Prev
      </button>
      <span>
        Page{" "}
        <select
          value={page}
          onChange={(e) => onChange(Number((e.target as HTMLSelectElement).value))}
          aria-label="Page"
        >
          {Array.from({ length: pages }, (_, i) => (
            <option value={i + 1}>{i + 1}</option>
          ))}
        </select>{" "}
        of {pages}
      </span>
      <button disabled={page === pages} onClick={() => onChange(page + 1)}>
        Next ›
      </button>
      <button disabled={page === pages} onClick={() => onChange(pages)} aria-label="Last page">
        »
      </button>
    </div>
  );
}
