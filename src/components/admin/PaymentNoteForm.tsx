"use client";

import { savePaymentNote } from "@/app/actions/admin";
import { Button } from "@/components/site/ui";
import { ActionForm } from "./ActionForm";

/**
 * What a customer is told to do while orders are confirmed by hand.
 *
 * Only shown when Finik is not configured: with the gateway live the customer
 * pays in it and never needs this, so leaving the field on screen would invite
 * an instruction nobody reads.
 */
export function PaymentNoteForm({ current }: { current: string }) {
  return (
    <div className="border border-line bg-slab p-5">
      <ActionForm action={savePaymentNote} className="flex flex-col gap-3">
        {(pending) => (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
                Как оплатить — текст для покупателя
              </span>
              <textarea
                name="paymentNote"
                defaultValue={current}
                rows={4}
                maxLength={600}
                placeholder="Например: переведите сумму на 0700 000 000 (MBank, О!Деньги) и напишите нам номер заказа."
                aria-label="Инструкция по оплате"
                className="w-full resize-y border border-line bg-pit px-3 py-2 text-sm leading-relaxed text-chalk outline-none transition-colors placeholder:text-dust focus:border-safe/50"
              />
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" tone="ghost" disabled={pending}>
                {pending ? "Сохранение…" : "Сохранить"}
              </Button>
              {!current ? (
                <span className="font-mono text-[10px] text-ember">
                  Пока не заполнено — покупателю негде узнать, куда платить.
                </span>
              ) : null}
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-dust">
              Показывается на странице заказа, пока Finik не подключён. Укажите номер или
              счёт, куда переводить, — покупатель называет номер заказа, вы подтверждаете
              платёж в разделе «Платежи».
            </p>
          </>
        )}
      </ActionForm>
    </div>
  );
}
