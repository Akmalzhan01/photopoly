"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/server/dal";
import {
  createOrder,
  moveOrder,
  removeOrder,
  undoLedger,
  writeToLedger,
} from "@/lib/server/orders";
import { isStage, parseOrder, STAGES } from "@/lib/orders";
import { formatSom } from "@/lib/money";

/**
 * The ways a shop changes its own order book.
 *
 * All of them start by asking who is calling and then work only against that
 * account. Nothing takes an owner from the client: the id of an order is the
 * only thing that crosses, and every query pairs it with the session's user, so
 * a crafted POST against a guessed id finds nothing. These are reachable as
 * plain POST endpoints, not only through the board, which is exactly why the
 * check is here rather than in the page that renders the buttons.
 */

const SIGNED_OUT = "Сессия истекла. Войдите заново.";
const MISSING = "Заказ не найден.";

/** What a card's buttons get back. `done` is shown next to the board, briefly. */
export type Ack = { error?: string; done?: string };

/** The board and everything derived from it. */
function refreshBoard() {
  revalidatePath("/zakazlar", "layout");
}

/**
 * `savedAt` is a token, not a time anyone reads: the form uses it as a React key
 * so a saved order leaves empty inputs behind for the next customer.
 */
export type OrderState = { error?: string; done?: string; savedAt?: number } | undefined;

export async function addOrder(_state: OrderState, formData: FormData): Promise<OrderState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const parsed = parseOrder({
    clientName: formData.get("clientName"),
    phone: formData.get("phone"),
    service: formData.get("service"),
    qty: formData.get("qty"),
    price: formData.get("price"),
    note: formData.get("note"),
    dueOn: formData.get("dueOn"),
  });
  if (!parsed.ok) return { error: parsed.error };

  const created = await createOrder(user.id, parsed.draft);
  if (!created.ok) return { error: created.error };

  refreshBoard();
  return { done: `Заказ №${created.number} принят.`, savedAt: Date.now() };
}

export async function setOrderStage(id: unknown, stage: unknown): Promise<Ack> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (typeof id !== "string" || !id) return { error: MISSING };
  if (!isStage(stage)) return { error: "Неизвестный этап." };

  if (!(await moveOrder(user.id, id, stage))) return { error: MISSING };

  refreshBoard();
  return { done: `Перенесён в «${STAGES[stage].label}».` };
}

export async function deleteOrder(id: unknown): Promise<Ack> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (typeof id !== "string" || !id) return { error: MISSING };

  // The same answer whether the order belongs to someone else or never existed.
  if (!(await removeOrder(user.id, id))) return { error: MISSING };

  refreshBoard();
  return { done: "Заказ удалён." };
}

export async function bankOrder(id: unknown): Promise<Ack> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (typeof id !== "string" || !id) return { error: MISSING };

  const result = await writeToLedger(user.id, id);
  if (!result.ok) return { error: result.error };

  refreshBoard();
  // The till's own totals changed too, and they are counted on every one of its tabs.
  revalidatePath("/kassa", "layout");
  return { done: `${formatSom(result.amount)} сом записано в кассу.` };
}

export async function unbankOrder(id: unknown): Promise<Ack> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };
  if (typeof id !== "string" || !id) return { error: MISSING };

  if (!(await undoLedger(user.id, id))) return { error: "Записи в кассе нет." };

  refreshBoard();
  revalidatePath("/kassa", "layout");
  return { done: "Запись в кассе удалена." };
}
