import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { OrderList } from "@/components/orders/OrderList";
import { listBoard, DONE_WINDOW_DAYS } from "@/lib/server/orders";
import { shopToday } from "@/lib/ledger";

export const metadata: Metadata = { title: "Заказы — photopoly" };

export default async function OrdersBoard() {
  const user = await requireUser();
  const orders = await listBoard(user.id);

  return (
    <div className="flex flex-col gap-6">
      {/* `today` comes from the server so the list and the due dates agree on
          which day it is — a browser clock set wrong would otherwise mark half
          the shop's work overdue. */}
      <OrderList orders={orders} today={shopToday()} />

      <p className="text-[12px] leading-relaxed text-dust">
        Выданные заказы остаются в списке {DONE_WINDOW_DAYS} дней, потом уходят
        в архив.
      </p>
    </div>
  );
}
