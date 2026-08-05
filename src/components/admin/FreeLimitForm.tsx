"use client";

import { saveFreeLimit } from "@/app/actions/admin";
import { Button } from "@/components/site/ui";
import { ActionForm } from "./ActionForm";

export function FreeLimitForm({ current }: { current: number }) {
  return (
    <div className="border border-line bg-slab p-5">
      <ActionForm action={saveFreeLimit} className="flex flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
                Бесплатных экспортов новому аккаунту
              </span>
              <input
                type="number"
                name="freeExports"
                defaultValue={current}
                min={0}
                max={1000}
                aria-label="Число бесплатных экспортов"
                className="w-32 border border-line bg-pit px-3 py-2 font-mono text-sm text-chalk outline-none transition-colors focus:border-safe/50"
              />
            </label>
            <Button type="submit" tone="ghost" disabled={pending}>
              {pending ? "Сохранение…" : "Сохранить"}
            </Button>
            <p className="w-full font-mono text-[10px] leading-relaxed text-dust">
              Если поставить 0, пробный режим отключится полностью, а карточка
              &laquo;Бесплатно&raquo; исчезнет из прайс-листа. Уже израсходованные
              лимиты это не вернёт.
            </p>
          </>
        )}
      </ActionForm>
    </div>
  );
}
