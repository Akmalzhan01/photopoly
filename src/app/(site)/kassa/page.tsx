import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { LinkButton } from "@/components/site/ui";
import { PeriodPicker } from "@/components/kassa/PeriodPicker";
import { Breakdown, Empty, EntriesTable, SectionHead, TotalsRow } from "@/components/kassa/parts";
import { getByCategory, getTotals, listEntries } from "@/lib/server/ledger";
import { resolvePeriod, shopToday } from "@/lib/ledger";
import { readSearch, type Search } from "./search";

export const metadata: Metadata = { title: "Касса — photopoly" };

/** How many of the newest lines the overview shows before sending you to a tab. */
const RECENT = 8;

export default async function KassaOverview({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const period = resolvePeriod(readSearch(params), shopToday());

  const [totals, byCategory, recent] = await Promise.all([
    getTotals(user.id, period),
    getByCategory(user.id, period),
    listEntries(user.id, period, { take: RECENT }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PeriodPicker period={period} />

      <TotalsRow totals={totals} />

      {totals.count === 0 ? (
        <div className="flex flex-col gap-4">
          <Empty>
            За этот период записей нет. Начните с прихода — например, дневная выручка
            за фото на документы.
          </Empty>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/kassa/kirim">Записать приход</LinkButton>
            <LinkButton href="/kassa/chiqim" tone="ghost">
              Записать расход
            </LinkButton>
          </div>
        </div>
      ) : (
        <>
          <section>
            <SectionHead index="02" title="По категориям" />
            <div className="grid gap-4 md:grid-cols-2">
              <Breakdown kind="INCOME" rows={byCategory} />
              <Breakdown kind="EXPENSE" rows={byCategory} />
            </div>
          </section>

          <section>
            <SectionHead index="03" title="Последние записи" />
            <EntriesTable entries={recent} />
            {totals.count > recent.length ? (
              <p className="mt-3 font-mono text-[10px] text-dust">
                Показаны {recent.length} из {totals.count}. Полные списки — на вкладках
                «Приход» и «Расход».
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
