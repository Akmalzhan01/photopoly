import type { Metadata } from "next";
import { Studio } from "@/components/Studio";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { expireStaleSubscriptions } from "@/lib/server/billing";

export const metadata: Metadata = {
  title: "Ish stoli — photopoly",
};

/**
 * The studio shell.
 *
 * Deliberately renders **nothing that belongs to one person**. The allowance
 * used to be baked in here, which meant the finished HTML differed per account
 * and could not be cached: a shared computer would have served the previous
 * operator's plan and remaining count to whoever opened the app next. It is now
 * fetched by the browser after load, which lets the service worker keep this
 * page and the editor open with no connection at all.
 *
 * `requireUser()` stays — it is the gate, not the payload. The attire list is
 * the same for every account, so it is safe to render and safe to cache.
 */
export default async function StudioPage() {
  // Run together, not in sequence: expireStaleSubscriptions() is global
  // bookkeeping unrelated to this user. The database is a ~200ms round trip
  // away, so every avoidable one matters.
  const [, , attireAssets] = await Promise.all([
    requireUser(),
    expireStaleSubscriptions(),
    db.attireAsset.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, url: true },
    }),
  ]);

  return <Studio attireAssets={attireAssets} />;
}
