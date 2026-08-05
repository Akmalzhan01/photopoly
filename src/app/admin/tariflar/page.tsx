import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/dal";
import { Eyebrow, Notice } from "@/components/site/ui";
import { PlanEditor } from "@/components/admin/PlanEditor";

export default async function PlansPage() {
  const admin = await requireAdmin();

  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      priceSom: true,
      days: true,
      exportLimit: true,
      features: true,
      active: true,
      sortOrder: true,
      _count: { select: { subscriptions: true } },
    },
  });

  const readOnly = admin.role !== "SUPERADMIN";

  return (
    <>
      <div className="mb-6 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Тарифы</Eyebrow>
      </div>

      {readOnly ? (
        <div className="mb-6">
          <Notice>Редактировать тарифы может только суперадмин.</Notice>
        </div>
      ) : (
        <div className="mb-6">
          <Notice>
            Изменение цены затрагивает только новые заказы — уже оплаченные
            подписки остаются со своей ценой.
          </Notice>
        </div>
      )}

      <div className="flex flex-col gap-px bg-line">
        {plans.map((plan) => (
          <PlanEditor
            key={plan.id}
            plan={{ ...plan, subscriptions: plan._count.subscriptions }}
            readOnly={readOnly}
          />
        ))}
        {!readOnly ? <PlanEditor plan={null} readOnly={false} /> : null}
      </div>
    </>
  );
}
