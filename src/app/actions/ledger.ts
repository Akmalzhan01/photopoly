"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/server/dal";
import { createEntry, removeEntry } from "@/lib/server/ledger";
import { isKind } from "@/lib/ledger";

/**
 * The two ways a shop changes its own cash book.
 *
 * Both start by asking who is calling and then work only against that account.
 * Nothing here takes a user id from the form: the owner of an entry is always
 * whoever is signed in, so a crafted post cannot write into someone else's book
 * or delete out of it. Deliberately no audit log either — this is the shop's
 * private ledger, not an administrative action on our side.
 */

/**
 * `savedAt` is a token, not a time anyone reads: the form uses it as a React
 * key so a successful save remounts the amount and note inputs empty. Clearing
 * them from an effect instead would mean a second render for every save, which
 * is exactly what effects are not for.
 */
export type LedgerState = { error?: string; done?: string; savedAt?: number } | undefined;

const SIGNED_OUT = "Сессия истекла. Войдите заново.";

export async function addLedgerEntry(
  _state: LedgerState,
  formData: FormData,
): Promise<LedgerState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const kind = formData.get("kind");
  if (!isKind(kind)) return { error: "Выберите приход или расход." };

  const result = await createEntry(user.id, {
    kind,
    amount: formData.get("amount"),
    category: formData.get("category"),
    note: formData.get("note"),
    occurredAt: formData.get("occurredAt"),
  });

  if (!result.ok) return { error: result.error };

  // "layout" so the whole section refreshes: a new line changes the totals on
  // every tab, not just the one it was typed on.
  revalidatePath("/kassa", "layout");
  return {
    done: kind === "INCOME" ? "Приход записан." : "Расход записан.",
    savedAt: Date.now(),
  };
}

export async function deleteLedgerEntry(
  _state: LedgerState,
  formData: FormData,
): Promise<LedgerState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const id = String(formData.get("entryId") ?? "");
  if (!id) return { error: "Запись не найдена." };

  // The same answer whether the row belongs to someone else or never existed:
  // a probe learns nothing about another shop's book either way.
  if (!(await removeEntry(user.id, id))) return { error: "Запись не найдена." };

  // "layout" so the whole section refreshes: a new line changes the totals on
  // every tab, not just the one it was typed on.
  revalidatePath("/kassa", "layout");
  return { done: "Запись удалена." };
}
