import type { AnchorHTMLAttributes, ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

export function navigate(to: string) {
  history.pushState(null, "", to);
  dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function useLocation(): URL {
  const [url, setUrl] = useState(() => new URL(location.href));
  useEffect(() => {
    const update = () => setUrl(new URL(location.href));
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  return url;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ComponentChildren };

export function Link({ href, children, ...rest }: LinkProps) {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

export const playerHref = (name: string) => `/player/${encodeURIComponent(name)}`;
export const challengeHref = (id: string) => `/challenge/${encodeURIComponent(id)}`;
