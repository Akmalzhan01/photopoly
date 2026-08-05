"use client";

import { cancelPayment, confirmPayment } from "@/app/actions/admin";
import { ActionForm } from "./ActionForm";

const SMALL =
  "border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-40";

export function PaymentActions({
  paymentId,
  reference,
}: {
  paymentId: string;
  reference: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <ActionForm
        action={confirmPayment}
        fields={{ paymentId }}
        confirm={`Вы проверили, что платёж № ${reference} действительно поступил? После подтверждения подписка включится сразу.`}
      >
        {(pending) => (
          <button
            type="submit"
            disabled={pending}
            className={`${SMALL} border-safe/60 text-safe-soft hover:bg-safe/12`}
          >
            {pending ? "…" : "Подтвердить"}
          </button>
        )}
      </ActionForm>

      <ActionForm action={cancelPayment} fields={{ paymentId }} confirm="Отменить?">
        {(pending) => (
          <button
            type="submit"
            disabled={pending}
            className={`${SMALL} border-line text-dust hover:border-ember hover:text-ember`}
          >
            Отмена
          </button>
        )}
      </ActionForm>
    </div>
  );
}
