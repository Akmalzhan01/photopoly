import "server-only";

import { db } from "./db";

export type AdminOverview = {
  users: number;
  newUsers: number;
  activeSubscriptions: number;
  pendingPayments: number;
  revenueSom: number;
  exports: number;
};

const WINDOW_DAYS = 30;

/**
 * The numbers on the admin home page.
 *
 * Kept out of the page component because reading the clock during render is
 * exactly the kind of impurity React's lint rules object to — and because six
 * queries inline in a page body is six queries nobody can reuse or test.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [users, newUsers, activeSubscriptions, pendingPayments, revenue, exports] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.subscription.count({ where: { status: "ACTIVE", endsAt: { gt: now } } }),
      db.payment.count({ where: { status: "PENDING" } }),
      db.payment.aggregate({
        where: { status: "PAID", paidAt: { gte: since } },
        _sum: { amountSom: true },
      }),
      db.usageEvent.count({ where: { createdAt: { gte: since } } }),
    ]);

  return {
    users,
    newUsers,
    activeSubscriptions,
    pendingPayments,
    revenueSom: revenue._sum.amountSom ?? 0,
    exports,
  };
}
