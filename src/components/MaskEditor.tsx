"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Source } from "@/lib/imaging";
import { applyStrokes, paintStroke, type Stroke, type StrokeMode } from "@/lib/mask";
import { Label, Segmented, Slider } from "./ui";

type MaskEditorProps = {
  original: Source;
  cutout: Source;
  strokes: Stroke[];
  onCommit: (strokes: Stroke[]) => void;
  onClose: () => void;
};

const DEFAULT_RADIUS = 0.035;
const DEFAULT_HARDNESS = 0.65;
const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

type View = { zoom: number; x: number; y: number };
const FIT: View = { zoom: 1, x: 0, y: 0 };

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export function MaskEditor({
  original,
  cutout,
  strokes,
  onCommit,
  onClose,
}: MaskEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<Stroke | null>(null);
  const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const spaceRef = useRef(false);

  const [local, setLocal] = useState<Stroke[]>(strokes);
  const [mode, setMode] = useState<StrokeMode>("erase");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  /** 1 is a crisp edge, 0 a fully feathered one. */
  const [hardness, setHardness] = useState(DEFAULT_HARDNESS);
  const [ghost, setGhost] = useState(true);
  const [view, setView] = useState<View>(FIT);
  const [panReady, setPanReady] = useState(false);
  /** Brush ring, in viewport pixels, so it lines up whatever the canvas scale is. */
  const [cursor, setCursor] = useState<{ cx: number; cy: number; size: number } | null>(
    null,
  );

  /** Repaints the visible canvas from the working copy. */
  const blit = useCallback(() => {
    const canvas = viewRef.current;
    const work = workRef.current;
    if (!canvas || !work) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ghost) {
      // A faint original underneath shows what there is to paint back.
      ctx.globalAlpha = 0.22;
      ctx.drawImage(original.bitmap, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(work, 0, 0, canvas.width, canvas.height);
  }, [ghost, original.bitmap]);

  /** Rebuilds the working copy from scratch — used on open, undo and clear. */
  const rebuild = useCallback(
    (list: Stroke[]) => {
      workRef.current = applyStrokes(cutout.bitmap, original.bitmap, list);
      const canvas = viewRef.current;
      if (canvas) {
        canvas.width = cutout.bitmap.width;
        canvas.height = cutout.bitmap.height;
      }
      blit();
    },
    [cutout.bitmap, original.bitmap, blit],
  );

  useEffect(() => {
    rebuild(local);
    // Only on mount and when the underlying images change; strokes are applied
    // incrementally while drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutout.bitmap, original.bitmap]);

  useEffect(() => blit(), [ghost, blit]);

  // The key handler is registered once, so it must not close over a stale list.
  const localRef = useRef(local);
  useEffect(() => {
    localRef.current = local;
  }, [local]);

  // Dropping a stroke means replaying what is left; adding one is drawn directly.
  const undoStroke = useCallback(() => {
    const next = localRef.current.slice(0, -1);
    setLocal(next);
    rebuild(next);
  }, [rebuild]);

  const clearStrokes = useCallback(() => {
    setLocal([]);
    rebuild([]);
  }, [rebuild]);

  /** Scales around a point given relative to the stage centre. */
  const zoomAt = useCallback((factor: number, px = 0, py = 0) => {
    setView((current) => {
      const zoom = clampZoom(current.zoom * factor);
      const ratio = zoom / current.zoom;
      if (zoom === MIN_ZOOM) return FIT;
      return {
        zoom,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoomAt(
        Math.exp(-event.deltaY * 0.0015),
        event.clientX - (rect.left + rect.width / 2),
        event.clientY - (rect.top + rect.height / 2),
      );
    };
    // Not passive: the page must not scroll while zooming the canvas.
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        spaceRef.current = true;
        setPanReady(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoStroke();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") onClose();
      if (event.key === "[") setRadius((r) => Math.max(0.005, r - 0.008));
      if (event.key === "]") setRadius((r) => Math.min(0.25, r + 0.008));
      if (event.key === "+" || event.key === "=") zoomAt(1.25);
      if (event.key === "-") zoomAt(0.8);
      if (event.key === "0") setView(FIT);
      if (event.key.toLowerCase() === "e") setMode("erase");
      if (event.key.toLowerCase() === "r") setMode("restore");
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        spaceRef.current = false;
        setPanReady(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onClose, undoStroke, zoomAt]);

  // The canvas rect already includes the CSS transform, so image coordinates
  // stay correct at any zoom without extra maths here.
  const toImage = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = viewRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);

    if (event.button === 1 || spaceRef.current) {
      event.preventDefault();
      panRef.current = { sx: event.clientX, sy: event.clientY, ox: view.x, oy: view.y };
      return;
    }

    const point = toImage(event);
    if (!point) return;
    drawingRef.current = {
      mode,
      radius,
      softness: 1 - hardness,
      points: [point],
    };
    if (workRef.current) {
      paintStroke(workRef.current, original.bitmap, drawingRef.current, 0);
      blit();
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (pan) {
      setView((current) => ({
        ...current,
        x: pan.ox + (event.clientX - pan.sx),
        y: pan.oy + (event.clientY - pan.sy),
      }));
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setCursor({
      cx: event.clientX,
      cy: event.clientY,
      size: radius * 2 * rect.width,
    });

    const point = toImage(event);
    const stroke = drawingRef.current;
    if (!stroke || !point || !workRef.current) return;
    const previous = stroke.points.length - 1;
    stroke.points.push(point);
    // Draw only the new segment; replaying the whole stroke each move would crawl.
    paintStroke(workRef.current, original.bitmap, stroke, previous);
    blit();
  };

  const endStroke = () => {
    panRef.current = null;
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke) return;
    setLocal((list) => [...list, stroke]);
  };

  const zoomLabel = `${Math.round(view.zoom * 100)}%`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink/97 backdrop-blur-sm">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3">
        <h2 className="font-display text-xl text-chalk">
          Поправить <em className="text-safe">края</em>
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
          {local.length} действий
        </p>

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => zoomAt(0.8)}
            disabled={view.zoom <= MIN_ZOOM}
            aria-label="Уменьшить"
            title="Уменьшить (−)"
            className="border border-line px-2.5 py-1.5 font-mono text-[11px] text-ash transition-colors enabled:hover:border-line-lit enabled:hover:text-safe disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setView(FIT)}
            aria-label="Вписать в кадр"
            title="Вписать в кадр (0)"
            className="-mx-px border border-line px-2.5 py-1.5 font-mono text-[10px] text-ash tabular-nums transition-colors hover:border-line-lit hover:text-safe"
          >
            {zoomLabel}
          </button>
          <button
            type="button"
            onClick={() => zoomAt(1.25)}
            disabled={view.zoom >= MAX_ZOOM}
            aria-label="Увеличить"
            title="Увеличить (+)"
            className="border border-line px-2.5 py-1.5 font-mono text-[11px] text-ash transition-colors enabled:hover:border-line-lit enabled:hover:text-safe disabled:opacity-30"
          >
            +
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undoStroke}
            disabled={local.length === 0}
            className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors enabled:hover:border-line-lit enabled:hover:text-chalk disabled:opacity-40"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={clearStrokes}
            disabled={local.length === 0}
            className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors enabled:hover:border-line-lit enabled:hover:text-chalk disabled:opacity-40"
          >
            Сбросить всё
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dust transition-colors hover:text-chalk"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onCommit(local)}
            className="border border-safe/70 bg-safe/12 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-safe-soft transition-colors hover:bg-safe/22"
          >
            Сохранить
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={stageRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5"
        >
          <canvas
            ref={viewRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() => setCursor(null)}
            onContextMenu={(event) => event.preventDefault()}
            className="checkerboard max-h-full max-w-full touch-none border border-line-lit"
            style={{
              cursor: panReady ? "grab" : "none",
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              imageRendering: view.zoom >= 3 ? "pixelated" : "auto",
            }}
          />
          {cursor && !panReady ? (
            <span
              aria-hidden
              className="pointer-events-none fixed z-50 rounded-full border border-safe shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
              style={{
                left: cursor.cx,
                top: cursor.cy,
                width: cursor.size,
                height: cursor.size,
                transform: "translate(-50%, -50%)",
              }}
            />
          ) : null}
        </div>

        <aside className="w-full shrink-0 space-y-5 overflow-y-auto border-t border-line bg-slab px-5 py-5 lg:w-80 lg:border-l lg:border-t-0">
          <div className="flex flex-col gap-1.5">
            <Label>Кисть</Label>
            <Segmented<StrokeMode>
              ariaLabel="Режим кисти"
              value={mode}
              options={[
                { value: "erase", label: "Стирать", title: "Убрать лишний фон (E)" },
                { value: "restore", label: "Вернуть", title: "Восстановить срезанное (R)" },
              ]}
              onChange={setMode}
            />
          </div>

          <Slider
            label="Размер кисти"
            value={radius}
            min={0.005}
            max={0.25}
            step={0.005}
            display={`${Math.round(radius * 200)}`}
            onChange={setRadius}
            onReset={() => setRadius(DEFAULT_RADIUS)}
          />

          <div className="flex flex-col gap-1">
            <Slider
              label="Жёсткость краёв"
              value={hardness}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(hardness * 100)}`}
              onChange={setHardness}
              onReset={() => setHardness(DEFAULT_HARDNESS)}
            />
            <p className="text-[10px] leading-snug text-dust">
              Yuqori qiymat — keskin chet (ko&apos;zoynak, yelka). Past qiymat —
              yumshoq o&apos;tish (soch, mo&apos;yna).
            </p>
          </div>

          <Slider
            label="Масштаб"
            value={view.zoom}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.1}
            display={zoomLabel}
            onChange={(zoom) => setView((v) => ({ ...v, zoom: clampZoom(zoom) }))}
            onReset={() => setView(FIT)}
          />

          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-[12px] text-chalk">Показывать исходник полупрозрачно</span>
            <input
              type="checkbox"
              checked={ghost}
              onChange={(event) => setGhost(event.target.checked)}
              className="h-4 w-4 accent-safe"
            />
          </label>

          <div className="space-y-2 border-t border-line pt-4 text-[11px] leading-relaxed text-dust">
            {/* Explicit strings: JSX drops the space when it wraps a line here. */}
            <p>
              <span className="text-ash">Стирать</span>
              {" — убирает остатки фона."}
            </p>
            <p>
              <span className="text-ash">Вернуть</span>
              {" — восстанавливает волосы, очки или край плеча, срезанные моделью."}
            </p>
            <p>
              Масштаб — колёсиком мыши, перетаскивание — с зажатой{" "}
              <span className="text-ash">Пробел</span>.
            </p>
            <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.14em]">
              E / R — режим · [ ] — размер · + − 0 — масштаб · Ctrl+Z — назад ·
              Esc — выход
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
