"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/kassa", label: "Обзор", hint: "Итоги и последние записи" },
  { href: "/kassa/kirim", label: "Приход", hint: "Что взяли с клиентов" },
  { href: "/kassa/chiqim", label: "Расход", hint: "На что потратили" },
  { href: "/kassa/hisobot", label: "Отчёт", hint: "По дням и категориям" },
];

function Tabs({ suffix, current }: { suffix: string; current: string | null }) {
  return (
    <nav
      aria-label="Разделы кассы"
      // `self-start` keeps the rail the height of its four tabs — as a grid item
      // it would otherwise stretch to match the content column and trail a long
      // empty bar down the page. Sticky below the site header, so the tabs stay
      // reachable while reading a long list of entries.
      className="flex gap-px self-start overflow-x-auto bg-line lg:sticky lg:top-20 lg:flex-col"
    >
      {TABS.map((tab) => {
        const active = current === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}${suffix}`}
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

/**
 * The section's own navigation.
 *
 * It carries the current period across tabs, which is why it reads the query
 * string: switching from Приход to Расход while looking at last month should
 * keep looking at last month, and a layout cannot see `searchParams` to do that
 * itself.
 */
export function KassaNav() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return <Tabs suffix={query ? `?${query}` : ""} current={pathname} />;
}

/**
 * What the prerendered shell shows until the query string is known.
 *
 * `useSearchParams` is only readable once the request is, so the tabs above
 * cannot be part of the static HTML — without this the whole layout would be
 * held back and the build refuses outright. Same markup, so nothing shifts when
 * the real one takes over; the links simply lack the period until it does.
 */
export function KassaNavFallback() {
  return <Tabs suffix="" current={null} />;
}
