"use client";

import { useCallback, useEffect, useState } from "react";
import { settleOfflineExports, spendExport, viewEntitlement } from "@/app/actions/usage";
import type { EntitlementView } from "./entitlement-view";
import {
  readPending,
  readQuota,
  spendLocally,
  usableOffline,
  writePending,
  writeQuota,
} from "./offline-quota";

/**
 * The export allowance, for every page that can produce a file.
 *
 * Lifted out of the editor when the quality service arrived. Two pages that
 * each spend exports must agree on what spending one means — above all on the
 * offline path, where the browser is allowed to go ahead against an allowance
 * the server already granted and settle up on reconnection. A second copy of
 * that reasoning is how an account ends up charged twice, or not at all.
 */
export type Exports = {
  /** `null` until it has been learned; see `allowed`. */
  entitlement: EntitlementView | null;
  allowed: boolean;
  /** The allowance ran out and the person has not dismissed the notice yet. */
  blocked: boolean;
  dismiss: () => void;
  /** Books one export. False means do not write the file. */
  claim: () => Promise<boolean>;
  /**
   * Nobody is signed in. The tools are open to visitors, who may save a
   * reduced copy without spending anything; the full size needs an account.
   */
  guest: boolean;
  /** Something the caller should show in its own error line. */
  problem: string | null;
  clearProblem: () => void;
};

export function useExports(): Exports {
  const [entitlement, setEntitlement] = useState<EntitlementView | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);

  /**
   * An allowance we have not learned yet reads as allowed: the first export
   * asks the server anyway, and stamping a watermark across a paying customer's
   * photo while that check is in flight is the worse mistake.
   */
  const allowed = entitlement === null ? true : usableOffline(entitlement);

  /**
   * Learn the allowance, and settle anything taken during an outage.
   *
   * The stored copy is shown first so a returning operator sees their count
   * immediately, then the server corrects it. With no connection the fetch
   * throws and the stored copy simply stands.
   */
  useEffect(() => {
    let alive = true;

    const sync = async () => {
      const stored = readQuota();
      if (stored && alive) setEntitlement(stored);

      try {
        const owed = readPending();
        // Clear the debt before the request, not after: a settlement that
        // succeeds but whose reply is lost must not be charged twice.
        if (owed > 0) writePending(0);
        const fresh = owed > 0 ? await settleOfflineExports(owed) : await viewEntitlement();
        if (!alive) return;
        if (fresh) {
          setEntitlement(fresh);
          writeQuota(fresh);
          setGuest(false);
        } else {
          // The server answered and there is no account behind this browser.
          // A stored allowance from an earlier session is not this visitor's.
          setEntitlement(null);
          setGuest(true);
        }
      } catch {
        // No connection. The stored allowance is what we go on.
      }
    };

    void sync();
    window.addEventListener("online", sync);
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
    };
  }, []);

  /**
   * Books one export before the file is produced.
   *
   * Charging up front rather than after the write means a crash halfway through
   * costs the user an export — the alternative, charging afterwards, means a
   * refused export still produced the file, which is worse.
   */
  const claim = useCallback(async (): Promise<boolean> => {
    // The server is still the authority when it can be reached — this copy can
    // be stale, and a refusal there is what actually stops the file. But when
    // the allowance is already known to be gone, there is nothing to ask about.
    if (!allowed) {
      setBlocked(true);
      return false;
    }

    try {
      const result = await spendExport();
      if (result.entitlement) {
        setEntitlement(result.entitlement);
        writeQuota(result.entitlement);
      }
      if (!result.ok) {
        if (result.reason === "auth") {
          setGuest(true);
          setProblem("Вы не вошли в аккаунт. Без входа сохраняется уменьшенная копия.");
        } else setBlocked(true);
        return false;
      }
      return true;
    } catch {
      /*
       * The connection is gone mid-job.
       *
       * The export goes ahead, charged against what this same server last
       * granted — never more. The debt is written down first and sent on the
       * next reconnection. A shop whose internet drops with a customer at the
       * counter should not be told to come back later; nobody gains an export
       * by pulling the cable out either.
       */
      if (!entitlement) {
        setProblem("Нет связи, и лимит ещё не известен. Подключитесь один раз.");
        return false;
      }
      const next = spendLocally(entitlement);
      setEntitlement(next);
      writeQuota(next);
      writePending(readPending() + 1);
      return true;
    }
  }, [allowed, entitlement]);

  const dismiss = useCallback(() => setBlocked(false), []);
  const clearProblem = useCallback(() => setProblem(null), []);

  return { entitlement, allowed, blocked, dismiss, claim, guest, problem, clearProblem };
}
