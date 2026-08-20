"use client";

import { logout } from "@/app/actions/auth";
import { clearQuota } from "@/lib/offline-quota";

/**
 * Signs out and drops everything this account left on the machine.
 *
 * Two things now, not one. The worker's caches hold the model weights, the
 * assets and — since the studio became cacheable — the editor's own HTML, which
 * is identical for everybody but still this account's footprint. Local storage
 * holds the mirrored allowance, which is not: on a shared computer the next
 * operator must not open the app and read the last one's plan and remaining
 * count.
 */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form
      action={logout}
      onSubmit={() => {
        clearQuota();
        navigator.serviceWorker?.controller?.postMessage("photopoly:signout");
      }}
    >
      <button type="submit" className={className}>
        Выйти
      </button>
    </form>
  );
}
