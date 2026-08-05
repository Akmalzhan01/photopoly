import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/dal";
import { db } from "@/lib/server/db";
import { Eyebrow, LinkButton, Notice, Panel } from "@/components/site/ui";
import { formatSom } from "@/lib/money";
import { getPaymentNote } from "@/lib/server/settings-store";

export const metadata: Metadata = { title: "Платёж — photopoly" };

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, paymentNote] = await Promise.all([requireUser(), getPaymentNote()]);

  const payment = await db.payment.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      provider: true,
      amountSom: true,
      reference: true,
      paymentUrl: true,
      createdAt: true,
      paidAt: true,
      plan: { select: { name: true, days: true } },
      subscription: { select: { endsAt: true } },
    },
  });

  // Scoped to the owner: the id is a cuid, but guessing is not the only way to
  // come by one, and a payment record is nobody else's business.
  if (!payment || payment.userId !== user.id) notFound();

  const paid = payment.status === "PAID";

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Платёж</Eyebrow>
      </div>

      <h1 className="font-display text-[34px] leading-[1.1] text-chalk">
        {paid
          ? "Платёж принят."
          : payment.status === "PENDING"
            ? "Ожидаем платёж."
            : "Платёж не прошёл."}
      </h1>

      <Panel className="mt-8 divide-y divide-line">
        {[
          ["Тариф", payment.plan.name],
          ["Срок", `${payment.plan.days} дней`],
          ["Сумма", `${formatSom(payment.amountSom)} сом`],
          ["Создан", dateTime.format(payment.createdAt)],
          ...(payment.paidAt ? [["Оплачен", dateTime.format(payment.paidAt)]] : []),
          ...(payment.subscription
            ? [["Действует до", dateTime.format(payment.subscription.endsAt)]]
            : []),
          ["Номер", payment.reference.slice(0, 8)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
              {label}
            </span>
            <span className="font-mono text-[12px] text-chalk tabular-nums">{value}</span>
          </div>
        ))}
      </Panel>

      <div className="mt-6">
        {paid ? (
          <Notice tone="good">
            Подписка активирована. Переходите в редактор и продолжайте.
          </Notice>
        ) : payment.provider === "MANUAL" ? (
          <Notice tone="warn">
            {paymentNote ? (
              <>
                {/* Written by an admin, so it is shown as typed — line breaks and
                    all, since account numbers are usually laid out over lines. */}
                <span className="block whitespace-pre-line">{paymentNote}</span>
                <span className="mt-3 block">
                  После оплаты назовите номер заказа{" "}
                  <span className="font-mono text-chalk">
                    {payment.reference.slice(0, 8)}
                  </span>{" "}
                  — администратор включит подписку.
                </span>
              </>
            ) : (
              <>
                Этот заказ подтверждается вручную. Свяжитесь с администратором, чтобы
                узнать, куда перевести оплату, и назовите номер заказа:{" "}
                <span className="font-mono text-chalk">{payment.reference.slice(0, 8)}</span>
              </>
            )}
          </Notice>
        ) : payment.status === "PENDING" ? (
          <Notice>
            Ждём подтверждения платежа. Если вы уже завершили оплату в приложении Finik,
            обновите эту страницу — подтверждение приходит за несколько секунд.
          </Notice>
        ) : (
          <Notice tone="warn">
            Платёж не прошёл. Попробуйте ещё раз или выберите другой способ.
          </Notice>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {paid ? (
          <LinkButton href="/studio">Перейти в редактор</LinkButton>
        ) : payment.paymentUrl && payment.status === "PENDING" ? (
          <a
            href={payment.paymentUrl}
            className="inline-flex items-center border border-safe bg-safe/12 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-safe-soft transition-colors hover:bg-safe/20"
          >
            Открыть страницу оплаты
          </a>
        ) : (
          <LinkButton href="/narxlar">Вернуться к тарифам</LinkButton>
        )}
        <LinkButton href="/hisob" tone="ghost">
          Мой аккаунт
        </LinkButton>
      </div>
    </div>
  );
}
