"use client";

import Link from "next/link";
import type { EntitlementView } from "@/lib/entitlement-view";

/**
 * Shown when the allowance runs out, wherever a file was being made.
 *
 * Deliberately dismissible. Whatever the person was working on is still on the
 * screen behind it, and a wall that cannot be closed would throw away a photo
 * somebody is standing at the counter waiting for — the limit stops the file,
 * not the work.
 */
export function QuotaWall({
  entitlement,
  onClose,
  stayLabel,
}: {
  entitlement: EntitlementView | null;
  onClose: () => void;
  /** Where "stay" leaves them, in their words: the editor, this page, … */
  stayLabel: string;
}) {
  const subscribed = entitlement?.source === "subscription";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-md animate-rise border border-line bg-slab p-7 rounded-lg">
        <span className="text-[12px] text-ember font-medium">
          Лимит исчерпан
        </span>
        <h2 id="quota-title" className="mt-3 font-display text-[28px] leading-tight text-chalk font-semibold tracking-tight">
          {subscribed
            ? "Экспорты по тарифу закончились."
            : "Бесплатные экспорты закончились."}
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-ash">
          {subscribed
            ? "Выберите новый тариф и продолжайте. Работа останется на месте."
            : `Пробные экспорты (${entitlement?.freeLimit ?? 0}) израсходованы. Выберите тариф — работа останется на месте.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/narxlar"
            className="inline-flex items-center border border-transparent bg-safe px-4 py-2.5 text-[13px] text-white transition-colors hover:bg-safe/90 font-medium rounded-lg"
          >
            Смотреть тарифы
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center border border-line px-4 py-2.5 text-[13px] text-ash transition-colors hover:border-line-lit hover:text-chalk font-medium rounded-lg"
          >
            {stayLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
