import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { PeriodPicker } from "@/components/kassa/PeriodPicker";
import { Breakdown, DayTable, Empty, SectionHead, TotalsRow } from "@/components/kassa/parts";
import { formatSom } from "@/lib/money";
import { Panel } from "@/components/site/ui";
import { getByCategory, getByDay, getTotals } from "@/lib/server/ledger";
import { daysBetween, humanDate, resolvePeriod, shopToday } from "@/lib/ledger";
import { readSearch, type Search } from "../search";

export const metadata: Metadata = { title: "Отчёт — касса — photopoly" };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const period = resolvePeriod(readSearch(params), shopToday());

  const [totals, byCategory, days] = await Promise.all([
    getTotals(user.id, period),
    getByCategory(user.id, period),
    getByDay(user.id, period),
  ]);

  const span = daysBetween(period.from, period.to);
  // Averaged over the whole window rather than over the days that had takings:
  // a shop asking "what do I make a day" is counting the quiet ones too.
  const perDay = span > 0 ? Math.round(totals.profit / span) : 0;
  const best = days.reduce<(typeof days)[number] | null>(
    (top, day) => (top === null || day.income > top.income ? day : top),
    null,
  );

  return (
    <div className="flex flex-col gap-10">
      <PeriodPicker period={period} />

      <TotalsRow totals={totals} />

      {totals.count === 0 ? (
        <Empty>
          За {humanDate(period.from)} — {humanDate(period.to)} записей нет. Выберите другой
          период или запишите первую операцию на вкладке «Приход».
        </Empty>
      ) : (
        <>
          <section>
            <SectionHead index="02" title="Итого за период" />
            <Panel className="divide-y divide-line">
              {[
                ["Дней в периоде", `${span}`],
                ["Дней с движением", `${days.length}`],
                ["Прибыль в день, в среднем", `${perDay > 0 ? "+" : ""}${formatSom(perDay)} сом`],
                ...(best
                  ? [["Лучший день", `${humanDate(best.date)} · ${formatSom(best.income)} сом`]]
                  : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
                    {label}
                  </span>
                  <span className="font-mono text-[12px] text-chalk tabular-nums">{value}</span>
                </div>
              ))}
            </Panel>
          </section>

          <section>
            <SectionHead index="03" title="По категориям" />
            <div className="grid gap-4 md:grid-cols-2">
              <Breakdown kind="INCOME" rows={byCategory} />
              <Breakdown kind="EXPENSE" rows={byCategory} />
            </div>
          </section>

          <section>
            <SectionHead index="04" title="По дням" />
            <DayTable days={days} />
            <p className="mt-3 font-mono text-[10px] text-dust">
              Дни без записей пропущены.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
