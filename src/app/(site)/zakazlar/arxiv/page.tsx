import type { Metadata } from "next";
import { requireUser } from "@/lib/server/dal";
import { ArchiveList } from "@/components/orders/ArchiveList";
import { SectionHead } from "@/components/kassa/parts";
import { ARCHIVE_LIMIT, listArchive } from "@/lib/server/orders";

export const metadata: Metadata = { title: "Архив заказов — photopoly" };

export default async function OrdersArchive() {
  const user = await requireUser();
  const { done, cancelled } = await listArchive(user.id);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <SectionHead index="01" title="Выданные" />
        <ArchiveList
          orders={done}
          // Back to «Готов», not «Новый»: the work is finished, the customer has
          // simply come back for it.
          restoreTo="READY"
          empty="Выданных заказов пока нет."
        />
      </section>

      <section>
        <SectionHead index="02" title="Отменённые" />
        <ArchiveList
          orders={cancelled}
          restoreTo="NEW"
          empty="Отменённых заказов нет — и хорошо."
        />
      </section>

      {done.length === ARCHIVE_LIMIT || cancelled.length === ARCHIVE_LIMIT ? (
        <p className="font-mono text-[10px] text-dust">
          Показаны последние {ARCHIVE_LIMIT} в каждом списке.
        </p>
      ) : null}
    </div>
  );
}
