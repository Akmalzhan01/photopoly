"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/dal";
import { createPayment } from "@/lib/finik/client";
import { appUrl, getFinikConfig } from "@/lib/finik/config";

export type CheckoutState = { error?: string } | undefined;

/**
 * Starts a purchase.
 *
 * The Payment row is written before Finik is called, so a customer who pays and
 * then closes the tab still has an order we can match the webhook against. With
 * no Finik credentials configured the same row is created as MANUAL and an admin
 * confirms it — the customer-facing flow is identical up to the last step.
 */
export async function startCheckout(
  _state: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await requireUser();

  const planCode = formData.get("plan");
  if (typeof planCode !== "string" || !planCode) return { error: "Тариф не выбран." };

  const plan = await db.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) return { error: "Такого тарифа нет." };

  const config = getFinikConfig();
  const reference = randomUUID();

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      planId: plan.id,
      amountSom: plan.priceSom,
      reference,
      provider: config ? "FINIK" : "MANUAL",
    },
    select: { id: true },
  });

  if (!config) {
    redirect(`/hisob/tolov/${payment.id}`);
  }

  const base = appUrl();
  const result = await createPayment(
    {
      reference,
      amountSom: plan.priceSom,
      name: `photopoly ${plan.name}`,
      description: `${plan.name} — ${plan.days} дней`,
      redirectUrl: `${base}/hisob/tolov/${payment.id}`,
      webhookUrl: `${base}/api/webhooks/finik`,
    },
    config,
  );

  if (!result.ok) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return { error: result.error };
  }

  await db.payment.update({
    where: { id: payment.id },
    data: { paymentUrl: result.paymentUrl },
  });

  redirect(result.paymentUrl);
}
