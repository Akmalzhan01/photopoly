"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/server/db";
import { requireAdmin, requireSuperadmin, type CurrentUser } from "@/lib/server/dal";
import { activatePayment } from "@/lib/server/billing";
import { MAX_PAYMENT_NOTE, setFreeExportLimit, setPaymentNote } from "@/lib/server/settings-store";

export type AdminState = { error?: string; done?: string } | undefined;

async function record(
  actor: CurrentUser,
  action: string,
  target: { type: string; id: string },
  meta?: Record<string, unknown>,
) {
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      targetType: target.type,
      targetId: target.id,
      meta: meta as never,
    },
  });
}

function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

// --- Users ---------------------------------------------------------------

export async function setUserBlocked(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const blocked = formData.get("blocked") === "1";

  if (userId === actor.id) {
    return { error: "Себя заблокировать нельзя." };
  }

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { error: "Пользователь не найден." };
  // An ADMIN must not be able to lock out the people above them.
  if (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN") {
    return { error: "Блокировать суперадмина нельзя." };
  }

  await db.user.update({ where: { id: userId }, data: { blocked } });
  if (blocked) {
    // Blocking is pointless while their current session still works.
    await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await record(actor, blocked ? "user.block" : "user.unblock", { type: "user", id: userId });
  refreshAdmin();
  return { done: blocked ? "Заблокирован." : "Блокировка снята." };
}

export async function setUserRole(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireSuperadmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!["USER", "ADMIN", "SUPERADMIN"].includes(role)) return { error: "Неверная роль." };
  if (userId === actor.id) return { error: "Свою роль изменить нельзя." };

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { error: "Пользователь не найден." };

  // Losing the last superadmin means nobody can ever grant the role again.
  if (target.role === "SUPERADMIN" && role !== "SUPERADMIN") {
    const remaining = await db.user.count({ where: { role: "SUPERADMIN", blocked: false } });
    if (remaining <= 1) return { error: "Последнего суперадмина изменить нельзя." };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await record(actor, "user.role", { type: "user", id: userId }, { from: target.role, to: role });
  refreshAdmin();
  return { done: `Роль изменена на ${role}.` };
}

export async function resetFreeQuota(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  await db.user.update({ where: { id: userId }, data: { freeUsed: 0 } });
  await record(actor, "user.resetFree", { type: "user", id: userId });
  refreshAdmin();
  return { done: "Бесплатный лимит сброшен." };
}

// --- Subscriptions -------------------------------------------------------

export async function grantSubscription(
  _state: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const planCode = String(formData.get("plan") ?? "");

  const [user, plan] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true } }),
    db.plan.findUnique({ where: { code: planCode } }),
  ]);
  if (!user) return { error: "Пользователь не найден." };
  if (!plan) return { error: "Тариф не найден." };

  const current = await db.subscription.findFirst({
    where: { userId, status: "ACTIVE", endsAt: { gt: new Date() } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  const startsAt = current?.endsAt ?? new Date();
  const endsAt = new Date(startsAt.getTime() + plan.days * 24 * 60 * 60 * 1000);

  const subscription = await db.subscription.create({
    data: { userId, planId: plan.id, startsAt, endsAt, status: "ACTIVE" },
    select: { id: true },
  });

  await record(
    actor,
    "subscription.grant",
    { type: "subscription", id: subscription.id },
    { userId, plan: plan.code, endsAt: endsAt.toISOString() },
  );
  refreshAdmin();
  return { done: `Выдано: ${plan.name} — до ${endsAt.toLocaleDateString("ru-RU")}.` };
}

export async function cancelSubscription(
  _state: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const actor = await requireAdmin();
  const id = String(formData.get("subscriptionId") ?? "");

  const { count } = await db.subscription.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) return { error: "Активная подписка не найдена." };

  await record(actor, "subscription.cancel", { type: "subscription", id });
  refreshAdmin();
  return { done: "Подписка отменена." };
}

// --- Payments ------------------------------------------------------------

export async function confirmPayment(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireAdmin();
  const id = String(formData.get("paymentId") ?? "");

  const payment = await db.payment.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!payment) return { error: "Платёж не найден." };
  if (payment.status !== "PENDING") return { error: "Этот платёж уже завершён." };

  const result = await activatePayment(id, { raw: { confirmedBy: actor.email } });
  if (!result.activated) return { error: "Не удалось активировать платёж." };

  await record(actor, "payment.confirm", { type: "payment", id });
  refreshAdmin();
  return { done: "Платёж подтверждён, подписка включена." };
}

export async function cancelPayment(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireAdmin();
  const id = String(formData.get("paymentId") ?? "");

  const { count } = await db.payment.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count === 0) return { error: "Платёж в ожидании не найден." };

  await record(actor, "payment.cancel", { type: "payment", id });
  refreshAdmin();
  return { done: "Платёж отменён." };
}

// --- Plans ---------------------------------------------------------------

function planNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function savePlan(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireSuperadmin();

  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[a-z0-9-]{2,32}$/.test(code)) {
    return { error: "Код может содержать только латинские буквы, цифры и дефис." };
  }
  if (!name) return { error: "Введите название." };

  const priceSom = planNumber(formData.get("priceSom"), -1);
  const days = planNumber(formData.get("days"), -1);
  if (priceSom < 0) return { error: "Цена не может быть отрицательной." };
  if (days < 1) return { error: "Срок — минимум 1 день." };

  const limitRaw = String(formData.get("exportLimit") ?? "").trim();
  // Empty means unlimited, which is a different thing from zero.
  const exportLimit = limitRaw === "" ? null : Math.max(0, planNumber(limitRaw, 0));

  const features = String(formData.get("features") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  const data = {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    priceSom,
    days,
    exportLimit,
    features,
    active: formData.get("active") === "1",
    sortOrder: planNumber(formData.get("sortOrder"), 0),
  };

  const plan = await db.plan.upsert({
    where: { code },
    create: { code, ...data },
    update: data,
    select: { id: true },
  });

  await record(actor, "plan.save", { type: "plan", id: plan.id }, { code, ...data });
  revalidatePath("/admin/tariflar");
  revalidatePath("/narxlar");
  revalidatePath("/");
  return { done: `${name} сохранён.` };
}

export async function togglePlan(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireSuperadmin();
  const id = String(formData.get("planId") ?? "");

  const plan = await db.plan.findUnique({ where: { id }, select: { active: true, name: true } });
  if (!plan) return { error: "Тариф не найден." };

  await db.plan.update({ where: { id }, data: { active: !plan.active } });
  await record(actor, "plan.toggle", { type: "plan", id }, { active: !plan.active });
  revalidatePath("/admin/tariflar");
  revalidatePath("/narxlar");
  revalidatePath("/");
  return { done: `${plan.name} ${plan.active ? "скрыт" : "показан"}.` };
}

// --- Settings ------------------------------------------------------------

export async function saveFreeLimit(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireSuperadmin();
  const value = planNumber(formData.get("freeExports"), -1);
  if (value < 0) return { error: "Отрицательное число недопустимо." };

  await setFreeExportLimit(value);
  await record(actor, "settings.freeExports", { type: "setting", id: "free_exports" }, { value });
  revalidatePath("/", "layout");
  return { done: `Число бесплатных экспортов: ${value}.` };
}

/**
 * The instruction a customer sees while orders are confirmed by hand.
 *
 * It lives in the database rather than an environment variable so it can be
 * corrected without a redeploy — a wrong account number on the one page that
 * asks for money should be fixable in seconds.
 */
export async function savePaymentNote(_state: AdminState, formData: FormData): Promise<AdminState> {
  const actor = await requireSuperadmin();
  const raw = formData.get("paymentNote");
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length > MAX_PAYMENT_NOTE) {
    return { error: `Слишком длинно — максимум ${MAX_PAYMENT_NOTE} символов.` };
  }

  await setPaymentNote(value);
  await record(actor, "settings.paymentNote", { type: "setting", id: "payment_note" });
  revalidatePath("/", "layout");
  return { done: value ? "Инструкция сохранена." : "Инструкция очищена." };
}
