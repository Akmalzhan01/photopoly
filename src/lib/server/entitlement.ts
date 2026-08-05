import "server-only";

import { db } from "./db";
import { getFreeExportLimit } from "./settings-store";

/**
 * What a user is currently allowed to do.
 *
 * `source` says which bucket the next export would come out of, which is what
 * the UI needs in order to explain itself: "2 free exports left" reads very
 * differently from "your plan runs out on Friday".
 */
export type Entitlement = {
  allowed: boolean;
  source: "subscription" | "free" | "none";
  /** null means unlimited. */
  remaining: number | null;
  freeLimit: number;
  freeUsed: number;
  plan: { code: string; name: string; endsAt: Date; exportLimit: number | null } | null;
};

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [user, subscription, freeLimit] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { freeUsed: true } }),
    db.subscription.findFirst({
      where: { userId, status: "ACTIVE", endsAt: { gt: new Date() } },
      orderBy: { endsAt: "desc" },
      select: {
        used: true,
        endsAt: true,
        plan: { select: { code: true, name: true, exportLimit: true } },
      },
    }),
    getFreeExportLimit(),
  ]);

  const freeUsed = user?.freeUsed ?? 0;

  if (subscription) {
    const limit = subscription.plan.exportLimit;
    const remaining = limit === null ? null : Math.max(0, limit - subscription.used);
    return {
      allowed: remaining === null || remaining > 0,
      source: "subscription",
      remaining,
      freeLimit,
      freeUsed,
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
        endsAt: subscription.endsAt,
        exportLimit: limit,
      },
    };
  }

  const remaining = Math.max(0, freeLimit - freeUsed);
  return {
    allowed: remaining > 0,
    source: remaining > 0 ? "free" : "none",
    remaining,
    freeLimit,
    freeUsed,
    plan: null,
  };
}

export type ConsumeResult =
  | { ok: true; entitlement: Entitlement }
  | { ok: false; reason: "quota"; entitlement: Entitlement };

/**
 * Spends one export.
 *
 * Both branches are conditional updates rather than read-then-write, so two
 * requests racing on the last remaining export cannot both win: whichever
 * `UPDATE ... WHERE used < limit` lands second matches no rows and is refused.
 */
export async function consumeExport(userId: string): Promise<ConsumeResult> {
  const subscription = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    select: { id: true, plan: { select: { exportLimit: true } } },
  });

  let spent = false;

  if (subscription) {
    const limit = subscription.plan.exportLimit;
    if (limit === null) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { used: { increment: 1 } },
      });
      spent = true;
    } else {
      const { count } = await db.subscription.updateMany({
        where: { id: subscription.id, used: { lt: limit } },
        data: { used: { increment: 1 } },
      });
      spent = count > 0;
    }
  }

  if (!spent) {
    const freeLimit = await getFreeExportLimit();
    const { count } = await db.user.updateMany({
      where: { id: userId, freeUsed: { lt: freeLimit } },
      data: { freeUsed: { increment: 1 } },
    });
    spent = count > 0;
  }

  if (!spent) {
    return { ok: false, reason: "quota", entitlement: await getEntitlement(userId) };
  }

  await db.usageEvent.create({ data: { userId, kind: "export" } });
  return { ok: true, entitlement: await getEntitlement(userId) };
}
