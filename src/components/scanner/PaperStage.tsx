"use client";

import { useEffect, useRef, useState } from "react";
import { CUT_LINE_COLOUR, clampPlaced, mm, type Dims, type Placed } from "@/lib/paper";

/** How close, in millimetres, a scan's centre has to come to the sheet's to snap. */
const SNAP = 2.5;

type Grab = {
  id: string;
  kind: "move" | "size";
  /** Pointer position at the start, in millimetres. */
  from: { x: number; y: number };
  origin: Placed;
};

/**
 * A sheet of paper at screen size, with the scans on it as pieces to drag.
 *
 * The paper and the scans are one canvas, redrawn on every change; the boxes
 * on top are only there to be grabbed, so dragging costs one draw and no
 * layout.
 */
export function PaperStage({
  sheet,
  items,
  pictures,
  aspectOf,
  cutLines,
  width,
  height,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  sheet: Dims;
  items: Placed[];
  /** Screen-sized copies of the scans, by page. */
  pictures: Record<string, HTMLCanvasElement | undefined>;
  aspectOf: (pageId: string) => number;
  cutLines: boolean;
  width: number;
  height: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (item: Placed) => void;
  onRemove: (id: string) => void;
}) {
  const perMm = width / sheet.w;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grab, setGrab] = useState<Grab | null>(null);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    const scale = perMm * dpr;
    for (const item of items) {
      const picture = pictures[item.pageId];
      if (!picture) continue;
      const w = item.w * scale;
      const h = w * aspectOf(item.pageId);
      ctx.drawImage(picture, item.x * scale, item.y * scale, w, h);
      if (cutLines) {
        // At least a device pixel, so it shows on screen as it will on paper.
        ctx.strokeStyle = CUT_LINE_COLOUR;
        ctx.lineWidth = dpr;
        ctx.strokeRect(item.x * scale + dpr / 2, item.y * scale + dpr / 2, w - dpr, h - dpr);
      }
    }
  }, [items, pictures, aspectOf, cutLines, width, height, perMm]);

  const pointerMm = (event: React.PointerEvent<HTMLElement>, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / perMm, y: (event.clientY - rect.top) / perMm };
  };

  const start = (event: React.PointerEvent<HTMLElement>, item: Placed, kind: Grab["kind"]) => {
    event.stopPropagation();
    const paper = event.currentTarget.closest<HTMLElement>("[data-paper]");
    if (!paper) return;
    onSelect(item.id);
    setGrab({ id: item.id, kind, from: pointerMm(event, paper), origin: item });
    try {
      paper.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety: without it the drag still works over the sheet.
    }
  };

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!grab) return;
    const at = pointerMm(event, event.currentTarget);
    const { origin } = grab;
    const aspect = aspectOf(origin.pageId);
    if (grab.kind === "move") {
      let x = origin.x + at.x - grab.from.x;
      const y = origin.y + at.y - grab.from.y;
      const centred = Math.abs(x + origin.w / 2 - sheet.w / 2) < SNAP;
      if (centred) x = (sheet.w - origin.w) / 2;
      setGuide(centred);
      onChange(clampPlaced({ ...origin, x, y }, aspect, sheet));
    } else {
      // The corner follows the pointer along whichever edge it pulls further.
      const w = Math.max(at.x - origin.x, (at.y - origin.y) / aspect);
      const fit = Math.min(sheet.w - origin.x, (sheet.h - origin.y) / aspect);
      onChange(clampPlaced({ ...origin, w: Math.min(fit, w) }, aspect, sheet));
    }
  };

  const end = () => {
    setGrab(null);
    setGuide(false);
  };

  const nudge = (event: React.KeyboardEvent, item: Placed) => {
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(item.id);
      return;
    }
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange(clampPlaced({ ...item, x: item.x + move[0], y: item.y + move[1] }, aspectOf(item.pageId), sheet));
  };

  return (
    <div
      data-paper
      className="relative touch-none rounded-sm bg-white shadow-stage select-none"
      style={{ width, height }}
      onPointerDown={() => onSelect(null)}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" role="img" aria-label="Лист" />

      {guide ? (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-safe" />
      ) : null}

      {items.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] leading-relaxed text-neutral-400">
          Нажмите на скан внизу —<br />он ляжет на этот лист
        </div>
      ) : null}

      {items.map((item) => {
        const active = item.id === selected;
        const w = item.w * perMm;
        const h = w * aspectOf(item.pageId);
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`Скан ${mm(item.w)} × ${mm(item.w * aspectOf(item.pageId))} мм — перетащите, стрелки двигают`}
            onPointerDown={(event) => start(event, item, "move")}
            onKeyDown={(event) => nudge(event, item)}
            onFocus={() => onSelect(item.id)}
            className={`absolute outline-none ${grab?.id === item.id ? "cursor-grabbing" : "cursor-grab"} ${
              active ? "ring-2 ring-safe" : "hover:ring-1 hover:ring-safe/60"
            }`}
            style={{ left: item.x * perMm, top: item.y * perMm, width: w, height: h }}
          >
            {active ? (
              <>
                <span
                  className={`pointer-events-none absolute ${item.y * perMm < 30 ? "top-1 left-1" : "-top-7 left-0"} rounded-md bg-safe px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular-nums`}
                >
                  {mm(item.w)} × {mm(item.w * aspectOf(item.pageId))} мм
                </span>
                <button
                  type="button"
                  aria-label="Убрать с листа"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onRemove(item.id)}
                  className="absolute -top-3 -right-3 flex h-6 w-6 items-center justify-center rounded-full bg-ember text-[14px] leading-none text-white shadow-card"
                >
                  ×
                </button>
                <span
                  aria-hidden
                  onPointerDown={(event) => start(event, item, "size")}
                  className="absolute -right-2.5 -bottom-2.5 h-5 w-5 cursor-nwse-resize rounded-full border-[3px] border-safe bg-white shadow-card"
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
