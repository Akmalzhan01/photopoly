import "server-only";

import { db } from "./db";

/**
 * Turns a paid Payment into an active Subscription.
 *
 * Written to be safe to call twice with the same payment, because Finik's
 * webhook is "at least once" — a retry after a slow response must not hand out
 * a second month. The guard is the `PENDING -> PAID` conditional update: only
 * the call that actually flips the row goes on to create the subscription.
 */
export async function activatePayment(
  paymentId: string,
  options: { externalId?: string | null; raw?: unknown; paidAt?: Date } = {},
): Promise<{ activated: boolean; subscriptionId?: string }> {
  const paidAt = options.paidAt ?? new Date();

  const claimed = await db.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt,
      externalId: options.externalId ?? undefined,
      raw: options.raw === undefined ? undefined : (options.raw as never),
    },
  });

  if (claimed.count === 0) {
    const existing = await db.payment.findUnique({
      where: { id: paymentId },
      select: { subscriptionId: true },
    });
    return { activated: false, subscriptionId: existing?.subscriptionId ?? undefined };
  }

  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { userId: true, planId: true, plan: { select: { days: true } } },
  });

  // Renewing before the current period runs out extends it rather than throwing
  // away the days already paid for.
  const current = await db.subscription.findFirst({
    where: { userId: payment.userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });

  const startsAt = current?.endsAt ?? new Date();
  const endsAt = new Date(startsAt.getTime() + payment.plan.days * 24 * 60 * 60 * 1000);

  const subscription = await db.subscription.create({
    data: {
      userId: payment.userId,
      planId: payment.planId,
      startsAt,
      endsAt,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await db.payment.update({
    where: { id: paymentId },
    data: { subscriptionId: subscription.id },
  });

  return { activated: true, subscriptionId: subscription.id };
}

/** Marks subscriptions whose end date has passed. Cheap enough to run on read. */
export async function expireStaleSubscriptions(): Promise<number> {
  const { count } = await db.subscription.updateMany({
    where: { status: "ACTIVE", endsAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  return count;
}
