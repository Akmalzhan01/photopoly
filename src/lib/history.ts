import { useCallback, useEffect, useRef, useState } from "react";
import type { Stroke } from "./mask";
import type { Settings } from "./settings";

/** Everything a user can undo: their settings plus any hand corrections. */
export type Doc = {
  settings: Settings;
  strokes: Stroke[];
};

const LIMIT = 60;
/** Repeated edits to the same control within this window collapse into one step. */
const COALESCE_MS = 600;

/** Identifies *what* changed, so a slider drag doesn't fill the stack. */
function signature(before: Doc, after: Doc): string {
  if (before.strokes !== after.strokes) return "strokes";
  const keys = (Object.keys(after.settings) as (keyof Settings)[]).filter(
    (key) => before.settings[key] !== after.settings[key],
  );
  return keys.join(",");
}

export function useHistory(doc: Doc, apply: (doc: Doc) => void, ready: boolean) {
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);

  const last = useRef<Doc>(doc);
  /** Set while an undo/redo is being applied, so it isn't recorded as a new edit. */
  const replaying = useRef(false);
  const started = useRef(false);
  const lastSignature = useRef("");
  const lastPush = useRef(0);

  useEffect(() => {
    if (!ready) {
      last.current = doc;
      return;
    }
    // Loading saved settings is not an edit the user should be able to undo.
    if (!started.current) {
      started.current = true;
      last.current = doc;
      return;
    }
    if (replaying.current) {
      replaying.current = false;
      last.current = doc;
      return;
    }
    const previous = last.current;
    if (previous.settings === doc.settings && previous.strokes === doc.strokes) return;

    const change = signature(previous, doc);
    const now = Date.now();
    const continues = change === lastSignature.current && now - lastPush.current < COALESCE_MS;

    if (!continues) {
      setPast((stack) => [...stack, previous].slice(-LIMIT));
      setFuture([]);
    }

    lastSignature.current = change;
    lastPush.current = now;
    last.current = doc;
  }, [doc, ready]);

  const undo = useCallback(() => {
    setPast((stack) => {
      if (stack.length === 0) return stack;
      const target = stack[stack.length - 1];
      setFuture((ahead) => [...ahead, last.current]);
      replaying.current = true;
      // A fresh step boundary, so the next edit is never merged into this one.
      lastSignature.current = "";
      apply(target);
      return stack.slice(0, -1);
    });
  }, [apply]);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (stack.length === 0) return stack;
      const target = stack[stack.length - 1];
      setPast((behind) => [...behind, last.current]);
      replaying.current = true;
      lastSignature.current = "";
      apply(target);
      return stack.slice(0, -1);
    });
  }, [apply]);

  return { undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

/** True when a keystroke should be left to the focused text field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA") return true;
  // Sliders have no native undo worth preserving; text and number fields do.
  return tag === "INPUT" && (target as HTMLInputElement).type !== "range";
}
