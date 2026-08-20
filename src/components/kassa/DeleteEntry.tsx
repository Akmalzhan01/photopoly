"use client";

import { useActionState } from "react";
import { deleteLedgerEntry } from "@/app/actions/ledger";

/**
 * Removing one line. A mistyped amount is the common case, and correcting it by
 * deleting and re-entering is honest bookkeeping for a shop this size — there is
 * no reconciled period here that an edit could quietly contradict.
 */
export function DeleteEntry({ id, summary }: { id: string; summary: string }) {
  const [state, submit, pending] = useActionState(deleteLedgerEntry, undefined);

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (!window.confirm(`Удалить запись «${summary}»?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="entryId" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Удалить запись"
        aria-label={`Удалить запись ${summary}`}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-dust transition-colors hover:text-ember disabled:opacity-40"
      >
        {pending ? "…" : "Удалить"}
      </button>
      {state?.error ? (
        <span role="alert" className="ml-2 font-mono text-[10px] text-ember">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
