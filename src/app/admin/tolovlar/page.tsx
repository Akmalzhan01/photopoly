import Link from "next/link";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { formatSom } from "@/lib/money";

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

const STATUS = {
  PENDING: { label: "Ожидается", tone: "text-ash" },
  PAID: { label: "Оплачено", tone: "text-safe-soft" },
  FAILED: { label: "Не прошёл", tone: "text-ember" },
  CANCELLED: { label: "Отменён", tone: "text-dust" },
} as const;

const FILTERS = [
  { value: "", label: "Все" },
  { value: "PENDING", label: "В ожидании" },
  { value: "PAID", label: "Оплаченные" },
  { value: "FAILED", label: "Ошибка" },
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ holat?: string }>;
}) {
  await requireAdmin();
  const { holat } = await searchParams;

  const status = holat && holat in STATUS ? (holat as keyof typeof STATUS) : undefined;

  const payments = await db.payment.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      provider: true,
      amountSom: true,
      reference: true,
      externalId: true,
      createdAt: true,
      paidAt: true,
      plan: { select: { name: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-3">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Платежи</Eyebrow>

        <div className="ml-auto flex gap-px">
          {FILTERS.map((filter) => {
            const active = (status ?? "") === filter.value;
            return (
              <Link
                key={filter.value || "all"}
                href={filter.value ? `/admin/tolovlar?holat=${filter.value}` : "/admin/tolovlar"}
                className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  active
                    ? "border-safe text-safe-soft"
                    : "border-line text-dust hover:border-line-lit hover:text-chalk"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="border border-line bg-slab p-6">
          <p className="text-[13px] text-ash">Под этот фильтр платежей нет.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-riser">
              <tr>
                {["Дата", "Пользователь", "Тариф", "Сумма", "Способ", "Статус", "Действие"].map(
                  (head) => (
                    <th
                      key={head}
                      className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dust"
                    >
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-line bg-slab">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-ash tabular-nums">
                    {dateTime.format(payment.paidAt ?? payment.createdAt)}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-[12px] text-chalk">
                    <Link
                      href={`/admin/foydalanuvchilar?q=${encodeURIComponent(payment.user.email)}`}
                      className="underline decoration-line underline-offset-4 hover:decoration-safe"
                    >
                      {payment.user.name || payment.user.email}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-ash">{payment.plan.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-chalk tabular-nums">
                    {formatSom(payment.amountSom)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-dust">
                    {payment.provider === "MANUAL" ? "вручную" : "finik"}
                    {payment.externalId ? (
                      <span
                        className="ml-1.5 text-dust"
                        title={`Транзакция Finik: ${payment.externalId}`}
                      >
                        ↗
                      </span>
                    ) : null}
                  </td>
                  <td className={`px-4 py-2.5 font-mono text-[11px] ${STATUS[payment.status].tone}`}>
                    {STATUS[payment.status].label}
                  </td>
                  <td className="px-4 py-2.5">
                    {payment.status === "PENDING" ? (
                      <PaymentActions
                        paymentId={payment.id}
                        reference={payment.reference.slice(0, 8)}
                      />
                    ) : (
                      <span className="font-mono text-[10px] text-dust">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
