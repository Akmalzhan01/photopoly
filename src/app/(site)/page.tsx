import Link from "next/link";
import { PriceList } from "@/components/site/PriceList";
import { Eyebrow, LinkButton, Ruler } from "@/components/site/ui";
import { getCurrentUser } from "@/lib/server/dal";
import { getFreeExportLimit } from "@/lib/server/settings-store";

const STEPS = [
  {
    index: "01",
    title: "Загрузите фото",
    body: "Подойдёт обычный снимок с телефона или фотоаппарата. Файл не покидает ваш браузер.",
  },
  {
    index: "02",
    title: "Фон уходит сам",
    body: "Модель сегментации работает в браузере. Края можно поправить кистью вручную.",
  },
  {
    index: "03",
    title: "Задайте размер",
    body: "3×4, 3,5×4,5, виза, ID — всё готово. 300 dpi даёт чёткий результат.",
  },
  {
    index: "04",
    title: "Разложите на лист",
    body: "Сколько поместится на 10×15 или A4 — столько и будет. Печать с метками реза.",
  },
];

export default async function LandingPage() {
  const [user, free] = await Promise.all([getCurrentUser(), getFreeExportLimit()]);

  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16">
        <div className="mb-6 flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] text-ember">00</span>
          <Eyebrow>Мастерская фото на документы</Eyebrow>
        </div>

        <h1 className="max-w-3xl font-display text-[clamp(40px,7vw,76px)] leading-[0.98] text-chalk">
          Уберите фон, задайте размер,
          <br />
          <span className="text-safe-soft italic">отправьте на печать.</span>
        </h1>

        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-ash">
          Готовьте фото на паспорт, визу и ID прямо в браузере. Снимок не уходит ни на
          какой сервер — всё происходит на вашем устройстве.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <LinkButton href={user ? "/studio" : "/royxat"} className="px-6 py-3">
            {user ? "Перейти в редактор" : "Начать бесплатно"}
          </LinkButton>
          <Link
            href="/narxlar"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-dust underline underline-offset-8 transition-colors hover:text-chalk"
          >
            Посмотреть цены
          </Link>
          {!user && free > 0 ? (
            <span className="font-mono text-[10px] text-dust">
              {free} экспорта бесплатно · карта не нужна
            </span>
          ) : null}
        </div>
      </section>

      <Ruler />

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10 flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] text-ember">01</span>
          <Eyebrow>Как это работает</Eyebrow>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <article key={step.index} className="bg-slab p-6">
              <span className="font-mono text-[10px] text-ember">{step.index}</span>
              <h3 className="mt-3 font-display text-[21px] leading-tight text-chalk">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ash">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <Ruler />

      <section id="narxlar" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-3 flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] text-ember">02</span>
          <Eyebrow>Цены</Eyebrow>
        </div>
        <h2 className="mb-10 max-w-2xl font-display text-[34px] leading-[1.1] text-chalk">
          Пока не оформите подписку — платить не нужно.
        </h2>
        <PriceList />
      </section>
    </>
  );
}
