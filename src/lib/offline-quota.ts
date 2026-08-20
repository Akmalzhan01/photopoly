/**
 * The export allowance, kept where the editor can still read it with no
 * connection.
 *
 * The studio's HTML is now the same for everybody, which is what lets it be
 * cached — but that also means the allowance is no longer in the page. It is
 * fetched after load and mirrored here, so a reload with the connection gone
 * still knows what this account is allowed to do.
 *
 * The mirror is not a second source of truth. It can only ever hand out what
 * the server last granted: exports taken offline count down against the stored
 * number and are settled the moment the connection returns. Nobody gains an
 * export by pulling the cable out.
 */

import type { EntitlementView } from "./entitlement-view";

const QUOTA_KEY = "photopoly.quota";
const PENDING_KEY = "photopoly.quota.pending";

function storage(): Storage | null {
  // Safari in private mode throws on access rather than returning null.
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isView(value: unknown): value is EntitlementView {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.allowed === "boolean" &&
    (candidate.source === "subscription" ||
      candidate.source === "free" ||
      candidate.source === "none") &&
    (candidate.remaining === null || typeof candidate.remaining === "number") &&
    typeof candidate.freeLimit === "number"
  );
}

export function readQuota(): EntitlementView | null {
  const store = storage();
  if (!store) return null;
  try {
    const parsed: unknown = JSON.parse(store.getItem(QUOTA_KEY) ?? "null");
    return isView(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeQuota(view: EntitlementView): void {
  try {
    storage()?.setItem(QUOTA_KEY, JSON.stringify(view));
  } catch {
    // A full or disabled store costs the offline mirror, not the export.
  }
}

export function readPending(): number {
  const raw = Number(storage()?.getItem(PENDING_KEY) ?? 0);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : 0;
}

export function writePending(count: number): void {
  try {
    if (count > 0) storage()?.setItem(PENDING_KEY, String(count));
    else storage()?.removeItem(PENDING_KEY);
  } catch {
    // Losing the counter under-charges by a few exports; losing the export
    // itself would be the customer standing at the counter with nothing.
  }
}

/** On the way out: the allowance is this account's footprint on a shared machine. */
export function clearQuota(): void {
  try {
    storage()?.removeItem(QUOTA_KEY);
    storage()?.removeItem(PENDING_KEY);
  } catch {
    // Nothing to do — the next sign-in overwrites both keys anyway.
  }
}

/**
 * Whether the stored allowance may still be spent with no connection.
 *
 * A subscription carries its own end date, so an expired one is refused here
 * rather than waiting for a server that cannot be reached. An unlimited plan
 * has no count to check.
 */
export function usableOffline(view: EntitlementView, now = Date.now()): boolean {
  if (!view.allowed) return false;
  if (view.source === "subscription" && view.endsAt) {
    if (Date.parse(view.endsAt) <= now) return false;
  }
  return view.remaining === null || view.remaining > 0;
}

/** One export taken against the stored allowance. */
export function spendLocally(view: EntitlementView): EntitlementView {
  if (view.remaining === null) return view;
  const remaining = Math.max(0, view.remaining - 1);
  return { ...view, remaining, allowed: remaining > 0 };
}

/**
 * Whether the browser thinks it has a connection.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server has no
 * opinion on the matter, and the "true" snapshot below is what keeps the first
 * paint identical on both sides of hydration.
 *
 * `navigator.onLine` only proves a network interface exists, not that photopoly
 * is reachable — so it drives the badge, never the decision. What actually
 * decides is whether the request threw.
 */
export function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function readOnline(): boolean {
  return navigator.onLine;
}

export function serverOnline(): boolean {
  return true;
}
