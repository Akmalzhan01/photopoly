import Link from "next/link";
import type { ReactNode } from "react";
import { PriceList } from "@/components/site/PriceList";
import { Eyebrow, LinkButton } from "@/components/site/ui";
import { getCurrentUser } from "@/lib/server/dal";
import { getFreeExportLimit } from "@/lib/server/settings-store";

const ICON = "h-5 w-5";

const STEPS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Загрузите фото",
    body: "Подойдёт обычный снимок с телефона или фотоаппарата. Файл не покидает ваш браузер.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13V3.5M6 7l4-4 4 4M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
      </svg>
    ),
  },
  {
    title: "Фон уходит сам",
    body: "Модель сегментации работает в браузере. Края можно поправить кистью вручную.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2.5l1.6 4.3 4.4 1.6-4.4 1.6L10 14.3 8.4 10 4 8.4l4.4-1.6zM15.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
      </svg>
    ),
  },
  {
    title: "Задайте размер",
    body: "3×4, 3,5×4,5, виза, ID — всё готово. 300 dpi даёт чёткий результат.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V4a1 1 0 0 1 1-1h3M13 3h3a1 1 0 0 1 1 1v3M17 13v3a1 1 0 0 1-1 1h-3M7 17H4a1 1 0 0 1-1-1v-3" />
      </svg>
    ),
  },
  {
    title: "Разложите на лист",
    body: "Сколько поместится на 10×15 или A4 — столько и будет. Печать с метками реза.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 7V2.5h9V7M5.5 14H4a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 4 7h12a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 16 14h-1.5M5.5 11.5h9v6h-9z" />
      </svg>
    ),
  },
];

const TOOLS: { href: string; title: string; body: string; icon: ReactNode }[] = [
  {
    href: "/fon",
    title: "Убрать фон",
    body: "Прозрачный, белый, цветной или размытый фон за пару секунд.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="7.5" r="3" />
        <path d="M4.5 17c.8-3 2.9-4.6 5.5-4.6s4.7 1.6 5.5 4.6M2.5 2.5h3M14.5 2.5h3M2.5 2.5v3M17.5 2.5v3" />
      </svg>
    ),
  },
  {
    href: "/ochirish",
    title: "Удалить лишнее",
    body: "Закрасьте прохожего, провод или надпись — нейросеть дорисует фон.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="m11.5 3.5 5 5-7 7H5l-2-2a1.4 1.4 0 0 1 0-2zM8 7l5 5M9.5 15.5h8" />
      </svg>
    ),
  },
  {
    href: "/kattalashtirish",
    title: "Увеличить фото",
    body: "В 2 или 4 раза без потери качества — резко, без размытия.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11.5 3h5.5v5.5M17 3l-6 6M8.5 17H3v-5.5M3 17l6-6" />
      </svg>
    ),
  },
  {
    href: "/skaner",
    title: "Сканер документов",
    body: "Фото паспорта или справки — в ровный скан и PDF.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2.5H4.5a2 2 0 0 0-2 2V6M14 2.5h1.5a2 2 0 0 1 2 2V6M6 17.5H4.5a2 2 0 0 1-2-2V14M14 17.5h1.5a2 2 0 0 0 2-2V14M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4" />
      </svg>
    ),
  },
  {
    href: "/konvert",
    title: "HEIC в JPG",
    body: "Фото с iPhone в JPG, PNG или WebP и сжатие — сразу много файлов.",
    icon: (
      <svg viewBox="0 0 20 20" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h11l-3-3M16 13H5l3 3" />
      </svg>
    ),
  },
];

/** A sheet of four ID photos, drawn rather than photographed: no stock face to license. */
function SheetPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div aria-hidden className="absolute -inset-6 rounded-[32px] bg-safe/10 blur-2xl" />
      <div className="relative rounded-2xl border border-line bg-slab p-5 shadow-stage">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[13px] font-medium text-chalk">Лист 10×15 · 3×4 см</span>
          <span className="rounded-full bg-good/10 px-2.5 py-0.5 text-[12px] font-medium text-good">
            Готово к печати
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-riser p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="aspect-[3/4] overflow-hidden rounded-md bg-white ring-1 ring-black/5">
              <svg viewBox="0 0 30 40" className="h-full w-full">
                <rect width="30" height="40" fill={i === 0 ? "#dbe7ff" : "#ffffff"} />
                <circle cx="15" cy="15.5" r="6.2" fill="#c9a58a" />
                <path d="M8.6 14c0-4.6 2.9-7.6 6.4-7.6s6.4 3 6.4 7.6c-1.2-2.4-3.4-3.4-6.4-3.4S9.8 11.6 8.6 14z" fill="#3b2a22" />
                <path d="M3 40c.8-8 5.8-12.4 12-12.4S26.2 32 27 40z" fill="#1f2a44" />
                <path d="M12.6 27.8 15 32l2.4-4.2" fill="#ffffff" />
              </svg>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["300", "dpi"],
            ["6", "фото на листе"],
            ["0", "загрузок на сервер"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg bg-riser px-2 py-2.5">
              <div className="text-[17px] font-semibold text-chalk tabular-nums">{value}</div>
              <div className="text-[11px] text-dust">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const [user, free] = await Promise.all([getCurrentUser(), getFreeExportLimit()]);

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-slab px-3 py-1 text-[13px] font-medium text-ash shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            Фото на документы прямо в браузере
          </span>

          <h1 className="mt-6 text-[clamp(38px,6vw,60px)] leading-[1.05] font-bold tracking-tight text-chalk">
            Уберите фон, задайте размер,{" "}
            <span className="text-safe-soft">отправьте на печать.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ash">
            Готовьте фото на паспорт, визу и ID за минуту. Снимок не уходит ни на какой
            сервер — всё происходит на вашем устройстве.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <LinkButton href={user ? "/studio" : "/royxat"} className="px-6 py-3 text-[15px]">
              {user ? "Перейти в редактор" : "Начать бесплатно"}
            </LinkButton>
            <LinkButton href="/narxlar" tone="ghost" className="px-6 py-3 text-[15px]">
              Посмотреть цены
            </LinkButton>
          </div>
          {!user && free > 0 ? (
            <p className="mt-4 text-[13px] text-dust">
              {free} экспорта бесплатно · карта не нужна
            </p>
          ) : null}
        </div>

        <SheetPreview />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <Eyebrow>Инструменты</Eyebrow>
        <h2 className="mt-2 max-w-2xl text-[32px] leading-tight font-bold tracking-tight text-chalk">
          Бесплатные инструменты для фото — без регистрации
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group rounded-2xl border border-line bg-slab p-6 shadow-card transition-colors hover:border-safe/50"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-safe/10 text-safe-soft">
                {tool.icon}
              </span>
              <h3 className="mt-5 text-[17px] font-semibold text-chalk group-hover:text-safe-soft">
                {tool.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ash">{tool.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-slab">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>Как это работает</Eyebrow>
          <h2 className="mt-2 max-w-2xl text-[32px] leading-tight font-bold tracking-tight text-chalk">
            Четыре шага от снимка до готового листа
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-line bg-ink p-6 transition-colors hover:border-line-lit"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-safe/10 text-safe-soft">
                    {step.icon}
                  </span>
                  <span className="text-[13px] font-medium text-dust tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-chalk">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ash">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="narxlar" className="mx-auto max-w-6xl px-5 py-20">
        <Eyebrow>Цены</Eyebrow>
        <h2 className="mt-2 mb-3 max-w-2xl text-[32px] leading-tight font-bold tracking-tight text-chalk">
          Пока не оформите подписку — платить не нужно.
        </h2>
        <p className="mb-12 max-w-xl text-[15px] text-ash">
          Начните бесплатно, а когда понадобится больше экспортов — выберите тариф.{" "}
          <Link href="/narxlar" className="font-medium text-safe-soft hover:underline">
            Подробнее о тарифах
          </Link>
        </p>
        <PriceList />
      </section>
    </>
  );
}
