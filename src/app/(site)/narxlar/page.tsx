import type { Metadata } from "next";
import { PriceList } from "@/components/site/PriceList";
import { Eyebrow, Notice } from "@/components/site/ui";
import { getFinikConfig } from "@/lib/finik/config";

export const metadata: Metadata = {
  title: "Цены — photopoly",
  description: "Тарифы Photopoly: бесплатный пробный период, месячная и годовая подписка.",
};

/**
 * The first two answers depend on whether the gateway is actually switched on.
 *
 * Promising QR codes and instant activation while orders are confirmed by hand
 * would be a straightforward lie to someone about to pay, so the copy follows
 * the configuration rather than the intention.
 */
function faq(automatic: boolean) {
  return [
    {
      q: "Как оплатить?",
      a: automatic
        ? "Через Finik — по QR-коду или картой Visa. Как только платёж подтверждён, подписка включается автоматически."
        : "Пока — переводом. Выберите тариф, и на странице заказа появятся реквизиты и номер заказа. После оплаты подписку включает администратор.",
    },
    {
      q: "Как быстро включится подписка?",
      a: automatic
        ? "Сразу после подтверждения платежа — обычно за несколько секунд."
        : "Вручную, после того как мы увидим перевод. Обычно это занимает несколько минут в рабочее время.",
    },
    {
      q: "Подписка продлевается сама?",
      a: "Нет. Каждый раз вы платите сами — с карты ничего автоматически не списывается.",
    },
    {
      q: "Что будет, если продлить до окончания срока?",
      a: "Новый срок добавляется к старому. Оплаченные дни не сгорают.",
    },
    {
      q: "Где хранятся мои фотографии?",
      a: "Нигде. Обработка идёт в вашем браузере, файл на сервер вообще не отправляется.",
    },
  ];
}

export default async function PricingPage() {
  const automatic = Boolean(getFinikConfig());
  const items = faq(automatic);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">02</span>
        <Eyebrow>Цены</Eyebrow>
      </div>
      <h1 className="mb-4 max-w-2xl font-display text-[clamp(32px,5vw,48px)] leading-[1.05] text-chalk">
        Заплатите один раз — пользуйтесь весь срок.
      </h1>
      <p className="mb-10 max-w-xl text-[14px] leading-relaxed text-ash">
        Инструменты редактирования одинаковы во всех тарифах. Отличаются только число экспортов и срок.
      </p>

      <PriceList />

      <div className="mt-12 grid gap-px bg-line md:grid-cols-2">
        {items.map((item) => (
          <article key={item.q} className="bg-slab p-6">
            <h3 className="font-display text-[19px] leading-tight text-chalk">{item.q}</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ash">{item.a}</p>
          </article>
        ))}
      </div>

      <div className="mt-8">
        <Notice>
          {automatic
            ? "Цены в кыргызских сомах. Оплата принимается через Finik — чек сохраняется в вашем платёжном приложении."
            : "Цены в кыргызских сомах. Онлайн-оплата ещё подключается, поэтому заказы пока оформляются переводом и подтверждаются вручную."}
        </Notice>
      </div>
    </div>
  );
}
