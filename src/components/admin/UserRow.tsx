"use client";

import { useState } from "react";
import {
  cancelSubscription,
  grantSubscription,
  resetFreeQuota,
  setUserBlocked,
  setUserRole,
} from "@/app/actions/admin";
import { ActionForm } from "./ActionForm";

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  blocked: boolean;
  freeUsed: number;
  createdAt: string;
  exports: number;
  subscription: { id: string; planName: string; endsAt: string; used: number } | null;
};

const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short" });

const ROLE_LABEL = { USER: "Пользователь", ADMIN: "Админ", SUPERADMIN: "Суперадмин" } as const;

const SMALL_BUTTON =
  "border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-40";

export function UserRow({
  user,
  plans,
  freeLimit,
  isSelf,
  canSetRole,
}: {
  user: AdminUser;
  plans: { code: string; name: string }[];
  freeLimit: number;
  isSelf: boolean;
  canSetRole: boolean;
}) {
  const [open, setOpen] = useState(false);

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
          <span className="truncate text-[13px] text-chalk">{user.name || user.email}</span>
          {user.name ? (
            <span className="hidden truncate font-mono text-[10px] text-dust sm:inline">
              {user.email}
            </span>
          ) : null}
        </button>

        {user.role !== "USER" ? (
          <span className="border border-ember/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ember">
            {ROLE_LABEL[user.role]}
          </span>
        ) : null}
        {user.blocked ? (
          <span className="border border-ember bg-ember/12 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-safe-soft">
            Заблокирован
          </span>
        ) : null}

        <span className="font-mono text-[10px] text-ash tabular-nums">
          {user.subscription
            ? `${user.subscription.planName} · ${date.format(new Date(user.subscription.endsAt))}`
            : `бесплатно ${user.freeUsed}/${freeLimit}`}
        </span>

        <span className="hidden font-mono text-[10px] text-dust tabular-nums md:inline">
          {user.exports} эксп.
        </span>
        <span className="hidden font-mono text-[10px] text-dust tabular-nums lg:inline">
          {date.format(new Date(user.createdAt))}
        </span>
      </div>

      {open ? (
        <div className="grid gap-5 border-t border-line bg-pit px-4 py-4 md:grid-cols-3">
          {/* Grant a subscription by hand — the manual-payment path ends here. */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
              Выдать подписку
            </p>
            <ActionForm action={grantSubscription} fields={{ userId: user.id }}>
              {(pending) => (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    name="plan"
                    aria-label="Выбор тарифа"
                    defaultValue={plans[0]?.code}
                    className="border border-line bg-slab px-2 py-1 font-mono text-[11px] text-chalk outline-none focus:border-safe/50"
                  >
                    {plans.map((plan) => (
                      <option key={plan.code} value={plan.code}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${SMALL_BUTTON} border-safe/60 text-safe-soft hover:bg-safe/12`}
                  >
                    {pending ? "…" : "Выдать"}
                  </button>
                </div>
              )}
            </ActionForm>

            {user.subscription ? (
              <ActionForm
                action={cancelSubscription}
                fields={{ subscriptionId: user.subscription.id }}
                className="mt-2"
                confirm="Отменить активную подписку?"
              >
                {(pending) => (
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${SMALL_BUTTON} border-line text-dust hover:border-ember hover:text-ember`}
                  >
                    Отменить подписку
                  </button>
                )}
              </ActionForm>
            ) : null}
          </div>

          {/* Access */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
              Доступ
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionForm
                action={setUserBlocked}
                fields={{ userId: user.id, blocked: user.blocked ? "0" : "1" }}
                confirm={
                  user.blocked ? undefined : "Заблокировать? Все его сессии тоже закроются."
                }
              >
                {(pending) => (
                  <button
                    type="submit"
                    disabled={pending || isSelf}
                    title={isSelf ? "Себя заблокировать нельзя" : undefined}
                    className={`${SMALL_BUTTON} ${
                      user.blocked
                        ? "border-safe/60 text-safe-soft hover:bg-safe/12"
                        : "border-line text-dust hover:border-ember hover:text-ember"
                    }`}
                  >
                    {user.blocked ? "Разблокировать" : "Заблокировать"}
                  </button>
                )}
              </ActionForm>

              <ActionForm action={resetFreeQuota} fields={{ userId: user.id }}>
                {(pending) => (
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${SMALL_BUTTON} border-line text-dust hover:border-line-lit hover:text-chalk`}
                  >
                    Сбросить бесплатный лимит
                  </button>
                )}
              </ActionForm>
            </div>
          </div>

          {/* Role — superadmin only */}
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-dust">Роль</p>
            {canSetRole ? (
              <ActionForm
                action={setUserRole}
                fields={{ userId: user.id }}
                confirm="Изменить роль?"
              >
                {(pending) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      name="role"
                      aria-label="Выбор роли"
                      defaultValue={user.role}
                      disabled={isSelf}
                      className="border border-line bg-slab px-2 py-1 font-mono text-[11px] text-chalk outline-none focus:border-safe/50 disabled:opacity-40"
                    >
                      {(["USER", "ADMIN", "SUPERADMIN"] as const).map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={pending || isSelf}
                      title={isSelf ? "Свою роль изменить нельзя" : undefined}
                      className={`${SMALL_BUTTON} border-line text-dust hover:border-line-lit hover:text-chalk`}
                    >
                      Сохранить
                    </button>
                  </div>
                )}
              </ActionForm>
            ) : (
              <p className="font-mono text-[10px] text-dust">
                Изменить может только суперадмин.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
