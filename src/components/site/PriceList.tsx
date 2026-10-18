import Link from "next/link";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/dal";
import { getFreeExportLimit } from "@/lib/server/settings-store";
import { BuyForm } from "./BuyForm";
import { formatSom } from "@/lib/money";

function Tick() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-good" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CARD = "relative flex flex-col rounded-2xl border bg-slab p-6 shadow-card";
const SECONDARY =
  "inline-flex w-full items-center justify-center rounded-lg border border-line bg-slab px-4 py-2.5 text-[14px] font-medium text-chalk shadow-card transition-colors hover:border-line-lit hover:bg-riser";

export async function PriceList() {
  const [plans, user, freeLimit] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
    getFreeExportLimit(),
  ]);

  // The middle plan carries the accent; with two or four it falls on the second.
  const featuredIndex = plans.length > 2 ? Math.floor(plans.length / 2) : plans.length - 1;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {freeLimit > 0 ? (
        <div className={`${CARD} border-line`}>
          <span className="text-[13px] font-medium text-dust">Пробный</span>
          <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-chalk">Бесплатно</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-ash">
            При регистрации даём {freeLimit} экспорта. Карта не нужна.
          </p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {["Все инструменты редактирования", "Полное качество, без водяного знака", `${freeLimit} экспорта`].map(
              (feature) => (
                <li key={feature} className="flex gap-2 text-[14px] leading-snug text-ash">
                  <Tick />
                  {feature}
                </li>
              ),
            )}
          </ul>
          <div className="mt-auto pt-6">
            <Link href={user ? "/studio" : "/royxat"} className={SECONDARY}>
              {user ? "Перейти в редактор" : "Начать бесплатно"}
            </Link>
          </div>
        </div>
      ) : null}

      {plans.map((plan, index) => {
        const featured = index === featuredIndex;
        return (
          <div
            key={plan.id}
            className={`${CARD} ${featured ? "border-safe ring-4 ring-safe/10" : "border-line"}`}
          >
            {featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-safe px-2.5 py-0.5 text-[12px] font-medium text-white">
                Рекомендуем
              </span>
            ) : null}

            <span className="text-[13px] font-medium text-dust">
              {plan.days >= 365 ? "Годовой" : `${plan.days} дней`}
            </span>
            <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-chalk">{plan.name}</h3>

            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[34px] leading-none font-bold tracking-tight text-chalk tabular-nums">
                {formatSom(plan.priceSom)}
              </span>
              <span className="text-[14px] text-dust">сом</span>
            </p>

            {plan.description ? (
              <p className="mt-3 text-[14px] leading-relaxed text-ash">{plan.description}</p>
            ) : null}

            <ul className="mt-5 flex flex-col gap-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2 text-[14px] leading-snug text-ash">
                  <Tick />
                  {feature}
                </li>
              ))}
            </ul>

            {user ? (
              <BuyForm planCode={plan.code} label="Выбрать" featured={featured} />
            ) : (
              <div className="mt-auto pt-6">
                <Link
                  href={`/royxat?keyin=${encodeURIComponent("/narxlar")}`}
                  className={
                    featured
                      ? "inline-flex w-full items-center justify-center rounded-lg bg-safe px-4 py-2.5 text-[14px] font-medium text-white shadow-card transition-colors hover:bg-safe/90"
                      : SECONDARY
                  }
                >
                  Выбрать
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
