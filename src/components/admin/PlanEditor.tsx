"use client";

import { useState } from "react";
import { savePlan, togglePlan } from "@/app/actions/admin";
import { ActionForm } from "./ActionForm";

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceSom: number;
  days: number;
  exportLimit: number | null;
  features: string[];
  active: boolean;
  sortOrder: number;
  subscriptions: number;
};

const INPUT =
  "w-full border border-line bg-pit px-2.5 py-1.5 font-mono text-[12px] text-chalk outline-none transition-colors focus:border-safe/50 disabled:opacity-50";

const LABEL = "font-mono text-[10px] uppercase tracking-[0.16em] text-dust";

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function PlanEditor({ plan, readOnly }: { plan: AdminPlan | null; readOnly: boolean }) {
  const isNew = plan === null;
  const [open, setOpen] = useState(isNew ? false : false);

  return (
    <div className="bg-slab">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-baseline gap-3 text-left"
        >
          <span aria-hidden className="font-mono text-[10px] text-dust">
            {open ? "−" : "+"}
          </span>
          <span className="text-[13px] text-chalk">{isNew ? "Добавить тариф" : plan.name}</span>
          {!isNew ? (
            <span className="font-mono text-[10px] text-dust">{plan.code}</span>
          ) : null}
        </button>

        {!isNew ? (
          <>
            <span className="font-mono text-[11px] text-chalk tabular-nums">
              {plan.priceSom} сом
            </span>
            <span className="font-mono text-[10px] text-dust tabular-nums">{plan.days} дн.</span>
            <span className="font-mono text-[10px] text-dust tabular-nums">
              {plan.exportLimit === null ? "без лимита" : `${plan.exportLimit} шт.`}
            </span>
            <span className="hidden font-mono text-[10px] text-dust tabular-nums sm:inline">
              {plan.subscriptions} подп.
            </span>
            {!plan.active ? (
              <span className="border border-line px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-dust">
                Скрыт
              </span>
            ) : null}
            {!readOnly ? (
              <ActionForm action={togglePlan} fields={{ planId: plan.id }}>
                {(pending) => (
                  <button
                    type="submit"
                    disabled={pending}
                    className="border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-dust transition-colors hover:border-line-lit hover:text-chalk disabled:opacity-40"
                  >
                    {plan.active ? "Скрыть" : "Показать"}
                  </button>
                )}
              </ActionForm>
            ) : null}
          </>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-line bg-pit px-4 py-4">
          <ActionForm action={savePlan}>
            {(pending) => (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Cell label="Код (неизменяемый)">
                    <input
                      name="code"
                      defaultValue={plan?.code}
                      readOnly={!isNew}
                      required
                      pattern="[a-z0-9-]{2,32}"
                      placeholder="например: monthly"
                      className={INPUT}
                      title="Только строчные латинские буквы, цифры и дефис"
                    />
                  </Cell>
                  <Cell label="Название">
                    <input name="name" defaultValue={plan?.name} required className={INPUT} />
                  </Cell>
                  <Cell label="Цена (сом)">
                    <input
                      type="number"
                      name="priceSom"
                      defaultValue={plan?.priceSom ?? 0}
                      min={0}
                      required
                      className={INPUT}
                    />
                  </Cell>
                  <Cell label="Срок (дней)">
                    <input
                      type="number"
                      name="days"
                      defaultValue={plan?.days ?? 30}
                      min={1}
                      required
                      className={INPUT}
                    />
                  </Cell>
                  <Cell label="Лимит экспортов (пусто = без лимита)">
                    <input
                      type="number"
                      name="exportLimit"
                      defaultValue={plan?.exportLimit ?? ""}
                      min={0}
                      placeholder="без лимита"
                      className={INPUT}
                    />
                  </Cell>
                  <Cell label="Порядок">
                    <input
                      type="number"
                      name="sortOrder"
                      defaultValue={plan?.sortOrder ?? 0}
                      className={INPUT}
                    />
                  </Cell>
                  <Cell label="Описание">
                    <input name="description" defaultValue={plan?.description ?? ""} className={INPUT} />
                  </Cell>
                  <Cell label="Видимость">
                    <select name="active" defaultValue={plan?.active === false ? "0" : "1"} className={INPUT}>
                      <option value="1">Виден в прайс-листе</option>
                      <option value="0">Скрыт</option>
                    </select>
                  </Cell>
                </div>

                <div className="mt-4">
                  <Cell label="Возможности — каждая с новой строки">
                    <textarea
                      name="features"
                      defaultValue={plan?.features.join("\n")}
                      rows={4}
                      className={`${INPUT} resize-y leading-relaxed`}
                    />
                  </Cell>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={pending || readOnly}
                    className="border border-safe bg-safe/12 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-safe-soft transition-colors hover:bg-safe/20 disabled:opacity-40"
                  >
                    {pending ? "Сохранение…" : isNew ? "Добавить" : "Сохранить"}
                  </button>
                  {!isNew && plan.subscriptions > 0 ? (
                    <span className="font-mono text-[10px] text-dust">
                      На этом тарифе подписок: {plan.subscriptions} — изменение цены
                      их не затронет.
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
