import type { ReactNode } from "react";
import { Eyebrow } from "@/components/site/ui";
import { OrdersNav } from "@/components/orders/OrdersNav";

/**
 * The shell every order page sits in.
 *
 * Narrower than the board it replaced: a list of full-width rows reads better
 * with a measure it cannot sprawl past, where five columns of cards had needed
 * every pixel. As in the till, there is no session check here — a layout is not
 * a security boundary; each page calls `requireUser()` and the proxy turns
 * anonymous visitors away before either runs.
 */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-260 px-5 py-16">
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">02</span>
        <Eyebrow>Заказы</Eyebrow>
      </div>
      <h1 className="font-display text-[clamp(30px,4.5vw,42px)] leading-[1.05] text-chalk">
        Заказы клиентов
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ash">
        Что клиенты заказали и на каком этапе это сейчас. Ведёте только вы — записи
        не связаны ни с тарифом photopoly, ни с другими мастерскими.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[190px_1fr]">
        <OrdersNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
