"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import type { Progress } from "@/lib/cutout";
import { fromPixels, tickStep, type Unit } from "@/lib/units";

type StageProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  hasImage: boolean;
  busy: boolean;
  progress: Progress | null;
  targetW: number;
  targetH: number;
  unit: Unit;
  dpi: number;
  transparent: boolean;
  onFile: (file: File) => void;
  /** Opens the file picker, which Studio owns so the panel can open it too. */
  onPick: () => void;
  /** On a print sheet: the photos as one piece the studio can drag about. */
  mover?: Mover;
};

type Mover = {
  /** The group of photos (and the studio's card), in the sheet's millimetres. */
  box: { x: number; y: number; w: number; h: number };
  sheetW: number;
  sheetH: number;
  /**
   * The group's new top-left corner, in millimetres. `exact` is for the arrow
   * keys, which move by a set step and must not be snapped back to where they
   * started.
   */
  onMove: (x: number, y: number, exact?: boolean) => void;
};

/**
 * A handle laid exactly over the photos on the sheet. Dragging it moves them
 * all at once; the sheet is redrawn underneath, so what is seen is what will
 * print, not an outline of it.
 */
function MoveHandle({ mover }: { mover: Mover }) {
  const grab = useRef<{ x: number; y: number; from: { x: number; y: number }; perMm: number } | null>(null);
  const [active, setActive] = useState(false);
  const { box, sheetW, sheetH } = mover;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Фото на листе — перетащите, чтобы передвинуть; стрелки двигают на 1 мм"
      title="Перетащите, чтобы передвинуть фото на листе"
      className={`group absolute touch-none rounded-sm outline-none transition-colors ${
        active
          ? "cursor-grabbing bg-safe/8 ring-2 ring-safe"
          : "cursor-grab hover:bg-safe/5 hover:ring-2 hover:ring-safe/60 focus-visible:ring-2 focus-visible:ring-safe"
      }`}
      style={{
        left: `${(box.x / sheetW) * 100}%`,
        top: `${(box.y / sheetH) * 100}%`,
        width: `${(box.w / sheetW) * 100}%`,
        height: `${(box.h / sheetH) * 100}%`,
      }}
      onPointerDown={(event) => {
        const paper = event.currentTarget.parentElement;
        if (!paper) return;
        grab.current = {
          x: event.clientX,
          y: event.clientY,
          from: { x: box.x, y: box.y },
          perMm: paper.getBoundingClientRect().width / sheetW,
        };
        setActive(true);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety: without it the drag still works over the handle.
        }
      }}
      onPointerMove={(event) => {
        const start = grab.current;
        if (!start) return;
        mover.onMove(
          start.from.x + (event.clientX - start.x) / start.perMm,
          start.from.y + (event.clientY - start.y) / start.perMm,
        );
      }}
      onPointerUp={() => {
        grab.current = null;
        setActive(false);
      }}
      onPointerCancel={() => {
        grab.current = null;
        setActive(false);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 10 : 1;
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        mover.onMove(box.x + move[0], box.y + move[1], true);
      }}
    >
      <span
        className={`pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-safe px-2 py-0.5 text-[11px] font-semibold text-white shadow-card transition-opacity ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {active ? `${Math.round(box.x)} × ${Math.round(box.y)} мм от края` : "Перетащите"}
      </span>
    </div>
  );
}

function ticksFor(spanPx: number, unit: Unit, dpi: number) {
  const span = fromPixels(spanPx, unit, dpi);
  if (!Number.isFinite(span) || span <= 0) return [];
  const step = tickStep(span);
  const out: { at: number; label: number }[] = [];
  for (let value = 0; value <= span + step * 0.001; value += step) {
    out.push({ at: Math.min(100, (value / span) * 100), label: value });
  }
  return out;
}

export function Stage({
  canvasRef,
  hasImage,
  busy,
  progress,
  targetW,
  targetH,
  unit,
  dpi,
  transparent,
  onFile,
  onPick,
  mover,
}: StageProps) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);

  // The rulers have to track the canvas at whatever size the layout gives it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setBox({ w: rect.width, h: rect.height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, hasImage]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) onFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const xTicks = ticksFor(targetW, unit, dpi);
  const yTicks = ticksFor(targetH, unit, dpi);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file?.type.startsWith("image/")) onFile(file);
      }}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-ink"
    >
      {/* Safelight: a warm bloom behind the working area. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"
        style={{
          background:
            "radial-gradient(closest-side, var(--color-safe) 0%, transparent 72%)",
        }}
      />

      {hasImage ? (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-6 sm:p-10">
          <div className="flex min-h-0 max-h-full flex-col">
            <div className="flex items-end">
              {/* Corner cell carries the unit, like the origin mark on a loupe. */}
              <div className="flex h-5 w-8 shrink-0 items-end justify-end pr-1.5">
                <span className="text-[11px] lowercase text-dust tabular-nums">{unit}</span>
              </div>
              <div className="relative h-5" style={{ width: box.w || undefined }}>
                {xTicks.map((tick) => (
                  <div
                    key={tick.label}
                    className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${tick.at}%` }}
                  >
                    <span className="text-[11px] leading-none text-dust tabular-nums">
                      {tick.label}
                    </span>
                    <span className="mt-1 h-1.5 w-px bg-line-lit" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 items-start">
              <div className="relative w-8 shrink-0" style={{ height: box.h || undefined }}>
                {yTicks.map((tick) => (
                  <div
                    key={tick.label}
                    className="absolute right-0 flex -translate-y-1/2 items-center gap-1"
                    style={{ top: `${tick.at}%` }}
                  >
                    <span className="text-[11px] leading-none text-dust tabular-nums">
                      {tick.label}
                    </span>
                    <span className="h-px w-1.5 bg-line-lit" />
                  </div>
                ))}
              </div>

              <div className="relative min-h-0 border border-line-lit shadow-[var(--shadow-stage)] rounded-lg">
                <canvas
                  ref={canvasRef}
                  className={`block max-h-[62vh] max-w-full object-contain ${
                    transparent ? "checkerboard" : ""
                  }`}
                />
                {mover && !busy ? <MoveHandle mover={mover} /> : null}
                {busy ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink/55 backdrop-blur-[1px]">
                    <div className="absolute inset-x-0 top-0 h-16 animate-sweep bg-gradient-to-b from-transparent via-safe/25 to-transparent">
                      <div className="absolute inset-x-0 bottom-0 h-px bg-safe shadow-[0_0_14px_2px] shadow-safe/70" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 pl-8">
              <span className="text-[12px] text-dust tabular-nums">
                {targetW} × {targetH} px
              </span>
              <span className="h-px flex-1 bg-line" />
              <button
                type="button"
                onClick={onPick}
                className="text-[12px] text-ash transition-colors hover:text-safe font-medium"
              >
                Другое фото
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
          <button
            type="button"
            onClick={onPick}
            className={`group flex w-full max-w-lg animate-rise flex-col items-center gap-6 border border-dashed px-8 py-16 transition-all duration-300 ${
              dragging
                ? "border-safe bg-safe/8"
                : "border-line-lit bg-slab/40 hover:border-safe/60 hover:bg-slab/70"
            } rounded-lg`}
          >
            <div className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 border border-line-lit transition-transform duration-500 group-hover:rotate-45 rounded-lg" />
              <span className="absolute h-px w-6 bg-safe" />
              <span className="absolute h-6 w-px bg-safe" />
            </div>
            <div className="text-center">
              <p className="font-display text-2xl text-chalk font-semibold tracking-tight">Перетащите фото сюда</p>
              <p className="mt-2 text-[13px] tracking-wide text-dust tabular-nums">
                или нажмите · вставьте через Ctrl+V · JPG, PNG, WEBP
              </p>
            </div>
          </button>
        </div>
      )}

      {busy && progress ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-line bg-pit/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-safe-soft font-medium">
              {progress.label}
            </span>
            <div className="h-px flex-1 bg-line">
              <div
                className="h-px bg-safe transition-[width] duration-200"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
            <span className="text-[12px] text-ash tabular-nums">
              {Math.round(progress.ratio * 100)}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
