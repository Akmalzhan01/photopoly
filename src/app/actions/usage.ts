"use server";

import { getCurrentUser } from "@/lib/server/dal";
import { consumeExport, getEntitlement, type Entitlement } from "@/lib/server/entitlement";
import type { EntitlementView } from "@/lib/entitlement-view";

function toView(entitlement: Entitlement): EntitlementView {
  return {
    allowed: entitlement.allowed,
    source: entitlement.source,
    remaining: entitlement.remaining,
    freeLimit: entitlement.freeLimit,
    planName: entitlement.plan?.name ?? null,
    endsAt: entitlement.plan?.endsAt.toISOString() ?? null,
  };
}

export async function viewEntitlement(): Promise<EntitlementView | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return toView(await getEntitlement(user.id));
}

export type SpendResult =
  | { ok: true; entitlement: EntitlementView }
  | { ok: false; reason: "auth" | "quota"; entitlement: EntitlementView | null };

/**
 * Spends one export.
 *
 * Called from the browser immediately before the file is written. Worth being
 * honest about the limit of this: the whole editor runs client-side, so someone
 * who reads the bundle can produce a file without ever calling this. It is a
 * turnstile, not a vault — closing that hole would mean moving rendering to the
 * server and giving up the promise that photos never leave the device.
 */
export async function spendExport(): Promise<SpendResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "auth", entitlement: null };

  const result = await consumeExport(user.id);
  if (!result.ok) {
    return { ok: false, reason: "quota", entitlement: toView(result.entitlement) };
  }
  return { ok: true, entitlement: toView(result.entitlement) };
}
