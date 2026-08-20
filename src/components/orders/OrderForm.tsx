"use client";

import { useActionState, useState } from "react";
import { addOrder } from "@/app/actions/orders";
import { Button } from "@/components/site/ui";
import { MAX_NAME, MAX_NOTE, MAX_PHONE, MAX_QTY, SERVICES } from "@/lib/orders";

const INPUT =
  "w-full border border-line bg-pit px-3 py-2.5 text-sm text-chalk outline-none transition-colors placeholder:text-dust focus:border-safe/50";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-dust";

/**
 * Taking an order in.
 *
 * Only the name and the service are required. A shop taking an order over the
 * counter often does not yet know the price or the day, and a form that insists
 * on them just teaches people to type a zero — better to accept the order and
 * let the rest be filled in when it is actually known.
 */
export function OrderForm() {
  const [state, submit, pending] = useActionState(addOrder, undefined);
  const [service, setService] = useState(SERVICES[0].code);

  // Changes only on a successful save, and used as a key so those inputs remount
  // empty for the next customer — clearing them from an effect would mean a
  // second render on every save, which is exactly what effects are not for.
  const savedAt = state?.savedAt ?? 0;

  return (
    <form action={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Клиент</span>
          <input
            key={`name-${savedAt}`}
            name="clientName"
            defaultValue=""
            maxLength={MAX_NAME}
            autoComplete="off"
            placeholder="Азамат"
            required
            autoFocus
            className={INPUT}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Телефон — необязательно</span>
          <input
            key={`phone-${savedAt}`}
            name="phone"
            type="tel"
            defaultValue=""
            maxLength={MAX_PHONE}
            autoComplete="off"
            placeholder="0555 12 34 56"
            className={`${INPUT} tabular-nums`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Услуга</span>
        <select
          name="service"
          value={service}
          onChange={(event) => setService(event.target.value)}
          className={INPUT}
        >
          {SERVICES.map((option) => (
            <option key={option.code} value={option.code} className="bg-pit">
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Количество</span>
          <input
            key={`qty-${savedAt}`}
            name="qty"
            defaultValue="1"
            inputMode="numeric"
            autoComplete="off"
            max={MAX_QTY}
            className={`${INPUT} tabular-nums`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Цена, сом</span>
          <input
            key={`price-${savedAt}`}
            name="price"
            defaultValue=""
            // Not type="number": it brings spinners and a locale-dependent
            // decimal, and the price here is always a whole number of som.
            inputMode="numeric"
            autoComplete="off"
            placeholder="ещё не решили"
            className={`${INPUT} tabular-nums`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Срок</span>
          <input
            key={`due-${savedAt}`}
            type="date"
            name="dueOn"
            defaultValue=""
            // No `min`: a shop moving its existing jobs into the app is entering
            // days that have already passed, and the board marks those overdue
            // rather than refusing them.
            className={`${INPUT} tabular-nums`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Заметка — необязательно</span>
        <input
          key={`note-${savedAt}`}
          name="note"
          defaultValue=""
          maxLength={MAX_NOTE}
          autoComplete="off"
          placeholder="на визу США, белый фон"
          className={INPUT}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Принимаю…" : "Принять заказ"}
        </Button>
        {state?.error ? (
          <span role="alert" className="font-mono text-[10px] text-safe">
            {state.error}
          </span>
        ) : state?.done ? (
          <span role="status" className="font-mono text-[10px] text-safe-soft">
            {state.done}
          </span>
        ) : null}
      </div>
    </form>
  );
}
