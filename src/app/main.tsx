import { render } from "preact";
import { useEffect } from "preact/hooks";
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
import { Link, useLocation } from "./router";
import "./styles.css";

const NAV = [
  { href: "/", label: "Highscores" },
  { href: "/players", label: "Players" },
  { href: "/compare", label: "Compare" },
  { href: "/weekly", label: "Weekly winners" },
];

function resolve(path: string): { title: string; page: preact.JSX.Element } {
  let m: RegExpMatchArray | null;
  if (path === "/") return { title: "Highscores", page: <Highscores /> };
  if (path === "/players") return { title: "Players", page: <Players /> };
  if (path === "/compare") return { title: "Compare", page: <Compare /> };
  if (path === "/submit") return { title: "Submit scores", page: <Submit /> };
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

  return (
    <>
      <header class="site-header">
        <Link href="/" class="brand">
          <span class="brand-mark">TtA</span> Challenge Highscores
        </Link>
        <nav>
          {NAV.map((n) => (
            <Link href={n.href} class={url.pathname === n.href ? "active" : ""}>
              {n.label}
            </Link>
          ))}
          <Link href="/submit" class={`submit-link ${url.pathname === "/submit" ? "active" : ""}`}>
            Submit scores
          </Link>
        </nav>
      </header>
      <main>{page}</main>
      <footer class="site-footer">
        <p>
          Fan-made scoreboard for the challenges of <em>Through the Ages</em> (CGE Digital). Works on trust — verified scores
          link to a Discord post. Discussion happens on the TtA Discord.
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
