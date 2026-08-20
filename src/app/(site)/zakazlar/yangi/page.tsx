import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/server/dal";
import { Panel } from "@/components/site/ui";
import { OrderForm } from "@/components/orders/OrderForm";

export const metadata: Metadata = { title: "Новый заказ — photopoly" };

export default async function NewOrder() {
  await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <Panel className="p-5">
        <OrderForm />
      </Panel>

      <p className="text-[12px] leading-relaxed text-dust">
        Заказ появится в списке со статусом «Новый». Номер присваивается сам и считается
        отдельно в каждой мастерской. Когда работа будет выдана и оплачена, её
        можно одной кнопкой записать в{" "}
        <Link href="/kassa" className="text-safe-soft underline-offset-2 hover:underline">
          кассу
        </Link>
        .
      </p>
    </div>
  );
}
