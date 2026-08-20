"use client";

import Link from "next/link";
import { startTransition, useOptimistic, useState } from "react";
import {
  bankOrder,
  deleteOrder,
  setOrderStage,
  unbankOrder,
  type Ack,
} from "@/app/actions/orders";
import { formatSom } from "@/lib/money";
import {
  BOARD,
  describe,
  STAGES,
  summarise,
  type Order,
  type Stage,
} from "@/lib/orders";
import { OrderRow, type RowActions } from "./OrderRow";

/**
 * The three things that can happen to a row without waiting for the server.
 *
 * A move and a cancellation are the same change — cancelling sets a stage the
 * list does not carry, so the row leaves the moment it is chosen.
 */
type Change =
  | { kind: "stage"; id: string; stage: Stage }
  | { kind: "drop"; id: string }
  | { kind: "ledger"; id: string; inLedger: boolean };

function reduce(orders: Order[], change: Change): Order[] {
  if (change.kind === "drop") return orders.filter((order) => order.id !== change.id);
  return orders.map((order) => {
    if (order.id !== change.id) return order;
    return change.kind === "stage"
      ? { ...order, stage: change.stage }
      : { ...order, inLedger: change.inLedger };
  });
}

function Summary({ orders, today }: { orders: Order[]; today: string }) {
  const totals = summarise(orders, today);

  const cells: { label: string; value: string; tone: string }[] = [
    { label: "В работе", value: String(totals.open), tone: "text-chalk" },
    {
      label: "Просрочено",
      value: String(totals.overdue),
      tone: totals.overdue > 0 ? "text-safe" : "text-chalk",
    },
    { label: "Ожидается", value: `${formatSom(totals.pipeline)} сом`, tone: "text-safe-soft" },
    {
      label: "Не в кассе",
      value: String(totals.unbanked),
      tone: totals.unbanked > 0 ? "text-safe" : "text-chalk",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-slab px-4 py-3.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
            {cell.label}
          </span>
          <p className={`mt-1.5 font-mono text-[21px] leading-none tabular-nums ${cell.tone}`}>
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}

type Filter = Stage | "ALL";

/**
 * Every order the shop has open, one per line.
 *
 * The stage lives in a dropdown rather than in columns. Columns looked like a
 * board but behaved like a puzzle: five of them squeezed the type down to
 * something nobody reads across a counter, and moving a job meant either
 * dragging — which touch browsers do not support — or decoding a pair of arrows.
 * A dropdown names every destination, works with one tap, and can be reached
 * from a keyboard.
 *
 * The list is drawn from an optimistic copy, so a row changes stage on the tap
 * rather than after a round trip to Frankfurt — long enough from Bishkek to make
 * a shop tap twice. React holds that copy until the action settles, so a
 * rejected move snaps back on its own; no reverting is written here.
 */
export function OrderList({ orders, today }: { orders: Order[]; today: string }) {
  const [view, apply] = useOptimistic(orders, reduce);
  const [busy, setBusy] = useState<string | null>(null);
  const [ack, setAck] = useState<Ack | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [open, setOpen] = useState<string | null>(null);

  function run(id: string, change: Change, call: () => Promise<Ack>) {
    setBusy(id);
    startTransition(async () => {
      apply(change);
      setAck(await call());
      setBusy(null);
    });
  }

  const actions: RowActions = {
    move: (order, stage) => {
      if (order.stage === stage) return;
      if (stage === "CANCELLED" && !window.confirm(`Отменить заказ ${describe(order)}?`)) return;
      run(order.id, { kind: "stage", id: order.id, stage }, () => setOrderStage(order.id, stage));
    },
    remove: (order) => {
      if (!window.confirm(`Удалить заказ ${describe(order)} насовсем?`)) return;
      run(order.id, { kind: "drop", id: order.id }, () => deleteOrder(order.id));
    },
    bank: (order) =>
      run(order.id, { kind: "ledger", id: order.id, inLedger: true }, () => bankOrder(order.id)),
    unbank: (order) => {
      if (!window.confirm(`Удалить запись о заказе ${describe(order)} из кассы?`)) return;
      run(order.id, { kind: "ledger", id: order.id, inLedger: false }, () => unbankOrder(order.id));
    },
  };

  if (view.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Summary orders={view} today={today} />
        <div className="border border-line bg-slab p-6">
          <p className="text-[14px] leading-relaxed text-ash">
            Заказов пока нет. Примите первый — имени клиента и услуги достаточно,
            остальное можно дописать позже.
          </p>
          <Link
            href="/zakazlar/yangi"
            className="mt-4 inline-flex border border-safe bg-safe/12 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-safe-soft transition-colors hover:bg-safe/20"
          >
            Принять заказ
          </Link>
        </div>
      </div>
    );
  }

  const counts = new Map<Filter, number>([["ALL", view.length]]);
  for (const stage of BOARD) {
    counts.set(stage, view.filter((order) => order.stage === stage).length);
  }

  const rows = filter === "ALL" ? view : view.filter((order) => order.stage === filter);

  return (
    <div className="flex flex-col gap-5">
      <Summary orders={view} today={today} />

      {/* Counts come from the same optimistic list as the rows, so moving a job
          moves the tallies with it. */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...BOARD] as Filter[]).map((choice) => {
          const active = filter === choice;
          const count = counts.get(choice) ?? 0;
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(choice)}
              className={`border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                active
                  ? "border-safe bg-safe/12 text-safe-soft"
                  : "border-line text-dust hover:border-line-lit hover:text-ash"
              }`}
            >
              {choice === "ALL" ? "Все" : STAGES[choice].label}{" "}
              {/* A real space, not just margin: without it the accessible name
                  comes out "Новый2", which is what a screen reader says. */}
              <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-4.5">
        {ack?.error ? (
          <span role="alert" className="text-[12px] text-safe">
            {ack.error}
          </span>
        ) : ack?.done ? (
          <span role="status" className="text-[12px] text-safe-soft">
            {ack.done}
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="border border-line bg-slab px-4 py-6">
          <p className="text-[14px] text-ash">
            {filter === "ALL" ? "" : `${STAGES[filter].hint} — сейчас пусто.`}
          </p>
        </div>
      ) : (
        <ul className="border border-line bg-slab">
          {rows.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              today={today}
              busy={busy === order.id}
              open={open === order.id}
              onToggle={() => setOpen((current) => (current === order.id ? null : order.id))}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
