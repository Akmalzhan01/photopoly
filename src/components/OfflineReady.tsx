"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker and tells the user when the app is genuinely
 * usable offline — which, for this app, means the model is cached too.
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
