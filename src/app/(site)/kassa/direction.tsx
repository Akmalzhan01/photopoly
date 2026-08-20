import { requireUser } from "@/lib/server/dal";
import { Panel } from "@/components/site/ui";
import { EntryForm } from "@/components/kassa/EntryForm";
import { PeriodPicker } from "@/components/kassa/PeriodPicker";
import { Breakdown, Empty, EntriesTable, SectionHead, Stat } from "@/components/kassa/parts";
import { formatSom } from "@/lib/money";
import { getByCategory, getTotals, listEntries, PAGE_SIZE } from "@/lib/server/ledger";
import { resolvePeriod, shopToday, type LedgerKind } from "@/lib/ledger";
import { readSearch, type Search } from "./search";

/**
 * Приход and Расход are the same page with the sign flipped, so they are one
 * component rather than two files kept in step by hand. Everything that differs
 * between them is in `COPY`.
 */
const COPY = {
  INCOME: {
    total: "Приход за период",
    form: "Новый приход",
    list: "Все приходы",
    empty: "За этот период приходов нет. Запишите первый — например, дневную выручку.",
    tone: "text-safe-soft",
  },
  EXPENSE: {
    total: "Расход за период",
    form: "Новый расход",
    list: "Все расходы",
    empty: "За этот период расходов нет. Сюда идут бумага, чернила, аренда и всё прочее.",
    tone: "text-ember",
  },
} as const satisfies Record<LedgerKind, unknown>;

export async function DirectionPage({
  kind,
  searchParams,
}: {
  kind: LedgerKind;
  searchParams: Promise<Search>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const period = resolvePeriod(readSearch(params), shopToday());
  const copy = COPY[kind];

  const [totals, byCategory, entries] = await Promise.all([
    getTotals(user.id, period),
    getByCategory(user.id, period),
    listEntries(user.id, period, { kind }),
  ]);

  const sum = kind === "INCOME" ? totals.income : totals.expense;

  return (
    <div className="flex flex-col gap-10">
      <PeriodPicker period={period} />

      <div className="grid gap-px bg-line sm:grid-cols-2">
        <Stat
          label={copy.total}
          value={`${formatSom(sum)} сом`}
          tone={copy.tone}
          hint={`${entries.length} ${entries.length === 1 ? "запись" : "записей"}`}
        />
        <Stat
          label="Прибыль за период"
          value={`${totals.profit > 0 ? "+" : ""}${formatSom(totals.profit)} сом`}
          tone={totals.profit > 0 ? "text-safe-soft" : totals.profit < 0 ? "text-ember" : "text-chalk"}
          hint="Приход минус расход"
        />
      </div>

      <section>
        <SectionHead index="02" title={copy.form} />
        <Panel className="p-5">
          <EntryForm kind={kind} today={shopToday()} />
        </Panel>
      </section>

      <section>
        <SectionHead index="03" title="По категориям" />
        <Breakdown kind={kind} rows={byCategory} />
      </section>

      <section>
        <SectionHead index="04" title={copy.list} />
        {entries.length === 0 ? (
          <Empty>{copy.empty}</Empty>
        ) : (
          <>
            <EntriesTable entries={entries} showKind={false} />
            {entries.length === PAGE_SIZE ? (
              <p className="mt-3 font-mono text-[10px] text-dust">
                Показаны последние {PAGE_SIZE}. Возьмите промежуток покороче, чтобы
                увидеть остальные.
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
