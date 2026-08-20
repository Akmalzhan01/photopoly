import "server-only";

import { db } from "./db";
import {
  formatDate,
  isCategory,
  parseAmount,
  parseDate,
  type LedgerKind,
  MAX_NOTE,
} from "../ledger";

/**
 * Reading and writing one shop's cash book.
 *
 * Every function here takes a `userId` and every query filters on it. That is
 * the only thing keeping one studio's takings away from another's, so it is
 * done in one place rather than left to each page to remember — including the
 * delete, which matches on id *and* owner so a guessed id removes nothing.
 */

export type Totals = { income: number; expense: number; profit: number; count: number };

export type CategoryTotal = { kind: LedgerKind; category: string; total: number };

export type DayTotal = { date: string; income: number; expense: number };

export type Entry = {
  id: string;
  kind: LedgerKind;
  amountSom: number;
  category: string;
  note: string | null;
  occurredAt: string;
};

/** How many rows a single period view will list. */
export const PAGE_SIZE = 200;

type Range = { from: string; to: string };

function windowFor({ from, to }: Range) {
  return {
    // Both ends inclusive: a shop asking for "1st to 31st" means the 31st too.
    gte: new Date(`${from}T00:00:00.000Z`),
    lte: new Date(`${to}T00:00:00.000Z`),
  };
}

/** Narrows a query to one direction; omitted, both are counted. */
function kindFilter(kind?: LedgerKind) {
  return kind ? { kind } : {};
}

export async function getTotals(userId: string, range: Range): Promise<Totals> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["kind"],
    where: { userId, occurredAt: windowFor(range) },
    _sum: { amountSom: true },
    _count: { _all: true },
  });

  const income = rows.find((row) => row.kind === "INCOME");
  const expense = rows.find((row) => row.kind === "EXPENSE");
  const earned = income?._sum.amountSom ?? 0;
  const spent = expense?._sum.amountSom ?? 0;

  return {
    income: earned,
    expense: spent,
    profit: earned - spent,
    count: (income?._count._all ?? 0) + (expense?._count._all ?? 0),
  };
}

export async function getByCategory(userId: string, range: Range): Promise<CategoryTotal[]> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["kind", "category"],
    where: { userId, occurredAt: windowFor(range) },
    _sum: { amountSom: true },
  });

  return rows
    .map((row) => ({
      kind: row.kind as LedgerKind,
      category: row.category,
      total: row._sum.amountSom ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** One row per day that has any movement; quiet days are simply absent. */
export async function getByDay(userId: string, range: Range): Promise<DayTotal[]> {
  const rows = await db.ledgerEntry.groupBy({
    by: ["occurredAt", "kind"],
    where: { userId, occurredAt: windowFor(range) },
    _sum: { amountSom: true },
  });

  const days = new Map<string, DayTotal>();
  for (const row of rows) {
    const date = formatDate(row.occurredAt);
    const day = days.get(date) ?? { date, income: 0, expense: 0 };
    if (row.kind === "INCOME") day.income += row._sum.amountSom ?? 0;
    else day.expense += row._sum.amountSom ?? 0;
    days.set(date, day);
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function listEntries(
  userId: string,
  range: Range,
  options: { kind?: LedgerKind; take?: number } = {},
): Promise<Entry[]> {
  const rows = await db.ledgerEntry.findMany({
    where: { userId, occurredAt: windowFor(range), ...kindFilter(options.kind) },
    // Newest day first, and within a day the most recently entered — which is
    // the order someone checking their own work expects to read.
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(options.take ?? PAGE_SIZE, PAGE_SIZE),
    select: {
      id: true,
      kind: true,
      amountSom: true,
      category: true,
      note: true,
      occurredAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    kind: row.kind as LedgerKind,
    occurredAt: formatDate(row.occurredAt),
  }));
}

export type CreateInput = {
  kind: LedgerKind;
  amount: unknown;
  category: unknown;
  note: unknown;
  occurredAt: unknown;
};

export type CreateResult = { ok: true } | { ok: false; error: string };

/**
 * Adds one entry, re-checking everything the form already checked.
 *
 * A server action is a public endpoint — the form's `required` and `<select>`
 * are a convenience for the person typing, not a constraint on what arrives.
 */
export async function createEntry(userId: string, input: CreateInput): Promise<CreateResult> {
  const amount = parseAmount(input.amount);
  if (amount === null) return { ok: false, error: "Введите сумму — целое число сомов." };

  if (typeof input.category !== "string" || !isCategory(input.kind, input.category)) {
    return { ok: false, error: "Выберите категорию." };
  }

  const occurredAt = parseDate(input.occurredAt);
  if (!occurredAt) return { ok: false, error: "Выберите дату." };

  const note =
    typeof input.note === "string" && input.note.trim()
      ? input.note.trim().slice(0, MAX_NOTE)
      : null;

  await db.ledgerEntry.create({
    data: { userId, kind: input.kind, amountSom: amount, category: input.category, note, occurredAt },
  });

  return { ok: true };
}

/** Answers whether anything was actually removed, which is false for someone else's row. */
export async function removeEntry(userId: string, id: string): Promise<boolean> {
  const { count } = await db.ledgerEntry.deleteMany({ where: { id, userId } });
  return count > 0;
}
