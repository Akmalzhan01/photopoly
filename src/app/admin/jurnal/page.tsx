import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/dal";
import { Eyebrow } from "@/components/site/ui";

const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "medium" });

const ACTION_LABEL: Record<string, string> = {
  "user.block": "Пользователь заблокирован",
  "user.unblock": "Снята блокировка",
  "user.role": "Изменена роль",
  "user.resetFree": "Сброшен бесплатный лимит",
  "subscription.grant": "Выдана подписка",
  "subscription.cancel": "Подписка отменена",
  "payment.confirm": "Платёж подтверждён",
  "payment.cancel": "Платёж отменён",
  "plan.save": "Тариф сохранён",
  "plan.toggle": "Изменена видимость тарифа",
  "settings.freeExports": "Настроен бесплатный лимит",
  // The suit actions were recording fine but had no label here, so the journal
  // showed the raw code for every upload and deletion.
  "attire.upload": "Костюм загружен",
  "attire.rename": "Костюм переименован",
  "attire.show": "Костюм показан",
  "attire.hide": "Костюм скрыт",
  "attire.delete": "Костюм удалён",
};

export default async function AuditPage() {
  await requireAdmin();

  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      meta: true,
      createdAt: true,
      actor: { select: { email: true } },
    },
  });

  return (
    <>
      <div className="mb-2 flex items-baseline gap-2.5">
        <Eyebrow>Журнал действий</Eyebrow>
      </div>
      <p className="mb-6 text-[12px] text-dust tabular-nums">
        Последние 200 административных действий. Эти записи не удаляются.
      </p>

      {entries.length === 0 ? (
        <div className="border border-line bg-slab p-6 rounded-lg">
          <p className="text-[13px] text-ash">Записей пока нет.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-line rounded-lg">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-riser">
              <tr>
                {["Время", "Кто", "Что", "Объект"].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-2.5 text-[12px] text-dust font-medium"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line bg-slab align-top">
                  <td className="px-4 py-2.5 text-[13px] whitespace-nowrap text-ash tabular-nums">
                    {dateTime.format(entry.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-[13px] text-chalk tabular-nums">
                    {entry.actor?.email ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-chalk">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] break-all text-dust tabular-nums">
                    {entry.targetType}:{entry.targetId?.slice(0, 10)}
                    {entry.meta ? (
                      <span className="ml-2 text-dust">{JSON.stringify(entry.meta).slice(0, 90)}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
