"use client";

import { useActionState } from "react";
import { startCheckout, type CheckoutState } from "@/app/actions/checkout";
import { Button } from "./ui";

export function BuyForm({
  planCode,
  label,
  featured,
}: {
  planCode: string;
  label: string;
  featured: boolean;
}) {
  const [state, submit, pending] = useActionState<CheckoutState, FormData>(
    startCheckout,
    undefined,
  );

  return (
    <form action={submit} className="mt-auto flex flex-col gap-2 pt-6">
      <input type="hidden" name="plan" value={planCode} />
      <Button type="submit" tone={featured ? "primary" : "ghost"} disabled={pending}>
        {pending ? "Открываем…" : label}
      </Button>
      {state?.error ? (
        <p role="alert" className="font-mono text-[10px] leading-relaxed text-ember">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
