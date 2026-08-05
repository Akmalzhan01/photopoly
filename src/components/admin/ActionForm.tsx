"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminState } from "@/app/actions/admin";

type Action = (state: AdminState, formData: FormData) => Promise<AdminState>;

/**
 * A form wired to one admin action, showing its own result.
 *
 * Every admin mutation is a form post rather than an onClick fetch, so the
 * panel keeps working with JavaScript still loading and each button carries
 * its own pending and error state instead of one banner for the whole page.
 */
export function ActionForm({
  action,
  fields,
  children,
  className = "",
  confirm,
}: {
  action: Action;
  /** Hidden inputs — the ids the action needs. */
  fields?: Record<string, string>;
  children: ReactNode | ((pending: boolean) => ReactNode);
  className?: string;
  confirm?: string;
}) {
  const [state, submit, pending] = useActionState<AdminState, FormData>(action, undefined);

  return (
    <form
      action={submit}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {typeof children === "function" ? children(pending) : children}

      {state?.error ? (
        <p role="alert" className="mt-1.5 font-mono text-[10px] leading-snug text-ember">
          {state.error}
        </p>
      ) : null}
      {state?.done ? (
        <p role="status" className="mt-1.5 font-mono text-[10px] leading-snug text-safe-soft">
          {state.done}
        </p>
      ) : null}
    </form>
  );
}
