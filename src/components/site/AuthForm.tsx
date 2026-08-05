"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "@/app/actions/auth";
import { Button, Field } from "./ui";
import { MIN_PASSWORD } from "@/lib/validate";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const action = mode === "login" ? login : signup;
  const [state, submit, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <form action={submit} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="keyin" value={next} /> : null}

      {mode === "signup" ? (
        <Field
          label="Имя"
          name="name"
          autoComplete="name"
          placeholder="Необязательно"
          maxLength={80}
          error={state?.field === "name" ? state.error : undefined}
        />
      ) : null}

      <Field
        label="Электронная почта"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="siz@example.com"
        error={state?.field === "email" ? state.error : undefined}
      />

      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        required
        minLength={mode === "signup" ? MIN_PASSWORD : undefined}
        hint={mode === "signup" ? `Минимум ${MIN_PASSWORD} символов` : undefined}
        error={state?.field === "password" ? state.error : undefined}
      />

      {/* Errors that belong to no single field — wrong credentials, blocked account. */}
      {state?.error && !state.field ? (
        <p role="alert" className="border border-ember/50 bg-ember/8 px-3 py-2 font-mono text-[11px] text-safe-soft">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
      </Button>

      <p className="text-center font-mono text-[11px] text-dust">
        {mode === "login" ? (
          <>
            Нет аккаунта?{" "}
            <Link href="/royxat" className="text-ash underline underline-offset-4 hover:text-safe">
              Зарегистрируйтесь
            </Link>
          </>
        ) : (
          <>
            Уже есть аккаунт?{" "}
            <Link href="/kirish" className="text-ash underline underline-offset-4 hover:text-safe">
              Войдите
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
