"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { humanDate, PERIODS, type Period } from "@/lib/ledger";

/**
 * The reporting window, shared by every page in the section.
 *
 * A client component so it can read the current path: the period has to follow
 * whichever tab you are on, and links back to a hard-coded `/kassa` would throw
 * you out of Приход every time you changed the dates.
 */
export function PeriodPicker({ period }: { period: Period }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((option) => {
          const active = period.id === option.id;
          return (
            <Link
              key={option.id}
              href={`${pathname}?davr=${option.id}`}
              className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                active
                  ? "border-safe/60 bg-safe/12 text-safe-soft"
                  : "border-line text-dust hover:border-line-lit hover:text-chalk"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <form method="get" action={pathname} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="davr" value="custom" />
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-dust">С</span>
          <input
            type="date"
            name="dan"
            defaultValue={period.from}
            className="border border-line bg-pit px-2.5 py-1.5 font-mono text-[11px] text-chalk tabular-nums outline-none focus:border-safe/50"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-dust">По</span>
          <input
            type="date"
            name="gacha"
            defaultValue={period.to}
            className="border border-line bg-pit px-2.5 py-1.5 font-mono text-[11px] text-chalk tabular-nums outline-none focus:border-safe/50"
          />
        </label>
        <button
          type="submit"
          className="border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors hover:border-line-lit hover:text-chalk"
        >
          Показать
        </button>
        <span className="pb-1.5 font-mono text-[10px] text-dust">
          {humanDate(period.from)} — {humanDate(period.to)}
        </span>
      </form>
    </div>
  );
}
