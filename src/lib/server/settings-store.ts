import "server-only";

import { cache } from "react";
import { db } from "./db";

/**
 * Runtime knobs an admin can change from the panel. Kept deliberately small —
 * anything that needs a code change should live in code, not in a text column.
 */
export const SETTING_KEYS = {
  freeExports: "free_exports",
  paymentNote: "payment_note",
} as const;

export const DEFAULTS = {
  /** Exports a new account gets before it has to pay for anything. */
  freeExports: 3,
  /**
   * How to pay while orders are confirmed by hand.
   *
   * Empty by default and deliberately so: an invented account number would be
   * worse than none. Until an admin fills it in, the purchase page says to
   * contact the administrator instead of pretending there is a way to pay.
   */
  paymentNote: "",
} as const;

export const MAX_PAYMENT_NOTE = 600;

export const getFreeExportLimit = cache(async (): Promise<number> => {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEYS.freeExports } });
  if (!row) return DEFAULTS.freeExports;
  const parsed = Number.parseInt(row.value, 10);
  // A hand-edited row must never be able to hand out unlimited exports.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULTS.freeExports;
  return parsed;
});

export async function setFreeExportLimit(value: number): Promise<void> {
  const safe = Math.max(0, Math.min(1000, Math.round(value)));
  await db.setting.upsert({
    where: { key: SETTING_KEYS.freeExports },
    create: { key: SETTING_KEYS.freeExports, value: String(safe) },
    update: { value: String(safe) },
  });
}

export const getPaymentNote = cache(async (): Promise<string> => {
  const row = await db.setting.findUnique({ where: { key: SETTING_KEYS.paymentNote } });
  return row?.value.trim() ?? DEFAULTS.paymentNote;
});

export async function setPaymentNote(value: string): Promise<void> {
  const safe = value.trim().slice(0, MAX_PAYMENT_NOTE);
  await db.setting.upsert({
    where: { key: SETTING_KEYS.paymentNote },
    create: { key: SETTING_KEYS.paymentNote, value: safe },
    update: { value: safe },
  });
}
