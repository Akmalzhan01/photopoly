import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import { db } from "@/lib/server/db";
import { getEntitlement } from "@/lib/server/entitlement";
import { expireStaleSubscriptions } from "@/lib/server/billing";
import { Eyebrow, LinkButton, Notice, Panel } from "@/components/site/ui";
import { formatSom } from "@/lib/money";

export const metadata: Metadata = { title: "Мой аккаунт — photopoly" };

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "Ожидается",
  PAID: "Оплачено",
  FAILED: "Не прошёл",
  CANCELLED: "Отменён",
};

const PAYMENT_TONE: Record<string, string> = {
  PENDING: "text-ash",
  PAID: "text-safe-soft",
  FAILED: "text-ember",
  CANCELLED: "text-dust",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slab p-5">
      <span className="text-[12px] text-dust font-medium">{label}</span>
      <p className="mt-2 text-[22px] leading-none text-chalk tabular-nums">{value}</p>
    </div>
  );
}

export default async function AccountPage() {
  // expireStaleSubscriptions() is global bookkeeping unrelated to this user,
  // so it runs alongside the session check instead of after it — the
  // database is ~200ms away, and every avoidable round trip shows.
  const [user] = await Promise.all([requireUser(), expireStaleSubscriptions()]);

  const [entitlement, payments] = await Promise.all([
    getEntitlement(user.id),
    db.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        amountSom: true,
        createdAt: true,
        paidAt: true,
        provider: true,
        plan: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <Eyebrow>Мой аккаунт</Eyebrow>
      </div>
      <h1 className="font-display text-[clamp(30px,4.5vw,42px)] leading-[1.05] text-chalk font-semibold tracking-tight">
        {user.name || user.email}
      </h1>
      <p className="mt-2 text-[13px] text-dust tabular-nums">{user.email}</p>

      <div className="mt-10 grid gap-px bg-line overflow-hidden rounded-xl border border-line sm:grid-cols-3">
        <Stat
          label="Тариф"
          value={entitlement.plan ? entitlement.plan.name : "Пробный"}
        />
        <Stat
          label="Осталось экспортов"
          value={entitlement.remaining === null ? "Без лимита" : String(entitlement.remaining)}
        />
        <Stat
          label="Действует до"
          value={entitlement.plan ? date.format(entitlement.plan.endsAt) : "—"}
        />
      </div>

      {!entitlement.allowed ? (
        <div className="mt-6">
          <Notice tone="warn">
            Лимит экспортов исчерпан. Чтобы продолжить, выберите тариф — настройки и
            фотография останутся на месте.
          </Notice>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton href="/narxlar">
          {entitlement.plan ? "Продлить тариф" : "Выбрать тариф"}
        </LinkButton>
        <LinkButton href="/studio" tone="ghost">
          Перейти в редактор
        </LinkButton>
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-baseline gap-2.5">
          <Eyebrow>История платежей</Eyebrow>
        </div>

        {payments.length === 0 ? (
          <Panel className="p-6">
            <p className="text-[13px] text-ash">Платежей пока нет.</p>
          </Panel>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Дата", "Тариф", "Сумма", "Статус", ""].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-3 text-[12px] text-dust font-medium"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-[13px] text-ash tabular-nums">
                      {dateTime.format(payment.paidAt ?? payment.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-chalk">{payment.plan.name}</td>
                    <td className="px-4 py-3 text-[12px] text-chalk tabular-nums">
                      {formatSom(payment.amountSom)} сом
                    </td>
                    <td
                      className={`px-4 py-3 text-[13px] ${PAYMENT_TONE[payment.status]} tabular-nums`}
                    >
                      {PAYMENT_LABEL[payment.status]}
                      {payment.provider === "MANUAL" ? "· вручную" : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payment.status === "PENDING" ? (
                        <Link
                          href={`/hisob/tolov/${payment.id}`}
                          className="text-[12px] text-safe underline underline-offset-4 tabular-nums"
                        >
                          Открыть
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </section>
    </div>
  );
}
