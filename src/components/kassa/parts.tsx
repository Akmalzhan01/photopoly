import { Panel } from "@/components/site/ui";
import { formatSom } from "@/lib/money";
import { categoryLabel, humanDate, type LedgerKind } from "@/lib/ledger";
import type { CategoryTotal, DayTotal, Entry, Totals } from "@/lib/server/ledger";
import { DeleteEntry } from "./DeleteEntry";

/**
 * The pieces every page in the section shows, so the four of them agree on what
 * a total or a row looks like instead of each drawing its own.
 */

export function Stat({
  label,
  value,
  tone = "text-chalk",
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="bg-slab p-5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">{label}</span>
      <p className={`mt-2 font-mono text-[22px] leading-none tabular-nums ${tone}`}>{value}</p>
      {hint ? <p className="mt-1.5 font-mono text-[10px] text-dust">{hint}</p> : null}
    </div>
  );
}

export function profitTone(profit: number): string {
  return profit > 0 ? "text-safe-soft" : profit < 0 ? "text-ember" : "text-chalk";
}

function plural(count: number): string {
  const tail = count % 100;
  if (tail > 10 && tail < 20) return "записей";
  const last = count % 10;
  if (last === 1) return "запись";
  if (last >= 2 && last <= 4) return "записи";
  return "записей";
}

export function TotalsRow({ totals }: { totals: Totals }) {
  return (
    <div className="grid gap-px bg-line sm:grid-cols-3">
      <Stat label="Приход" value={`${formatSom(totals.income)} сом`} tone="text-safe-soft" />
      <Stat label="Расход" value={`${formatSom(totals.expense)} сом`} tone="text-ember" />
      <Stat
        label="Прибыль"
        value={`${totals.profit > 0 ? "+" : ""}${formatSom(totals.profit)} сом`}
        tone={profitTone(totals.profit)}
        hint={`${totals.count} ${plural(totals.count)}`}
      />
    </div>
  );
}

export function Breakdown({
  kind,
  rows,
  title,
}: {
  kind: LedgerKind;
  rows: CategoryTotal[];
  title?: string;
}) {
  const mine = rows.filter((row) => row.kind === kind);
  // Never zero, so a lone category still draws a full bar instead of dividing by nothing.
  const top = Math.max(...mine.map((row) => row.total), 1);
  const bar = kind === "INCOME" ? "bg-safe/35" : "bg-ember/35";

  return (
    <Panel className="p-5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
        {title ?? (kind === "INCOME" ? "Откуда пришло" : "На что ушло")}
      </h3>
      {mine.length === 0 ? (
        <p className="mt-3 text-[13px] text-dust">Записей за этот период нет.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {mine.map((row) => (
            <li key={row.category}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ash">{categoryLabel(kind, row.category)}</span>
                <span className="font-mono text-[12px] text-chalk tabular-nums">
                  {formatSom(row.total)}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full bg-line">
                <div className={`h-full ${bar}`} style={{ width: `${(row.total / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function EntriesTable({
  entries,
  showKind = true,
}: {
  entries: Entry[];
  /** Off on the single-direction pages, where every row is the same sign. */
  showKind?: boolean;
}) {
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {["Дата", "Категория", "Заметка", "Сумма", ""].map((head) => (
              <th
                key={head}
                className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-dust"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const label = categoryLabel(entry.kind, entry.category);
            const income = entry.kind === "INCOME";
            return (
              <tr key={entry.id} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-mono text-[11px] text-ash tabular-nums">
                  {humanDate(entry.occurredAt)}
                </td>
                <td className="px-4 py-3 text-[13px] text-chalk">{label}</td>
                <td className="px-4 py-3 text-[12px] text-dust">{entry.note ?? "—"}</td>
                <td
                  className={`px-4 py-3 font-mono text-[12px] tabular-nums ${
                    income ? "text-safe-soft" : "text-ember"
                  }`}
                >
                  {showKind ? (income ? "+" : "−") : ""}
                  {formatSom(entry.amountSom)}
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteEntry
                    id={entry.id}
                    summary={`${humanDate(entry.occurredAt)} · ${label} · ${formatSom(entry.amountSom)}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function DayTable({ days }: { days: DayTotal[] }) {
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {["День", "Приход", "Расход", "Прибыль"].map((head) => (
              <th
                key={head}
                className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-dust"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const profit = day.income - day.expense;
            return (
              <tr key={day.date} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-3 font-mono text-[11px] text-ash tabular-nums">
                  {humanDate(day.date)}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-safe-soft tabular-nums">
                  {day.income ? formatSom(day.income) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-ember tabular-nums">
                  {day.expense ? formatSom(day.expense) : "—"}
                </td>
                <td
                  className={`px-4 py-3 font-mono text-[12px] tabular-nums ${profitTone(profit)}`}
                >
                  {profit > 0 ? "+" : ""}
                  {formatSom(profit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Panel className="p-6">
      <p className="text-[13px] leading-relaxed text-ash">{children}</p>
    </Panel>
  );
}

export function SectionHead({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-2.5">
      <span className="font-mono text-[10px] text-ember">{index}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash">{title}</span>
    </div>
  );
}
