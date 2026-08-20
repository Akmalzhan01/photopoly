/**
 * Client orders: the stages a job moves through, what a valid order looks like,
 * and how a due date reads to the person at the counter.
 *
 * Shared by the browser and the server on purpose — the board, the form and the
 * actions behind them must agree on which stages exist and what may be written,
 * and the only way to guarantee that is for all three to read the same file.
 */

import {
  CATEGORIES,
  categoryLabel,
  daysBetween,
  MAX_NOTE,
  parseDate,
  wholeNumber,
} from "./ledger";

/** Mirrors the `OrderStage` enum in the schema. */
export type Stage = "NEW" | "EDITING" | "PRINTING" | "READY" | "DONE" | "CANCELLED";

/**
 * The board, left to right. `CANCELLED` is deliberately absent: a dead order
 * should not occupy a column beside live work, so it drops off the board and
 * turns up on the archive page instead.
 */
export const BOARD = ["NEW", "EDITING", "PRINTING", "READY", "DONE"] as const;

export type BoardStage = (typeof BOARD)[number];

export const STAGES: Record<Stage, { label: string; hint: string }> = {
  NEW: { label: "Новый", hint: "Приняли заказ" },
  EDITING: { label: "Обработка", hint: "Ретушь и подготовка" },
  PRINTING: { label: "Печать", hint: "Ушло на принтер" },
  READY: { label: "Готов", hint: "Можно забирать" },
  DONE: { label: "Выдан", hint: "Отдали клиенту" },
  CANCELLED: { label: "Отменён", hint: "Клиент отказался" },
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && value in STAGES;
}

export function isBoardStage(value: unknown): value is BoardStage {
  return BOARD.includes(value as BoardStage);
}

/** True once the job is off the shop's hands, either way it ended. */
export function isClosed(stage: Stage): boolean {
  return stage === "DONE" || stage === "CANCELLED";
}

/**
 * What was sold, using the cash book's own income categories.
 *
 * Not a second list that happens to look similar: an order written to the till
 * has to land in a category the reports already add up, and two lists would
 * drift apart the first time either was edited.
 */
export const SERVICES = CATEGORIES.INCOME;

export function serviceLabel(code: string): string {
  return categoryLabel("INCOME", code);
}

export function isService(code: unknown): boolean {
  return SERVICES.some((service) => service.code === code);
}

export const MAX_NAME = 80;
export const MAX_PHONE = 24;
export const MAX_QTY = 999;
/** Same ceiling as one cash-book line — an order becomes one when it is paid. */
export const MAX_PRICE = 100_000_000;

/** Re-exported so the form's `maxLength` and the server's clamp cannot diverge. */
export { MAX_NOTE };

/**
 * The shape the browser is given. Deliberately not the database row: `dueOn` is
 * already a plain `YYYY-MM-DD`, and the cash-book link is reduced to a boolean
 * so a client never learns another table's ids.
 */
export type Order = {
  id: string;
  number: number;
  clientName: string;
  phone: string | null;
  service: string;
  qty: number;
  priceSom: number;
  note: string | null;
  dueOn: string | null;
  stage: Stage;
  inLedger: boolean;
};

export type Draft = {
  clientName: string;
  phone: string | null;
  service: string;
  qty: number;
  priceSom: number;
  note: string | null;
  dueOn: Date | null;
};

export type Parsed = { ok: true; draft: Draft } | { ok: false; error: string };

/**
 * Digits and the punctuation people actually type into a phone box.
 *
 * Not validated against a Kyrgyz numbering plan: the number is here to be read
 * back and dialled, and rejecting a landline written with a different prefix
 * would only teach the shop to leave the field empty.
 */
const PHONE_ALLOWED = /^[\d+\-()\s]+$/;

/**
 * A whole number that may be left blank, in which case the fallback stands.
 *
 * Shares the cash book's reader, so "1200,50" is refused here for the same
 * reason it is refused there — an order that quietly became 120 050 som would
 * carry that number straight into the till the moment it was banked.
 */
function parseCount(raw: unknown, fallback: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = wholeNumber(raw);
  if (value === null || value < 0 || value > max) return null;
  return value;
}

/**
 * Everything an order form can send, checked once for both the form and the
 * action behind it.
 *
 * A server action is a public endpoint: the `required` attributes and the
 * `<select>` are a convenience for whoever is typing, not a constraint on what
 * arrives, so all of it is re-read here.
 */
export function parseOrder(input: {
  clientName: unknown;
  phone: unknown;
  service: unknown;
  qty: unknown;
  price: unknown;
  note: unknown;
  dueOn: unknown;
}): Parsed {
  const clientName = typeof input.clientName === "string" ? input.clientName.trim() : "";
  if (!clientName) return { ok: false, error: "Впишите имя клиента." };
  if (clientName.length > MAX_NAME) {
    return { ok: false, error: `Имя длиннее ${MAX_NAME} символов.` };
  }

  const rawPhone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (rawPhone && (!PHONE_ALLOWED.test(rawPhone) || rawPhone.length > MAX_PHONE)) {
    return { ok: false, error: "Телефон — только цифры, пробелы и + ( ) −." };
  }

  if (!isService(input.service)) return { ok: false, error: "Выберите услугу." };

  // Zero prints is not an order; zero som is, and means "цена ещё не решена".
  const qty = parseCount(input.qty, 1, MAX_QTY);
  if (qty === null || qty < 1) return { ok: false, error: `Количество — от 1 до ${MAX_QTY}.` };

  const priceSom = parseCount(input.price, 0, MAX_PRICE);
  if (priceSom === null) return { ok: false, error: "Цена — целое число сомов." };

  // Absent is fine: plenty of jobs are picked up "when it's ready".
  const dueOn = input.dueOn === "" || input.dueOn === undefined || input.dueOn === null
    ? null
    : parseDate(input.dueOn);
  if (dueOn === null && input.dueOn) return { ok: false, error: "Не разобрал срок." };

  const note =
    typeof input.note === "string" && input.note.trim()
      ? input.note.trim().slice(0, MAX_NOTE)
      : null;

  return {
    ok: true,
    draft: {
      clientName,
      phone: rawPhone || null,
      service: input.service as string,
      qty,
      priceSom,
      note,
      dueOn,
    },
  };
}

/** Promised for a day already gone, and still not off the shop's hands. */
export function isOverdue(order: Order, today: string): boolean {
  return order.dueOn !== null && order.dueOn < today && !isClosed(order.stage);
}

export type Summary = {
  open: number;
  overdue: number;
  /** Som agreed on work not yet handed over. */
  pipeline: number;
  /** Handed over, worth something, and never written to the till. */
  unbanked: number;
};

/**
 * The numbers above the board.
 *
 * Worked out from the same list the columns are drawn from rather than queried
 * separately, so that dragging a card moves the totals with it — a header that
 * still said "12 в работе" after you had just finished one would be the first
 * thing anybody stopped trusting.
 */
export function summarise(orders: Order[], today: string): Summary {
  let open = 0;
  let overdue = 0;
  let pipeline = 0;
  let unbanked = 0;

  for (const order of orders) {
    if (!isClosed(order.stage)) {
      open++;
      pipeline += order.priceSom;
      if (isOverdue(order, today)) overdue++;
    } else if (order.stage === "DONE" && !order.inLedger && order.priceSom > 0) {
      unbanked++;
    }
  }

  return { open, overdue, pipeline, unbanked };
}

/** What an order is, in one line — used in confirmations and the archive. */
export function describe(order: Order): string {
  return `№${order.number} · ${order.clientName} · ${serviceLabel(order.service)}`;
}

/**
 * The due date as somebody at the counter would say it.
 *
 * Named days rather than dates for the near ones — "завтра" is what the shop
 * actually thinks, and reading 13.08.2026 to work that out is a step nobody
 * should have to take while a customer is waiting.
 */
export function dueLabel(dueOn: string, today: string): string {
  if (dueOn === today) return "сегодня";
  if (dueOn > today) {
    const days = daysBetween(today, dueOn) - 1;
    if (days === 1) return "завтра";
    if (days === 2) return "послезавтра";
    return `через ${days} дн.`;
  }
  const late = daysBetween(dueOn, today) - 1;
  return late === 1 ? "просрочен на день" : `просрочен на ${late} дн.`;
}
