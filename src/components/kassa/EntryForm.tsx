"use client";

import { useActionState, useState } from "react";
import { addLedgerEntry } from "@/app/actions/ledger";
import { Button } from "@/components/site/ui";
import { CATEGORIES, MAX_NOTE, type LedgerKind } from "@/lib/ledger";

const INPUT =
  "w-full border border-line bg-pit px-3 py-2.5 text-sm text-chalk outline-none transition-colors placeholder:text-dust focus:border-safe/50";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-dust";

const PLACEHOLDER: Record<LedgerKind, string> = {
  INCOME: "10 фото на паспорт",
  EXPENSE: "пачка бумаги 100 листов",
};

/**
 * Writing one line into the shop's book.
 *
 * The direction is fixed by whichever page the form sits on rather than chosen
 * inside it: a shopkeeper on Приход is entering takings, and a switch there
 * would only ever be a way to file money in the wrong column by accident.
 */
export function EntryForm({ kind, today }: { kind: LedgerKind; today: string }) {
  const [state, submit, pending] = useActionState(addLedgerEntry, undefined);
  const [category, setCategory] = useState(CATEGORIES[kind][0].code);

  // Changes on every successful save, and nothing else. Used as a key so those
  // two inputs remount empty — see the note on LedgerState. The date survives:
  // the next line is nearly always the same day, and re-picking it would make
  // entering a day's takings a chore.
  const savedAt = state?.savedAt ?? 0;

  return (
    <form action={submit} className="flex flex-col gap-4">
      <input type="hidden" name="kind" value={kind} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Сумма, сом</span>
          <input
            key={`amount-${savedAt}`}
            name="amount"
            defaultValue=""
            // Not type="number": it brings spinners and a locale-dependent
            // decimal, and the amount here is always a whole number of som.
            inputMode="numeric"
            autoComplete="off"
            placeholder="1500"
            required
            autoFocus
            className={`${INPUT} tabular-nums`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Дата</span>
          <input
            type="date"
            name="occurredAt"
            defaultValue={today}
            required
            className={`${INPUT} tabular-nums`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Категория</span>
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={INPUT}
        >
          {CATEGORIES[kind].map((option) => (
            <option key={option.code} value={option.code} className="bg-pit">
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Заметка — необязательно</span>
        <input
          key={`note-${savedAt}`}
          name="note"
          defaultValue=""
          maxLength={MAX_NOTE}
          autoComplete="off"
          placeholder={PLACEHOLDER[kind]}
          className={INPUT}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Запись…" : kind === "INCOME" ? "Записать приход" : "Записать расход"}
        </Button>
        {state?.error ? (
          <span role="alert" className="font-mono text-[10px] text-ember">
            {state.error}
          </span>
        ) : state?.done ? (
          <span role="status" className="font-mono text-[10px] text-safe-soft">
            {state.done}
          </span>
        ) : null}
      </div>
    </form>
  );
}
