"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker and says when there is no connection.
 *
 * Whether the app would *survive* losing it is a different question, answered
 * quietly in the header by `OfflineBadge` — a full-width banner for that would
 * nag every shop that never loses its internet.
 */
export function OfflineReady() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // Registration failures are not worth surfacing; the app works regardless.
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="shrink-0 border-b border-line bg-riser px-5 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
        Нет интернета — редактор работает, экспорты спишутся при подключении
      </p>
    </div>
  );
}
