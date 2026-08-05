/**
 * The entitlement as the browser sees it.
 *
 * Deliberately separate from the server-side `Entitlement`: this type crosses
 * into a client component, so it must stay free of anything `server-only`.
 */
export type EntitlementView = {
  allowed: boolean;
  source: "subscription" | "free" | "none";
  /** null means unlimited. */
  remaining: number | null;
  freeLimit: number;
  planName: string | null;
  /** ISO string — Dates survive the boundary, but a string is simpler to render. */
  endsAt: string | null;
};

/** One short line for the studio header. */
export function describeQuota(view: EntitlementView): string {
  if (view.source === "subscription") {
    return view.remaining === null
      ? `${view.planName} · без лимита`
      : `${view.planName} · осталось ${view.remaining}`;
  }
  if (view.source === "free") {
    return `Бесплатно · осталось ${view.remaining}`;
  }
  return "Лимит исчерпан";
}
