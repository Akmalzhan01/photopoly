"use client";

import { formatSom } from "@/lib/money";
import { humanDate } from "@/lib/ledger";
import {
  BOARD,
  dueLabel,
  isClosed,
  isOverdue,
  serviceLabel,
  STAGES,
  type Order,
  type Stage,
} from "@/lib/orders";

export type RowActions = {
  move: (order: Order, stage: Stage) => void;
  remove: (order: Order) => void;
  bank: (order: Order) => void;
  unbank: (order: Order) => void;
};

const ACTION =
  "border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:border-line-lit hover:text-chalk disabled:cursor-not-allowed disabled:opacity-40";

/** Every stage a row can be sent to, cancellation included. */
const CHOICES: Stage[] = [...BOARD, "CANCELLED"];

/**
 * One order, on one line.
 *
 * Replaces the card-and-columns board, which read badly at the counter: five
 * columns forced everything into 10px type, and the moves hid behind `◂ ▸`
 * glyphs that say nothing about where a job is going. Here the stage is a plain
 * dropdown with the names written out, the type is big enough to read at arm's
 * length, and nothing needs dragging — the shop is on a tablet, and HTML5 drag
 * has never worked on touch.
 *
 * The row carries what is needed to decide what to do next; the phone number,
 * the note and the destructive buttons stay folded away until asked for.
 */
export function OrderRow({
  order,
  today,
  busy,
  open,
  onToggle,
  actions,
}: {
  order: Order;
  today: string;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  actions: RowActions;
}) {
  const late = isOverdue(order, today);
  const closed = isClosed(order.stage);
  const panel = `order-${order.id}`;

  return (
    <li
      className={`border-b border-line transition-colors last:border-b-0 hover:bg-riser/40 ${
        busy ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3.5">
        {/* The name is the button, not a lone chevron in the corner: the whole
            left side is what a hand reaches for, and a disclosure triangle in
            front of it says which way the row is about to go. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panel}
          onClick={onToggle}
          className="group flex min-w-52 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={`w-3 shrink-0 font-mono text-[10px] text-dust transition-transform group-hover:text-ash ${
              open ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          <span className="w-8 shrink-0 font-mono text-[12px] text-dust tabular-nums">
            №{order.number}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] leading-snug text-chalk">
              {order.clientName}
              {order.inLedger ? (
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-safe-soft">
                  ✓ в кассе
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ash">
              {serviceLabel(order.service)}
              {order.qty > 1 ? ` · ${order.qty} шт` : ""}
            </span>
          </span>
        </button>

        <div className="min-w-30 text-right">
          <p className="font-mono text-[15px] leading-snug text-chalk tabular-nums">
            {order.priceSom > 0 ? `${formatSom(order.priceSom)} с` : "—"}
          </p>
          {order.dueOn ? (
            <p className={`mt-0.5 text-[12px] leading-snug ${late ? "text-safe" : "text-dust"}`}>
              {late ? "! " : ""}
              {/* Once it is handed over the deadline is history: saying
                  "просрочен" about work finished last week is simply untrue. */}
              {closed ? humanDate(order.dueOn) : dueLabel(order.dueOn, today)}
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] leading-snug text-dust">без срока</p>
          )}
        </div>

        <select
          aria-label={`Этап заказа №${order.number}`}
          value={order.stage}
          disabled={busy}
          onChange={(event) => actions.move(order, event.target.value as Stage)}
          className="w-36 border border-line bg-pit px-3 py-2 text-[13px] text-chalk outline-none transition-colors hover:border-line-lit focus:border-safe/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {CHOICES.map((stage) => (
            <option key={stage} value={stage} className="bg-pit">
              {STAGES[stage].label}
            </option>
          ))}
        </select>
      </div>

      {open ? (
        <div id={panel} className="border-t border-line bg-pit/60 px-4 py-4">
          <dl className="flex flex-wrap gap-x-10 gap-y-2 text-[13px]">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
                Телефон
              </dt>
              <dd className="mt-1 text-chalk tabular-nums">
                {order.phone ? (
                  <a href={`tel:${order.phone.replace(/\s/g, "")}`} className="hover:text-safe-soft">
                    {order.phone}
                  </a>
                ) : (
                  <span className="text-dust">не записан</span>
                )}
              </dd>
            </div>
            <div className="min-w-56 flex-1">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
                Заметка
              </dt>
              <dd className="mt-1 leading-relaxed text-ash">
                {order.note ?? <span className="text-dust">нет</span>}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {order.stage === "DONE" && order.priceSom > 0 && !order.inLedger ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.bank(order)}
                className={`${ACTION} border-safe bg-safe/12 text-safe-soft hover:border-safe hover:bg-safe/20 hover:text-safe-soft`}
              >
                Записать в кассу
              </button>
            ) : null}
            {order.inLedger ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.unbank(order)}
                className={ACTION}
              >
                Убрать из кассы
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => actions.remove(order)}
              className={`${ACTION} hover:border-safe hover:text-safe`}
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
