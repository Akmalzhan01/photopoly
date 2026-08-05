"use client";

import { logout } from "@/app/actions/auth";

/**
 * Signs out and tells the service worker to drop everything it cached.
 *
 * The worker no longer stores personalised HTML, but the model weights and
 * asset caches are still this account's footprint on a possibly shared machine,
 * and clearing them on the way out costs one message.
 */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form
      action={logout}
      onSubmit={() => {
        navigator.serviceWorker?.controller?.postMessage("photopoly:signout");
      }}
    >
      <button type="submit" className={className}>
        Выйти
      </button>
    </form>
  );
}
