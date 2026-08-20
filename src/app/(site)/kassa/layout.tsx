import { Suspense, type ReactNode } from "react";
import { Eyebrow } from "@/components/site/ui";
import { KassaNav, KassaNavFallback } from "@/components/kassa/KassaNav";

/**
 * The shell every cash-book page sits in.
 *
 * The heading and the tabs live here rather than being repeated four times, so
 * moving between Приход and Расход redraws only the part that actually differs.
 * Note there is no session check here: a layout is not a security boundary —
 * each page calls `requireUser()` itself, and the proxy turns anonymous
 * visitors away before either runs.
 */
export default function KassaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">01</span>
        <Eyebrow>Касса</Eyebrow>
      </div>
      <h1 className="font-display text-[clamp(30px,4.5vw,42px)] leading-[1.05] text-chalk">
        Приход и расход
      </h1>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-ash">
        Книга вашей мастерской: что взяли с клиентов и что потратили. Записи видите
        только вы — они не связаны с оплатой тарифа photopoly.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[190px_1fr]">
        {/* The tabs read the query string to keep the period across them, which
            is only knowable per request — see the note on KassaNavFallback. */}
        <Suspense fallback={<KassaNavFallback />}>
          <KassaNav />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
