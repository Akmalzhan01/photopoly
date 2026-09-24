"use client";

import { useMemo, useRef, useState } from "react";
import type { Face } from "@/lib/box";
import { assemble, placement } from "@/lib/box-assemble";

/**
 * The blank, folded up.
 *
 * "What do I get if I cut this out" is a question a flat drawing answers badly,
 * and it is the question a shop actually has before ordering a die. So the same
 * panels the drawing is made of are hinged together and turned: at 0 it is the
 * flat sheet, at 1 it is the box.
 *
 * Plain CSS transforms rather than a 3D library. The geometry is already known
 * exactly — every panel is a rectangle and every crease is one of its edges —
 * so there is nothing to solve, only to rotate, and a page that folds a box
 * without downloading anything keeps working when the connection does not.
 */

const TONE: Record<Face["role"], string> = {
  panel: "bg-riser/85 border-line-lit",
  flap: "bg-slab/85 border-line",
  glue: "bg-safe/18 border-safe/40",
};

function Panel({
  node,
  parent,
  scale,
  fold,
}: {
  node: Face;
  parent: Face | null;
  scale: number;
  fold: number;
}) {
  // Position and hinge come from the same function the measurement uses, so
  // what is drawn and what is measured cannot disagree.
  const { left, top, origin } = placement(node, parent);
  const angle = parent ? node.angle * fold : 0;

  return (
    <div
      className={`absolute border ${TONE[node.role]}`}
      style={{
        left: left * scale,
        top: top * scale,
        width: node.w * scale,
        height: node.h * scale,
        transformOrigin: origin.css,
        transform: `${origin.spin ? "rotateY" : "rotateX"}(${angle}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {node.children.map((child, i) => (
        <Panel key={i} node={child} parent={node} scale={scale} fold={fold} />
      ))}
    </div>
  );
}

export function BoxFold({ root, note }: { root: Face; note?: string }) {
  const [fold, setFold] = useState(1);
  const [spin, setSpin] = useState(-28);
  const [tilt, setTilt] = useState(-62);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // The flat sheet is several times wider than the box it becomes, so one fixed
  // scale either wastes the frame on the assembled box or crops the sheet. The
  // assembly is measured at the current fold instead, and framed on that — it
  // zooms in as it folds and never drifts out of view.
  const stage = 300;
  const fit = useMemo(() => assemble(root, fold), [root, fold]);
  const span = Math.max(fit.size.x, fit.size.y, fit.size.z, 1);
  // Short of filling the frame: perspective makes the near face bigger than the
  // measurement says, and a box touching the edges looks cramped.
  const scale = (stage / span) * 0.72;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative h-75 cursor-grab touch-none overflow-hidden border border-line bg-pit active:cursor-grabbing"
        style={{ perspective: "1600px" }}
        onPointerDown={(event) => {
          dragging.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const from = dragging.current;
          if (!from) return;
          setSpin((s) => s + (event.clientX - from.x) * 0.5);
          setTilt((t) => t - (event.clientY - from.y) * 0.5);
          dragging.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt}deg) rotateZ(${spin}deg)`,
          }}
        >
          <div
            style={{
              transformStyle: "preserve-3d",
              // On the middle of the assembled shape, not the middle of the
              // first panel: the box grows away from whichever panel the fold
              // starts at, and centring on that one walks it off the frame.
              transform: `translate3d(${-fit.centre.x * scale}px, ${-fit.centre.y * scale}px, ${-fit.centre.z * scale}px)`,
            }}
          >
            <div className="relative" style={{ transformStyle: "preserve-3d" }}>
              <Panel node={root} parent={null} scale={scale} fold={fold} />
            </div>
          </div>
        </div>

        <span className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-dust">
          потяните, чтобы повернуть
        </span>
      </div>

      <label className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">Сборка</span>
        <input
          type="range"
          className="rail flex-1"
          min={0}
          max={1}
          step={0.01}
          value={fold}
          aria-label="Насколько коробка сложена"
          aria-valuetext={`${Math.round(fold * 100)}%`}
          onChange={(event) => setFold(Number(event.target.value))}
        />
        <span className="w-10 text-right font-mono text-[11px] text-ash tabular-nums">
          {Math.round(fold * 100)}%
        </span>
      </label>

      {note ? <p className="font-mono text-[10px] leading-relaxed text-dust">{note}</p> : null}
    </div>
  );
}
