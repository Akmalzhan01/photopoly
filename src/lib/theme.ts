/**
 * Light and dark, with "follow the system" as the default.
 *
 * The choice lives in localStorage rather than a cookie or the database: it is
 * a property of the screen someone is sitting at, not of their account. A
 * retoucher on a bright shop floor and the same person at home in the evening
 * want different answers, and a server-side preference would follow them
 * between the two.
 */

export type Theme = "system" | "light" | "dark";

export const THEMES: readonly Theme[] = ["system", "light", "dark"];

export const THEME_KEY = "photopoly.theme";

/** `system` is the absence of the attribute, which is what the CSS keys off. */
const ATTRIBUTE = "data-theme";

/**
 * Runs before the first paint, straight from the document head.
 *
 * Without it a stored light preference would still be painted dark for one
 * frame while React starts up — the white flash that gives themed sites away.
 * Deliberately tiny and self-contained: it cannot import anything, because
 * nothing has loaded yet.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute(${JSON.stringify(
  ATTRIBUTE,
)},t)}}catch(e){}})()`;

const listeners = new Set<() => void>();

/** Same-tab changes go through the set; other tabs arrive as `storage`. */
export function subscribeTheme(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private mode, or storage disabled entirely. The system default still works.
    return "system";
  }
}

/** What the server renders, before any screen preference is knowable. */
export function serverTheme(): Theme {
  return "system";
}

export function applyTheme(theme: Theme): void {
  try {
    if (theme === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not being able to remember it is no reason not to apply it.
  }

  const root = document.documentElement;
  if (theme === "system") root.removeAttribute(ATTRIBUTE);
  else root.setAttribute(ATTRIBUTE, theme);

  for (const listener of listeners) listener();
}

export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}
