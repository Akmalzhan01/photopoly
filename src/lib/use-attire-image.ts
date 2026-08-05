"use client";

import { useEffect, useState } from "react";
import type { AttireImage } from "./attire";

/**
 * Loads an uploaded suit and keeps it decoded, ready for `compose()`.
 *
 * `crossOrigin = "anonymous"` is the load-bearing line. Without it the browser
 * still shows the image, but drawing it taints the canvas and `toBlob()` then
 * throws a SecurityError — the suit would look right on screen and every export
 * would fail. Supabase Storage answers public objects with
 * `Access-Control-Allow-Origin: *`, so the anonymous request is served normally.
 */
export function useAttireImage(url: string | null): AttireImage | null {
  // The url is stored beside the image so a stale result can be discarded by
  // comparison rather than by clearing state from inside the effect, which
  // would cost an extra render on every change of suit.
  const [loaded, setLoaded] = useState<{ url: string; image: AttireImage } | null>(null);

  useEffect(() => {
    if (!url) return;

    let live = true;
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.decoding = "async";

    element.onload = () => {
      if (live) setLoaded({ url, image: element });
    };
    // A missing or blocked file leaves the photo untouched rather than stopping
    // the studio: nothing is recorded, so the derived value stays null.
    element.src = url;

    return () => {
      live = false;
      element.onload = null;
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.image : null;
}
