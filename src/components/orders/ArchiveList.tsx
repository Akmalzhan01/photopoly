"use client";

import { startTransition, useOptimistic, useState } from "react";
import { bankOrder, deleteOrder, setOrderStage, type Ack } from "@/app/actions/orders";
import { Panel } from "@/components/site/ui";
import { formatSom } from "@/lib/money";
import { humanDate } from "@/lib/ledger";
import { describe, serviceLabel, type Order, type Stage } from "@/lib/orders";

const ACTION =
  "font-mono text-[10px] uppercase tracking-[0.14em] text-dust transition-colors hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40";

/** Restoring or deleting takes the row out of this list; banking only marks it. */
type Change = { kind: "drop"; id: string } | { kind: "bank"; id: string };

/**
 * Finished and abandoned orders, kept out of the working list.
 *
 * They are off the main list on purpose, so the only moves offered here are the
 * two that make sense afterwards: putting one back into circulation because the
 * customer came back, and writing an old job to the till that never got there.
 */
export function ArchiveList({
  orders,
  restoreTo,
  empty,
}: {
  orders: Order[];
  /** Where «вернуть в работу» puts it — a cancelled job starts over. */
  restoreTo: Stage;
  empty: string;
}) {
  const [view, apply] = useOptimistic(orders, (state: Order[], change: Change) =>
    change.kind === "drop"
      ? state.filter((order) => order.id !== change.id)
      : state.map((order) =>
          order.id === change.id ? { ...order, inLedger: true } : order,
        ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [ack, setAck] = useState<Ack | null>(null);

  function run(id: string, change: Change, call: () => Promise<Ack>) {
    setBusy(id);
    startTransition(async () => {
      apply(change);
      setAck(await call());
      setBusy(null);
    });
  }

  if (view.length === 0) {
    return (
      <Panel className="p-6">
        <p className="text-[13px] leading-relaxed text-ash">{empty}</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {ack?.error ? (
        <span role="alert" className="font-mono text-[10px] text-safe">
          {ack.error}
        </span>
      ) : ack?.done ? (
        <span role="status" className="font-mono text-[10px] text-safe-soft">
          {ack.done}
        </span>
      ) : null}

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {["№", "Клиент", "Услуга", "Срок", "Сумма", ""].map((head) => (
                <th
                  key={head}
                  className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-dust"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((order) => {
              const working = busy === order.id;
              return (
                <tr key={order.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-mono text-[11px] text-dust tabular-nums">
                    {order.number}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-chalk">
                    {order.clientName}
                    {order.phone ? (
                      <span className="ml-2 font-mono text-[10px] text-dust">{order.phone}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-ash">
                    {serviceLabel(order.service)}
                    {order.qty > 1 ? ` · ${order.qty} шт` : ""}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-dust tabular-nums">
                    {order.dueOn ? humanDate(order.dueOn) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-chalk tabular-nums">
                    {order.priceSom > 0 ? formatSom(order.priceSom) : "—"}
                    {order.inLedger ? <span className="ml-2 text-safe-soft">✓</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      {order.priceSom > 0 && !order.inLedger ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            run(order.id, { kind: "bank", id: order.id }, () => bankOrder(order.id))
                          }
                          className={`${ACTION} text-safe-soft hover:text-safe`}
                        >
                          В кассу
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          run(order.id, { kind: "drop", id: order.id }, () =>
                            setOrderStage(order.id, restoreTo),
                          )
                        }
                        className={ACTION}
                      >
                        Вернуть в работу
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          if (!window.confirm(`Удалить заказ ${describe(order)} насовсем?`)) return;
                          run(order.id, { kind: "drop", id: order.id }, () => deleteOrder(order.id));
                        }}
                        className={`${ACTION} hover:text-safe`}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
