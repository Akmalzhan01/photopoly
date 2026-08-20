/**
 * The shop's cash book: what the categories are, what a valid entry looks like,
 * and how a reporting period is worked out.
 *
 * Shared by the browser and the server on purpose — the form and the action
 * that receives it must agree on what is allowed, and the only way to guarantee
 * that is for both to read the same list.
 */

/** Mirrors the `LedgerKind` enum in the schema. */
export type LedgerKind = "INCOME" | "EXPENSE";

export type Category = { code: string; label: string };

/**
 * Fixed lists rather than free text, so a month's takings can actually be added
 * up by category — "бумага" and "Бумага " typed on different days would report
 * as two different costs. The column is plain text, so a shop's own categories
 * can be added later without touching the table.
 */
export const CATEGORIES: Record<LedgerKind, readonly Category[]> = {
  INCOME: [
    { code: "documents", label: "Фото на документы" },
    { code: "printing", label: "Печать фото" },
    { code: "retouch", label: "Ретушь и обработка" },
    { code: "other", label: "Другое" },
  ],
  EXPENSE: [
    { code: "paper", label: "Бумага" },
    { code: "ink", label: "Чернила и картриджи" },
    { code: "equipment", label: "Оборудование и ремонт" },
    { code: "rent", label: "Аренда" },
    { code: "salary", label: "Зарплата" },
    { code: "utilities", label: "Свет и связь" },
    { code: "other", label: "Другое" },
  ],
};

export const KIND_LABEL: Record<LedgerKind, string> = {
  INCOME: "Приход",
  EXPENSE: "Расход",
};

export function isKind(value: unknown): value is LedgerKind {
  return value === "INCOME" || value === "EXPENSE";
}

export function isCategory(kind: LedgerKind, code: unknown): boolean {
  return CATEGORIES[kind].some((category) => category.code === code);
}

/** Falls back to the raw code, so a category retired later still reads sensibly. */
export function categoryLabel(kind: LedgerKind, code: string): string {
  return CATEGORIES[kind].find((category) => category.code === code)?.label ?? code;
}

/**
 * One entry's ceiling. Not a real limit on anyone's takings — it is there so a
 * slipped keyboard cannot write a number that breaks the column, which is a
 * 32-bit integer, or make a month's total meaningless.
 */
export const MAX_AMOUNT = 100_000_000;
export const MAX_NOTE = 200;

/**
 * Reads a whole number the way a person writes one.
 *
 * Forgiving about grouping — "1500", "1 500", "1.500", "1'500" are all the same
 * number to a shopkeeper — but deliberately unforgiving about a separator that
 * is not grouping. A thousands separator is always followed by exactly three
 * digits; "1200,50" is somebody writing a decimal, and simply dropping the
 * comma would file **120 050** som where 1 200 was meant. Som has no subunit in
 * daily use, so there is no reading of that input worth acting on, and a
 * hundredfold error that saves quietly is far worse than one that asks again.
 */
export function wholeNumber(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  // Spaces and apostrophes only ever group. A dot or a comma might be a
  // decimal, so those survive the strip and get their shape checked below.
  const cleaned = String(raw).replace(/[\s  '’]/g, "");
  if (/[.,]/.test(cleaned) && !/^\d{1,3}(?:[.,]\d{3})+$/.test(cleaned)) return null;

  const digits = cleaned.replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;

  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** What someone typed into the amount box: whole som, above zero, in range. */
export function parseAmount(raw: unknown): number | null {
  const value = wholeNumber(raw);
  if (value === null || value <= 0 || value > MAX_AMOUNT) return null;
  return value;
}

/**
 * Where "today" is decided.
 *
 * Fixed to Bishkek rather than read from the server clock, which is UTC. A shop
 * closing at eight in the evening is at 14:00 UTC — with a UTC day boundary the
 * evening's takings would be filed under tomorrow, and every daily report would
 * be wrong for the last six hours of business. The shops using this are in
 * Kyrgyzstan; when that stops being true this becomes a per-account setting.
 */
export const SHOP_TIME_ZONE = "Asia/Bishkek";

const ISO_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today in the shop's own day, as `YYYY-MM-DD`. */
export function shopToday(): string {
  return ISO_DATE.format(new Date());
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `YYYY-MM-DD` to the Date a `@db.Date` column stores — midnight UTC.
 *
 * Round-trips exactly because the column holds no time at all, which is why the
 * whole cash book uses date-only values: no zone can shift a day across a
 * boundary on the way in or out.
 */
export function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects the likes of 2026-02-31, which Date would roll into March.
  return formatDate(date) === value ? date : null;
}

/** The stored Date back to `YYYY-MM-DD`, read in UTC as it was written. */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` to `DD.MM.YYYY`, by rearranging the text.
 *
 * Going through a Date to format it would reintroduce the very time-zone
 * question the date-only column exists to avoid — west of Greenwich the same
 * string would come back a day earlier.
 */
export function humanDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function shift(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export type PeriodId = "today" | "week" | "month" | "prev-month" | "year" | "custom";

export type Period = { id: PeriodId; from: string; to: string; label: string };

export const PERIODS: readonly { id: PeriodId; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "week", label: "7 дней" },
  { id: "month", label: "Этот месяц" },
  { id: "prev-month", label: "Прошлый месяц" },
  { id: "year", label: "Год" },
];

export function isPeriodId(value: unknown): value is PeriodId {
  return PERIODS.some((period) => period.id === value) || value === "custom";
}

/** Resolves a named period against the shop's today. Both ends are inclusive. */
export function periodRange(id: PeriodId, today = shopToday()): Period {
  const [year, month] = today.split("-").map(Number);
  const label = PERIODS.find((period) => period.id === id)?.label ?? "Период";
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  switch (id) {
    case "today":
      return { id, from: today, to: today, label };
    case "week":
      return { id, from: shift(today, -6), to: today, label };
    case "prev-month": {
      const start = shift(monthStart, -1).slice(0, 7) + "-01";
      return { id, from: start, to: shift(monthStart, -1), label };
    }
    case "year":
      return { id, from: `${year}-01-01`, to: today, label };
    case "month":
    default:
      return { id: "month", from: monthStart, to: today, label: "Этот месяц" };
  }
}

/**
 * Whatever arrived in the query string, turned into a range that is safe to
 * query with. A custom range needs both ends and must not run backwards;
 * anything else falls back to the current month.
 */
export function resolvePeriod(
  params: { davr?: string; dan?: string; gacha?: string },
  today = shopToday(),
): Period {
  if (params.davr === "custom" || (!params.davr && (params.dan || params.gacha))) {
    const from = parseDate(params.dan);
    const to = parseDate(params.gacha);
    if (from && to && formatDate(from) <= formatDate(to)) {
      return {
        id: "custom",
        from: formatDate(from),
        to: formatDate(to),
        label: "Свой период",
      };
    }
  }
  return periodRange(isPeriodId(params.davr) ? params.davr : "month", today);
}

/** Days in a range, both ends counted. */
export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}
