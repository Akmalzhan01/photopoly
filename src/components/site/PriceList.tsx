import Link from "next/link";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/dal";
import { getFreeExportLimit } from "@/lib/server/settings-store";
import { BuyForm } from "./BuyForm";
import { formatSom } from "@/lib/money";

function Tick() {
  return (
    <span aria-hidden className="mt-[7px] h-px w-2.5 shrink-0 bg-ember" />
  );
}

export async function PriceList() {
  const [plans, user, freeLimit] = await Promise.all([
    db.plan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getCurrentUser(),
    getFreeExportLimit(),
  ]);

  // The middle plan carries the accent; with two or four it falls on the second.
  const featuredIndex = plans.length > 2 ? Math.floor(plans.length / 2) : plans.length - 1;

  return (
    <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
      {freeLimit > 0 ? (
        <div className="flex flex-col bg-slab p-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">Пробный</span>
          <h3 className="mt-3 font-display text-[26px] leading-none text-chalk">Бесплатно</h3>
          <p className="mt-3 text-[13px] leading-relaxed text-ash">
            При регистрации даём {freeLimit} экспорта. Карта не нужна.
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            {["Все инструменты редактирования", "Полное качество, без водяного знака", `${freeLimit} экспорта`].map(
              (feature) => (
                <li key={feature} className="flex gap-2.5 text-[12px] leading-relaxed text-ash">
                  <Tick />
                  {feature}
                </li>
              ),
            )}
          </ul>
          <div className="mt-auto pt-6">
            {user ? (
              <Link
                href="/studio"
                className="inline-flex w-full items-center justify-center border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-line-lit hover:text-chalk"
              >
                Перейти в редактор
              </Link>
            ) : (
              <Link
                href="/royxat"
                className="inline-flex w-full items-center justify-center border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-line-lit hover:text-chalk"
              >
                Начать бесплатно
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {plans.map((plan, index) => {
        const featured = index === featuredIndex;
        return (
          <div
            key={plan.id}
            className={`relative flex flex-col p-6 ${featured ? "bg-riser" : "bg-slab"}`}
          >
            {featured ? (
              <span className="absolute top-0 right-0 bg-safe px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink">
                Рекомендуем
              </span>
            ) : null}

            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
              {plan.days >= 365 ? "Годовой" : `${plan.days} дней`}
            </span>
            <h3 className="mt-3 font-display text-[26px] leading-none text-chalk">{plan.name}</h3>

            <p className="mt-4 flex items-baseline gap-1.5">
              <span
                className={`font-mono text-[30px] leading-none tabular-nums ${
                  featured ? "text-safe-soft" : "text-chalk"
                }`}
              >
                {formatSom(plan.priceSom)}
              </span>
              <span className="font-mono text-[11px] text-dust">сом</span>
            </p>

            {plan.description ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ash">{plan.description}</p>
            ) : null}

            <ul className="mt-5 flex flex-col gap-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[12px] leading-relaxed text-ash">
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
                  className={`inline-flex w-full items-center justify-center border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                    featured
                      ? "border-safe bg-safe/12 text-safe-soft hover:bg-safe/20"
                      : "border-line text-ash hover:border-line-lit hover:text-chalk"
                  }`}
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
