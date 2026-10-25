import { render } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { CHALLENGE_BY_ID } from "../shared/challenges";
import { Admin } from "./pages/Admin";
import { ChallengePage } from "./pages/ChallengePage";
import { Compare } from "./pages/Compare";
import { Highscores } from "./pages/Highscores";
import { PlayerPage } from "./pages/PlayerPage";
import { Players } from "./pages/Players";
import { Submit } from "./pages/Submit";
import { Weekly } from "./pages/Weekly";
import { downloadAll } from "./download";
import { DISCORD_CHANNEL_URL, TTA_APP_URL } from "./links";
import { Link, useLocation } from "./router";
import "./styles.css";

const NAV = [
  { href: "/", label: "Highscores" },
  { href: "/players", label: "Players" },
  { href: "/compare", label: "Compare" },
  { href: "/weekly", label: "Weekly winners" },
];

function isAdminBrowser() {
  try {
    return localStorage.getItem("isAdmin") === "1";
  } catch {
    return false;
  }
}

function resolve(path: string): { title: string; page: preact.JSX.Element } {
  let m: RegExpMatchArray | null;
  if (path === "/") return { title: "Highscores", page: <Highscores /> };
  if (path === "/players") return { title: "Players", page: <Players /> };
  if (path === "/compare") return { title: "Compare", page: <Compare /> };
  if (path === "/submit") return { title: "Submit domination", page: <Submit /> };
  if (path === "/weekly") return { title: "Weekly winners", page: <Weekly /> };
  if (path === "/admin") return { title: "Admin", page: <Admin /> };
  if ((m = path.match(/^\/player\/(.+)$/))) {
    const name = decodeURIComponent(m[1]);
    return { title: name, page: <PlayerPage key={name} name={name} /> };
  }
  if ((m = path.match(/^\/challenge\/(.+)$/))) {
    const id = decodeURIComponent(m[1]);
    return { title: CHALLENGE_BY_ID.get(id)?.name ?? "Challenge", page: <ChallengePage key={id} id={id} /> };
  }
  return { title: "Not found", page: <p class="error">Page not found.</p> };
}

function App() {
  const url = useLocation();
  const { title, page } = resolve(url.pathname);
  useEffect(() => {
    document.title = `${title} · TtA Challenges`;
  }, [title]);

  // Sticky switch bars sit just below the header; on phones the header isn't sticky, so they use the top.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current!;
    const update = () => {
      const sticky = getComputedStyle(header).position === "sticky";
      document.documentElement.style.setProperty("--header-h", sticky ? `${header.offsetHeight}px` : "0px");
    };
    const observer = new ResizeObserver(update);
    observer.observe(header);
    addEventListener("resize", update);
    return () => {
      observer.disconnect();
      removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <header class="site-header" ref={headerRef}>
        <Link href="/" class="brand">
          <span class="brand-mark">TtA</span> Challenge Highscores
        </Link>
        <nav>
          {NAV.map((n) => (
            <Link href={n.href} class={url.pathname === n.href ? "active" : ""}>
              {n.label}
            </Link>
          ))}
          {isAdminBrowser() && (
            <Link href="/admin" class={url.pathname === "/admin" ? "active" : ""}>
              Admin
            </Link>
          )}
          <Link href="/submit" class={`submit-link ${url.pathname === "/submit" ? "active" : ""}`}>
            Submit domination
          </Link>
        </nav>
      </header>
      <main class={url.pathname === "/admin" ? "wide" : ""}>{page}</main>
      <footer class="site-footer">
        <p>
          Fan-made leaderboard for the challenges of the{" "}
          <a href={TTA_APP_URL} target="_blank" rel="noopener noreferrer">
            <em>Through the Ages</em> app
          </a>{" "}
          by Czech Games Edition. Works on trust — verified entries
          link to a Discord post. Discussion happens in the{" "}
          <a href={DISCORD_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
            TtA Discord challenge channel
          </a>
          .
        </p>
        <p class="download">
          Download all data: <button onClick={() => downloadAll("csv")}>CSV (Excel)</button>{" "}
          <button onClick={() => downloadAll("json")}>JSON</button>
        </p>
      </footer>
    </>
  );
}

render(<App />, document.getElementById("app")!);
