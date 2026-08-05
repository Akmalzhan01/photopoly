import type { Metadata } from "next";
import { Studio } from "@/components/Studio";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { getEntitlement } from "@/lib/server/entitlement";
import { expireStaleSubscriptions } from "@/lib/server/billing";
import type { EntitlementView } from "@/lib/entitlement-view";

export const metadata: Metadata = {
  title: "Ish stoli — photopoly",
};

export default async function StudioPage() {
  // Run together, not in sequence: expireStaleSubscriptions() is global
  // bookkeeping unrelated to this user, and getEntitlement()'s own
  // `endsAt: { gt: now }` filter already excludes a lapsed subscription
  // whether or not its status has been flipped to EXPIRED yet. The database
  // is a ~200ms round trip away, so every avoidable one matters.
  const [user, , attireAssets] = await Promise.all([
    requireUser(),
    expireStaleSubscriptions(),
    db.attireAsset.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, url: true },
    }),
  ]);

  const entitlement = await getEntitlement(user.id);
  const view: EntitlementView = {
    allowed: entitlement.allowed,
    source: entitlement.source,
    remaining: entitlement.remaining,
    freeLimit: entitlement.freeLimit,
    planName: entitlement.plan?.name ?? null,
    endsAt: entitlement.plan?.endsAt.toISOString() ?? null,
  };

  return <Studio initialEntitlement={view} attireAssets={attireAssets} />;
}
