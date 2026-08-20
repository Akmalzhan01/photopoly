import "server-only";

import { db } from "./db";
import { formatDate, parseDate, shopToday } from "../ledger";
import { type Draft, type Order, type Stage, MAX_NOTE } from "../orders";

/**
 * Reading and writing one shop's order book.
 *
 * Every function takes a `userId` and every query filters on it, including the
 * updates and the delete, which match on id *and* owner so a guessed id touches
 * nothing. Same rule as the cash book, for the same reason: a shop's customer
 * list belongs to that shop and to nobody else, us included.
 */

/** The stages that are actual work in hand. */
const LIVE: Stage[] = ["NEW", "EDITING", "PRINTING", "READY"];

/**
 * How long a handed-over order stays on the board.
 *
 * Without a window the «Выдан» column grows forever and the board stops being a
 * picture of today's work. Two weeks is long enough that a customer coming back
 * about last week's prints is still one glance away; older ones are on the
 * archive page.
 */
export const DONE_WINDOW_DAYS = 14;

/** Ceilings, so one very busy shop cannot render a page of ten thousand cards. */
export const BOARD_LIMIT = 400;
export const ARCHIVE_LIMIT = 200;

const FIELDS = {
  id: true,
  number: true,
  clientName: true,
  phone: true,
  service: true,
  qty: true,
  priceSom: true,
  note: true,
  dueOn: true,
  stage: true,
  ledgerEntryId: true,
} as const;

type Row = {
  id: string;
  number: number;
  clientName: string;
  phone: string | null;
  service: string;
  qty: number;
  priceSom: number;
  note: string | null;
  dueOn: Date | null;
  stage: string;
  ledgerEntryId: string | null;
};

/**
 * The database row as the browser gets it: the due date already a plain
 * `YYYY-MM-DD`, and the cash-book link reduced to a boolean so no id from
 * another table is ever handed out.
 */
function toOrder(row: Row): Order {
  return {
    id: row.id,
    number: row.number,
    clientName: row.clientName,
    phone: row.phone,
    service: row.service,
    qty: row.qty,
    priceSom: row.priceSom,
    note: row.note,
    dueOn: row.dueOn ? formatDate(row.dueOn) : null,
    stage: row.stage as Stage,
    inLedger: row.ledgerEntryId !== null,
  };
}

/**
 * Everything the board shows.
 *
 * Two queries rather than one `OR`, because the two halves want opposite
 * orderings: live work reads soonest-due first, which is the order it should be
 * picked up in, while handed-over work reads most-recent first, which is the
 * order somebody comes back to ask about it in.
 */
export async function listBoard(userId: string): Promise<Order[]> {
  const cutoff = new Date(Date.now() - DONE_WINDOW_DAYS * 86_400_000);

  const [live, done] = await Promise.all([
    db.order.findMany({
      where: { userId, stage: { in: LIVE } },
      // Undated jobs last: a promised day outranks "when it's ready".
      orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: BOARD_LIMIT,
      select: FIELDS,
    }),
    db.order.findMany({
      where: { userId, stage: "DONE", updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: "desc" },
      take: BOARD_LIMIT,
      select: FIELDS,
    }),
  ]);

  return [...live, ...done].map(toOrder);
}

export type Archive = { done: Order[]; cancelled: Order[] };

export async function listArchive(userId: string): Promise<Archive> {
  const [done, cancelled] = await Promise.all([
    db.order.findMany({
      where: { userId, stage: "DONE" },
      orderBy: { updatedAt: "desc" },
      take: ARCHIVE_LIMIT,
      select: FIELDS,
    }),
    db.order.findMany({
      where: { userId, stage: "CANCELLED" },
      orderBy: { updatedAt: "desc" },
      take: ARCHIVE_LIMIT,
      select: FIELDS,
    }),
  ]);

  return { done: done.map(toOrder), cancelled: cancelled.map(toOrder) };
}

/** Postgres refused a write because a unique index already holds that value. */
function isDuplicate(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function nextNumber(userId: string): Promise<number> {
  const top = await db.order.findFirst({
    where: { userId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (top?.number ?? 0) + 1;
}

export type Created = { ok: true; number: number } | { ok: false; error: string };

/**
 * Takes an order in and gives it the shop's next number.
 *
 * Read-then-insert with a retry, and deliberately no transaction around it: at
 * READ COMMITTED — which is what Postgres gives by default — two orders taken
 * in the same second would both read the same maximum inside a transaction just
 * as they do outside one. The `@@unique([userId, number])` index is the thing
 * that actually prevents a shared number; wrapping the pair would buy nothing
 * but an extra round trip and a pinned pooler connection. So the index refuses
 * the loser and the loop simply asks again.
 */
export async function createOrder(userId: string, draft: Draft): Promise<Created> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await db.order.create({
        data: { ...draft, userId, number: await nextNumber(userId) },
        select: { number: true },
      });
      return { ok: true, number: order.number };
    } catch (error) {
      if (isDuplicate(error)) continue;
      throw error;
    }
  }
  return { ok: false, error: "Не удалось присвоить номер. Попробуйте ещё раз." };
}

/** Answers whether anything moved, which is false for someone else's order. */
export async function moveOrder(userId: string, id: string, stage: Stage): Promise<boolean> {
  const { count } = await db.order.updateMany({ where: { id, userId }, data: { stage } });
  return count > 0;
}

export async function removeOrder(userId: string, id: string): Promise<boolean> {
  const { count } = await db.order.deleteMany({ where: { id, userId } });
  return count > 0;
}

export type LedgerResult = { ok: true; amount: number } | { ok: false; error: string };

/** Thrown only to roll the transaction below back; never escapes this module. */
class AlreadyBanked extends Error {}

/**
 * Writes a finished order into the cash book as one income line.
 *
 * The guard against banking the same order twice is the conditional update —
 * `ledgerEntryId: null` — so a double click or a retried request finds nothing
 * to claim rather than adding a second income. The read beforehand only exists
 * to say *why* nothing happened.
 *
 * Unlike `activatePayment`, which claims first and then does its work, the
 * claim here cannot come first: the order points at the entry, so the entry has
 * to exist before the foreign key will accept the link. That leaves a moment
 * where a line exists that no order owns, and a line in someone's books that
 * nothing explains is worse than no line at all — hence the transaction. Losing
 * the race rolls the entry back with it.
 */
export async function writeToLedger(userId: string, id: string): Promise<LedgerResult> {
  const order = await db.order.findFirst({
    where: { id, userId },
    select: { number: true, clientName: true, service: true, priceSom: true, ledgerEntryId: true },
  });

  if (!order) return { ok: false, error: "Заказ не найден." };
  if (order.ledgerEntryId) return { ok: false, error: "Этот заказ уже в кассе." };
  if (order.priceSom <= 0) return { ok: false, error: "У заказа не указана цена." };

  const note = `Заказ №${order.number} · ${order.clientName}`.slice(0, MAX_NOTE);
  // Today, not the day the order was taken: the till records when the money
  // actually moved, which is the moment it was handed over and paid for.
  const occurredAt = parseDate(shopToday());
  if (!occurredAt) return { ok: false, error: "Не удалось определить дату." };

  try {
    await db.$transaction(async (tx) => {
      const entry = await tx.ledgerEntry.create({
        data: {
          userId,
          kind: "INCOME",
          amountSom: order.priceSom,
          category: order.service,
          note,
          occurredAt,
        },
        select: { id: true },
      });

      const { count } = await tx.order.updateMany({
        where: { id, userId, ledgerEntryId: null },
        data: { ledgerEntryId: entry.id },
      });
      if (count === 0) throw new AlreadyBanked();
    });
  } catch (error) {
    if (error instanceof AlreadyBanked) return { ok: false, error: "Этот заказ уже в кассе." };
    throw error;
  }

  return { ok: true, amount: order.priceSom };
}

/**
 * Takes the order back out of the cash book by deleting the line it wrote.
 *
 * Deleting rather than unlinking, because a line nobody can trace back to an
 * order is worse than no line: `onDelete: SetNull` clears the order's side, so
 * it becomes writable again. This is the same delete the till itself offers.
 */
export async function undoLedger(userId: string, id: string): Promise<boolean> {
  const order = await db.order.findFirst({
    where: { id, userId },
    select: { ledgerEntryId: true },
  });
  if (!order?.ledgerEntryId) return false;

  const { count } = await db.ledgerEntry.deleteMany({
    where: { id: order.ledgerEntryId, userId },
  });
  return count > 0;
}

