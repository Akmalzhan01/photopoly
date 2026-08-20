"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/zakazlar", label: "Заказы", hint: "Всё, что в работе" },
  { href: "/zakazlar/yangi", label: "Новый", hint: "Принять заказ" },
  { href: "/zakazlar/arxiv", label: "Архив", hint: "Выданные и отменённые" },
];

/**
 * The section's own navigation.
 *
 * Reads only the path, unlike the till's tabs, which also carry a period across
 * — the list has no period to keep, so this needs no Suspense boundary around
 * it and can render straight into the static shell.
 */
export function OrdersNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы заказов"
      // `self-start` keeps the rail as tall as its tabs; as a grid item it would
      // otherwise stretch beside a long list. Sticky under the site header so
      // the tabs stay reachable while scrolling a long day's work.
      className="flex gap-px self-start overflow-x-auto bg-line lg:sticky lg:top-20 lg:flex-col"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`min-w-[130px] px-4 py-3 transition-colors lg:min-w-0 ${
              active ? "bg-riser" : "bg-slab hover:bg-riser/60"
            }`}
          >
            <span
              className={`block font-mono text-[11px] uppercase tracking-[0.16em] ${
                active ? "text-safe-soft" : "text-dust"
              }`}
            >
              {tab.label}
            </span>
            <span className="mt-1 hidden text-[11px] leading-snug text-dust lg:block">
              {tab.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
