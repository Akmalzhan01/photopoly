"use client";

import { useEffect, useState } from "react";
import { checkReadiness, READINESS_COPY, type Readiness } from "@/lib/offline-ready";

/**
 * Whether the editor would survive losing the connection, said out loud.
 *
 * Storing it happens quietly and takes a moment — and after a deploy it takes a
 * whole extra visit, because the worker being replaced still serves the visit
 * that installs its successor. Until this existed, the only way to find out was
 * to pull the cable and watch the app fail, which reads as "offline does not
 * work" rather than "offline is not ready yet". That is a bad way to learn it,
 * and it is what actually happened.
 *
 * Small and permanent rather than a banner: a shop that never loses its
 * internet should be able to ignore it, and one that is about to should be able
 * to glance at it.
 */
export function OfflineBadge() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const look = async () => {
      const state = await checkReadiness();
      if (!alive) return;
      setReadiness(state);
      // Keep looking until everything is stored: the page lands seconds after
      // load, and the model only once a photo has been through it. Nothing can
      // un-store them, so once full the polling stops for good.
      if (state !== "full") timer = setTimeout(look, 4000);
    };

    void look();
    navigator.serviceWorker?.addEventListener("controllerchange", look);
    return () => {
      alive = false;
      clearTimeout(timer);
      navigator.serviceWorker?.removeEventListener("controllerchange", look);
    };
  }, []);

  // Says nothing until it knows, and nothing at all where service workers are
  // absent — a permanent "not ready" in a browser that can never be ready is a
  // complaint, not information.
  if (readiness === null) return null;

  const copy = READINESS_COPY[readiness];
  return (
    <span
      title={copy.title}
      className={`hidden border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] sm:inline-block ${
        readiness === "full"
          ? "border-line text-safe-soft"
          : "border-line text-dust"
      }`}
    >
      {copy.label}
    </span>
  );
}
