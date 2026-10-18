"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  download,
  exportCanvas,
  extensionFor,
  fileStem,
  formatBytes,
} from "@/lib/imaging";
import { printAtSize } from "@/lib/print";
import {
  bufferRatio,
  describeMm,
  EDGE_LIMIT,
  exposureOf,
  finalCanvas,
  focusRegion,
  idleQuality,
  initialQuality,
  JPEG_QUALITY,
  PRINT_DPI,
  previewPair,
  printMm,
  resultSize,
  SCALES,
  stageBox,
  type Pair,
  type Quality,
  type View,
} from "@/lib/quality";
import { loadQuality, saveQuality } from "@/lib/storage";
import { useExports } from "@/lib/use-exports";
import { drawWatermark } from "@/lib/watermark";
import { describeQuota } from "@/lib/entitlement-view";
import { Button, Notice } from "@/components/site/ui";
import { Label, Segmented, Slider, Toggle } from "@/components/ui";
import { QuotaWall } from "@/components/QuotaWall";

/** Tall enough to judge a face, short enough to leave the controls on screen. */
const MAX_STAGE = 560;

const DEFAULTS = initialQuality();

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label>{label}</Label>
      <span className="text-[13px] text-chalk tabular-nums">{value}</span>
    </div>
  );
}

export function QualityStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [quality, setQuality] = useState<Quality>(initialQuality);
  const [view, setView] = useState<View>("fit");
  /** Which part of the picture the 1:1 window looks at, as fractions. */
  const [focus, setFocus] = useState({ w: 0.5, h: 0.5 });
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [pair, setPair] = useState<Pair | null>(null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const { entitlement, allowed, blocked, dismiss, claim, problem, clearProblem } = useExports();

  // Same reason as the editor and the box page: localStorage does not exist on
  // the server, and seeding state from it would make the first client render
  // disagree with the markup that arrived.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = loadQuality();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    if (stored) setQuality(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveQuality(quality), 400);
    return () => clearTimeout(timer);
  }, [quality, hydrated]);

  const patch = useCallback(
    (next: Partial<Quality>) => setQuality((prev) => ({ ...prev, ...next })),
    [],
  );

  const pickerRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((next: File) => {
    setError(null);
    setMade(null);
    setPair(null);
    setFocus({ w: 0.5, h: 0.5 });
    setSplit(50);
    setFile(next);
  }, []);

  // Decoded once and kept: every preview and the final file are drawn from it.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let opened: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((decoded) => {
        opened = decoded;
        if (cancelled) return;
        setBitmap(decoded);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть этот файл. Выберите другое фото.");
      });
    return () => {
      cancelled = true;
      // Closed on the way out rather than on arrival: a bitmap still held by
      // the previous render is what the canvases are drawing from.
      opened?.close();
    };
  }, [file]);

  /**
   * How much room the preview has.
   *
   * Measured on the wrapper, never on the stage itself — the stage is sized
   * from the picture, so measuring it would feed its own height back into its
   * own width and the two would chase each other.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(0);
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setRoom(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const aspect = bitmap ? bitmap.width / bitmap.height : 4 / 3;

  /**
   * The photograph's exposure, measured once and used by both views and by the
   * saved file — so a window of flat cheek is corrected the way the whole
   * picture is, not the way that window alone would have been.
   */
  const exposure = useMemo(() => (bitmap ? exposureOf(bitmap) : null), [bitmap]);

  /** What one drag of a slider is allowed to cost, in pixels. */
  const buffer = useMemo(() => {
    const box = stageBox(room || 640, aspect, MAX_STAGE);
    const ratio = bufferRatio(box, typeof window === "undefined" ? 1 : window.devicePixelRatio);
    return { w: Math.round(box.w * ratio), h: Math.round(box.h * ratio) };
  }, [room, aspect]);

  useEffect(() => {
    if (!bitmap || room === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the work is running
    setComputing(true);
    let alive = true;
    const timer = setTimeout(() => {
      try {
        const next = previewPair(bitmap, quality, view, focus, buffer, exposure);
        if (!alive) return;
        setPair(next);
      } catch {
        if (alive) setError("Не удалось показать это фото. Попробуйте другое.");
      }
      if (alive) setComputing(false);
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
      setComputing(false);
    };
  }, [bitmap, quality, view, focus, buffer, room, exposure]);

  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!pair) return;
    for (const [element, source] of [
      [beforeRef.current, pair.before] as const,
      [afterRef.current, pair.after] as const,
    ]) {
      if (!element) continue;
      element.width = source.width;
      element.height = source.height;
      element.getContext("2d")?.drawImage(source, 0, 0);
    }
    // Only the improved side, and only on screen — same reasoning as the
    // editor's. The file itself is refused by `claim()`; this is so the result
    // cannot simply be screenshotted out of the comparison instead.
    const after = afterRef.current;
    if (!allowed && after) {
      const ctx = after.getContext("2d");
      if (ctx) drawWatermark(ctx, after.width, after.height);
    }
  }, [pair, allowed]);

  const source = bitmap ? { w: bitmap.width, h: bitmap.height } : null;
  const result = source ? resultSize(source, quality.scale) : null;
  /** The stage takes the shape of what is in it, so nothing is letterboxed. */
  const box = stageBox(room || 640, pair ? pair.before.width / pair.before.height : aspect, MAX_STAGE);
  /** Where the 1:1 window sits, drawn over the whole frame as a guide. */
  const window1to1 = source ? focusRegion(source, buffer, quality.scale, focus) : null;

  const stageRef = useRef<HTMLDivElement>(null);
  const moveSplit = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const pickFocus = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      setFocus({
        w: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        h: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
      });
    },
    [],
  );

  /**
   * Produces the real file, at full size.
   *
   * The export is booked first. This is seconds of arithmetic on a large
   * photograph, and charging afterwards would mean a refused export had already
   * handed over the result.
   */
  const produce = useCallback(
    async (format: Quality["format"]): Promise<{ blob: Blob; canvas: HTMLCanvasElement } | null> => {
      if (!bitmap) return null;
      if (!(await claim())) return null;
      setSaving(true);
      // One beat so the button's own label repaints before the main thread is
      // taken for several seconds.
      await new Promise((resolve) => setTimeout(resolve, 40));
      try {
        const canvas = finalCanvas(bitmap, quality, exposure);
        const blob = await exportCanvas(canvas, format, JPEG_QUALITY, PRINT_DPI);
        return { blob, canvas };
      } finally {
        setSaving(false);
      }
    },
    [bitmap, quality, claim, exposure],
  );

  const onSave = useCallback(async () => {
    setError(null);
    try {
      const output = await produce(quality.format);
      if (!output) return;
      const stem = file ? fileStem(file.name) : "photopoly";
      download(
        output.blob,
        `${stem}-${output.canvas.width}x${output.canvas.height}.${extensionFor(quality.format)}`,
      );
      setMade(`${output.canvas.width} × ${output.canvas.height} · ${formatBytes(output.blob.size)}`);
    } catch {
      setError("Не удалось сохранить файл. Попробуйте увеличение поменьше.");
    }
  }, [produce, quality.format, file]);

  const onPrint = useCallback(async () => {
    setError(null);
    try {
      // PNG, like the editor's print path: a bare raster leaves the driver to
      // guess the colour space, and `exportCanvas` tags it sRGB.
      const output = await produce("image/png");
      if (!output) return;
      await printAtSize(output.blob, printMm(output.canvas.width), printMm(output.canvas.height));
    } catch {
      setError("Не удалось открыть печать.");
    }
  }, [produce]);

  const busy = computing || saving;
  const nothingToDo = idleQuality(quality);

  return (
    <>
      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onFile(chosen);
          // Cleared so choosing the same file twice still fires a change.
          event.target.value = "";
        }}
      />

      {error ?? problem ? (
        <div className="mb-5 flex items-center gap-3 border border-ember/50 bg-ember/12 px-4 py-2.5 rounded-lg">
          <span className="text-[12px] text-safe font-medium">Xato</span>
          <p className="text-[12px] text-chalk">{error ?? problem}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              clearProblem();
            }}
            className="ml-auto text-[12px] text-ash transition-colors hover:text-safe tabular-nums"
          >
            yopish
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          className="min-w-0 bg-slab p-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) onFile(dropped);
          }}
        >
          <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented
              ariaLabel="Что показывать"
              value={view}
              options={[
                { value: "fit" as const, label: "Целиком", title: "Весь кадр, уменьшенный под экран" },
                { value: "crop" as const, label: "1:1", title: "Пиксели результата без уменьшения" },
              ]}
              onChange={setView}
            />
            <span className="text-[12px] text-dust font-medium">
              {computing
                ? "Считаем…"
                : view === "fit"
                  ? "Экспозиция и цвет"
                  : "Зерно, резкость, увеличение"}
            </span>
            {bitmap ? (
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="ml-auto text-[12px] text-dust underline underline-offset-4 transition-colors hover:text-chalk font-medium"
              >
                Другое фото
              </button>
            ) : null}
          </header>

          <div ref={wrapRef} className="flex justify-center">
            {bitmap && pair ? (
              <div
                ref={stageRef}
                className="relative select-none overflow-hidden border border-line bg-pit rounded-lg"
                style={{ width: box.w, height: box.h }}
                onPointerDown={(event) => {
                  if (view === "fit") pickFocus(event.clientX, event.clientY);
                }}
              >
                <canvas
                  ref={beforeRef}
                  role="img"
                  aria-label="Снимок как он есть"
                  className="absolute inset-0 h-full w-full"
                />
                <canvas
                  ref={afterRef}
                  role="img"
                  aria-label="Снимок после улучшения"
                  className="absolute inset-0 h-full w-full"
                  style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                />

                {view === "fit" && window1to1 && source ? (
                  <div
                    aria-hidden
                    title="Этот участок показывает «1:1»"
                    className="pointer-events-none absolute border border-dashed border-ember/80 rounded-lg"
                    style={{
                      left: `${(window1to1.x / source.w) * 100}%`,
                      top: `${(window1to1.y / source.h) * 100}%`,
                      width: `${(window1to1.w / source.w) * 100}%`,
                      height: `${(window1to1.h / source.h) * 100}%`,
                    }}
                  />
                ) : null}

                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-px bg-safe/70"
                  style={{ left: `${split}%` }}
                />
                <button
                  type="button"
                  role="slider"
                  aria-label="Сравнение: до и после"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(split)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(true);
                  }}
                  onPointerMove={(event) => {
                    if (dragging) moveSplit(event.clientX);
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setDragging(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft") setSplit((s) => Math.max(0, s - 5));
                    if (event.key === "ArrowRight") setSplit((s) => Math.min(100, s + 5));
                  }}
                  style={{ left: `${split}%` }}
                  className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center border border-safe bg-ink/85 text-[12px] text-safe-soft tabular-nums rounded-lg"
                >
                  ↔
                </button>

                <span className="pointer-events-none absolute bottom-0 left-0 bg-ink/75 px-2 py-1 text-[12px] text-dust font-medium">
                  Как было
                </span>
                <span className="pointer-events-none absolute right-0 bottom-0 bg-ink/75 px-2 py-1 text-[12px] text-safe-soft font-medium">
                  Как станет
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="flex min-h-72 w-full flex-col items-center justify-center gap-3 border border-dashed border-line bg-pit px-6 text-center transition-colors hover:border-safe/50 rounded-lg"
              >
                <span className="font-display text-[22px] text-chalk font-semibold tracking-tight">
                  {file ? "Открываем…" : "Перетащите фото сюда"}
                </span>
                <span className="text-[12px] text-dust font-medium">
                  или нажмите, чтобы выбрать файл
                </span>
                <span className="max-w-sm text-[12px] leading-relaxed text-ash">
                  Снимок не уходит ни на какой сервер — вся обработка идёт на этом
                  устройстве.
                </span>
              </button>
            )}
          </div>

          {bitmap ? (
            <p className="mt-3 text-[11px] leading-relaxed text-dust">
              {view === "fit"
                ? "Потяните ползунок в центре, чтобы сравнить. Нажмите на кадр — пунктир покажет, какой участок смотрит «1:1»."
                : quality.scale > 1
                  ? `Участок кадра, увеличенный в ${quality.scale} раза: слева — как это сделал бы браузер, справа — как делаем мы. Экспозиция взята по всему снимку, а не по этому кусочку.`
                  : "Пиксели результата без уменьшения — единственный честный вид для зерна и резкости. Экспозиция взята по всему снимку, а не по этому кусочку."}
            </p>
          ) : null}
        </section>

        <aside className="space-y-6 bg-slab p-5">
          <div className="space-y-4">
            <Slider
              label="Экспозиция"
              value={quality.tone}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(quality.tone * 100)}%`}
              onReset={
                quality.tone === DEFAULTS.tone ? undefined : () => patch({ tone: DEFAULTS.tone })
              }
              onChange={(tone) => patch({ tone })}
            />
            <Slider
              label="Шум"
              value={quality.denoise}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(quality.denoise * 100)}%`}
              onReset={
                quality.denoise === DEFAULTS.denoise
                  ? undefined
                  : () => patch({ denoise: DEFAULTS.denoise })
              }
              onChange={(denoise) => patch({ denoise })}
            />
            <p className="-mt-2 text-[12px] leading-snug text-dust">
              Убирает цветные пятна и квадраты от сжатия. Сильнее — чище, но
              цвет начинает затекать за границы. Проверяйте на «1:1».
            </p>
            <Slider
              label="Резкость"
              value={quality.sharpen}
              min={0}
              max={1}
              step={0.05}
              display={`${Math.round(quality.sharpen * 100)}%`}
              onReset={
                quality.sharpen === DEFAULTS.sharpen
                  ? undefined
                  : () => patch({ sharpen: DEFAULTS.sharpen })
              }
              onChange={(sharpen) => patch({ sharpen })}
            />
            <div className="border-t border-line pt-3">
              <Toggle
                label="Убрать цветной оттенок"
                checked={quality.balance}
                onChange={(balance) => patch({ balance })}
              />
              <p className="mt-1.5 text-[12px] leading-snug text-dust">
                Для снимков под жёлтой лампой. Выключено не случайно: это
                догадка по среднему цвету кадра, и на снимке, который и правда
                одного цвета, она ошибается.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Увеличение</Label>
            <Segmented
              ariaLabel="Увеличение"
              value={String(quality.scale)}
              options={SCALES.map((scale) => ({
                value: String(scale),
                label: `×${scale}`,
                title: scale === 1 ? "Оставить как есть" : `В ${scale} раза больше по каждой стороне`,
              }))}
              onChange={(value) => patch({ scale: Number(value) })}
            />
            <p className="text-[12px] leading-snug text-dust">
              Больше пикселей — не больше деталей. Увеличение нужно, когда мелкий
              снимок печатают крупно.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-line pt-4">
            <Stat label="Было" value={source ? `${source.w} × ${source.h}` : "—"} />
            <Stat label="Станет" value={result ? `${result.w} × ${result.h}` : "—"} />
            <Stat
              label="На бумаге"
              value={result ? describeMm(result.w, result.h) : "—"}
            />
            {result?.capped ? (
              <p className="pt-1 text-[12px] leading-snug text-safe-soft">
                До ×{quality.scale} здесь не дойти: сторона упирается в предел
                в {EDGE_LIMIT} пикселей, поэтому увеличение урезано — пропорции
                сохранены.
              </p>
            ) : null}
            {made ? (
              <p className="pt-1 text-[12px] text-dust tabular-nums">Сохранено: {made}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Формат файла</Label>
            <Segmented
              ariaLabel="Формат файла"
              value={quality.format}
              options={[
                { value: "image/jpeg" as const, label: "JPEG", title: "Небольшой файл, для печати достаточно" },
                { value: "image/png" as const, label: "PNG", title: "Без потерь, файл заметно больше" },
              ]}
              onChange={(format) => patch({ format })}
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button type="button" onClick={onSave} disabled={!bitmap || busy || nothingToDo}>
              {saving ? "Готовим файл…" : "Скачать"}
            </Button>
            <Button
              tone="ghost"
              type="button"
              onClick={onPrint}
              disabled={!bitmap || busy || nothingToDo}
            >
              Печать
            </Button>
            <p className="text-[12px] text-dust tabular-nums">
              {nothingToDo
                ? "Все ползунки на нуле — улучшать нечего."
                : entitlement
                  ? `${describeQuota(entitlement)} · один файл — один экспорт`
                  : "Один файл — один экспорт"}
            </p>
          </div>

          <Notice>
            Ничего не дорисовывает — только то, что уже есть на снимке. Лицо
            остаётся тем же лицом, поэтому результат годится и для документов.
          </Notice>
        </aside>
      </div>

      {blocked ? (
        <QuotaWall entitlement={entitlement} onClose={dismiss} stayLabel="Остаться здесь" />
      ) : null}
    </>
  );
}
