"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { download, exportCanvas, extensionFor, fileStem, formatBytes, type ExportFormat } from "@/lib/imaging";
import { describeMm, stageBox } from "@/lib/quality";
import {
  loadUpscaler,
  refusal,
  tileCount,
  upscale,
  upscaledSize,
  UPSCALE_FACTORS,
  type Progress,
  type UpscaleFactor,
} from "@/lib/upscale";
import { useExports } from "@/lib/use-exports";
import { drawWatermark } from "@/lib/watermark";
import { describeQuota } from "@/lib/entitlement-view";
import { Button, Notice } from "@/components/site/ui";
import { Label, Segmented } from "@/components/ui";
import { QuotaWall } from "@/components/QuotaWall";

const MAX_STAGE = 560;
const JPEG_QUALITY = 0.95;
const PRINT_DPI = 300;

type View = "fit" | "zoom";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label>{label}</Label>
      <span className="text-[14px] text-chalk tabular-nums">{value}</span>
    </div>
  );
}

function seconds(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${s % 60} с`;
}

export function UpscaleStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [factor, setFactor] = useState<UpscaleFactor>(4);
  const [result, setResult] = useState<{ canvas: HTMLCanvasElement; factor: UpscaleFactor } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [working, setWorking] = useState<"loading" | "running" | null>(null);
  const [view, setView] = useState<View>("fit");
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("image/jpeg");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { entitlement, allowed, blocked, dismiss, claim, problem, clearProblem } = useExports();

  const pickerRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((next: File) => {
    abortRef.current?.abort();
    setError(null);
    setMade(null);
    setResult(null);
    setProgress(null);
    setView("fit");
    setSplit(50);
    // A PNG or WebP may well be transparent, and JPEG would fill that with black.
    setFormat(next.type === "image/png" || next.type === "image/webp" ? "image/png" : "image/jpeg");
    setFile(next);
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let opened: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((decoded) => {
        opened = decoded;
        if (!cancelled) setBitmap(decoded);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть этот файл. Выберите другое фото.");
      });
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [file]);

  // Start fetching the runtime and the weights as soon as there is a photo, so
  // most of the wait is over by the time the button is pressed.
  useEffect(() => {
    if (bitmap) loadUpscaler().catch(() => undefined);
  }, [bitmap]);

  useEffect(() => () => abortRef.current?.abort(), []);

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

  const source = bitmap ? { w: bitmap.width, h: bitmap.height } : null;
  const target = source ? upscaledSize(source, factor) : null;
  const refused = source ? refusal(source, factor) : null;
  const box = stageBox(room || 640, source ? source.w / source.h : 4 / 3, MAX_STAGE);

  const run = useCallback(async () => {
    if (!bitmap) return;
    setError(null);
    setMade(null);
    const controller = new AbortController();
    abortRef.current = controller;
    let phase: "loading" | "running" = "loading";
    try {
      setWorking(phase);
      await loadUpscaler();
      phase = "running";
      setWorking(phase);
      setProgress({ done: 0, total: tileCount({ w: bitmap.width, h: bitmap.height }), elapsed: 0, backend: "wasm" });
      const canvas = await upscale(bitmap, factor, setProgress, controller.signal);
      setResult({ canvas, factor });
      setView("zoom");
    } catch (caught) {
      if ((caught as Error)?.name !== "AbortError") {
        setError(
          phase === "loading"
            ? "Не удалось загрузить нейросеть. Проверьте подключение и попробуйте снова."
            : "Не удалось увеличить фото. Попробуйте ×2 или снимок поменьше.",
        );
      }
    } finally {
      setWorking(null);
      setProgress(null);
      abortRef.current = null;
    }
  }, [bitmap, factor]);

  /** Both sides of the comparison, drawn at the stage's own resolution. */
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!bitmap || room === 0) return;
    const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(box.w * dpr);
    const bh = Math.round(box.h * dpr);
    const paint = (element: HTMLCanvasElement | null, draw: (ctx: CanvasRenderingContext2D) => void) => {
      if (!element) return;
      element.width = bw;
      element.height = bh;
      const ctx = element.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      draw(ctx);
    };

    if (view === "zoom" && result) {
      // A window of the result at one pixel per pixel, and the same window of
      // the original enlarged the ordinary way — the honest comparison.
      const scale = result.factor;
      const rw = Math.min(bw, result.canvas.width);
      const rh = Math.min(bh, result.canvas.height);
      const rx = Math.max(0, Math.min(result.canvas.width - rw, focus.x * result.canvas.width - rw / 2));
      const ry = Math.max(0, Math.min(result.canvas.height - rh, focus.y * result.canvas.height - rh / 2));
      paint(beforeRef.current, (ctx) =>
        ctx.drawImage(bitmap, rx / scale, ry / scale, rw / scale, rh / scale, 0, 0, bw, bh),
      );
      paint(afterRef.current, (ctx) => ctx.drawImage(result.canvas, rx, ry, rw, rh, 0, 0, bw, bh));
    } else {
      paint(beforeRef.current, (ctx) => ctx.drawImage(bitmap, 0, 0, bw, bh));
      paint(afterRef.current, (ctx) => ctx.drawImage(result?.canvas ?? bitmap, 0, 0, bw, bh));
    }
    // The file itself is refused by `claim()`; this stops the comparison from
    // simply being screenshotted instead.
    const after = afterRef.current;
    if (result && !allowed && after) {
      const ctx = after.getContext("2d");
      if (ctx) drawWatermark(ctx, after.width, after.height);
    }
  }, [bitmap, result, view, focus, room, box.w, box.h, allowed]);

  const stageRef = useRef<HTMLDivElement>(null);
  const moveSplit = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onSave = useCallback(async () => {
    if (!result) return;
    setError(null);
    if (!(await claim())) return;
    setSaving(true);
    try {
      const blob = await exportCanvas(result.canvas, format, JPEG_QUALITY, PRINT_DPI);
      const stem = file ? fileStem(file.name) : "photopoly";
      download(blob, `${stem}-x${result.factor}.${extensionFor(format)}`);
      setMade(`${result.canvas.width} × ${result.canvas.height} · ${formatBytes(blob.size)}`);
    } catch {
      setError("Не удалось сохранить файл.");
    } finally {
      setSaving(false);
    }
  }, [result, claim, format, file]);

  const stale = result !== null && result.factor !== factor;
  const busy = working !== null || saving;
  const percent = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const remaining =
    progress && progress.done > 0
      ? (progress.elapsed / progress.done) * (progress.total - progress.done)
      : null;

  /** Where the zoomed window sits, drawn over the whole frame as a guide. */
  const guide =
    result && view === "fit"
      ? (() => {
          const fw = Math.min(1, (box.w * Math.min(2, window.devicePixelRatio || 1)) / result.canvas.width);
          const fh = Math.min(1, (box.h * Math.min(2, window.devicePixelRatio || 1)) / result.canvas.height);
          return {
            left: Math.max(0, Math.min(1 - fw, focus.x - fw / 2)),
            top: Math.max(0, Math.min(1 - fh, focus.y - fh / 2)),
            width: fw,
            height: fh,
          };
        })()
      : null;

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
          event.target.value = "";
        }}
      />

      {error ?? problem ? (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-ember/30 bg-ember/8 px-4 py-2.5">
          <p className="text-[14px] text-ember">{error ?? problem}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              clearProblem();
            }}
            className="ml-auto text-[13px] font-medium text-ash transition-colors hover:text-chalk"
          >
            Закрыть
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          className="min-w-0 rounded-xl border border-line bg-slab p-4 shadow-card sm:p-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) onFile(dropped);
          }}
        >
          {bitmap ? (
            <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Segmented
                ariaLabel="Что показывать"
                value={view}
                options={[
                  { value: "fit" as const, label: "Целиком", title: "Весь кадр, уменьшенный под экран" },
                  { value: "zoom" as const, label: "Крупно", title: "Пиксели результата без уменьшения" },
                ]}
                onChange={(next) => setView(result ? next : "fit")}
              />
              <span className="text-[13px] text-dust">
                {result
                  ? view === "fit"
                    ? "Нажмите на кадр, чтобы выбрать участок для «Крупно»"
                    : "Слева — обычное увеличение, справа — нейросеть"
                  : "Сначала нажмите «Увеличить»"}
              </span>
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                disabled={working !== null}
                className="ml-auto text-[13px] font-medium text-safe-soft transition-colors hover:underline disabled:opacity-40"
              >
                Другое фото
              </button>
            </header>
          ) : null}

          <div ref={wrapRef} className="flex min-w-0 justify-center">
            {bitmap ? (
              <div
                ref={stageRef}
                className="relative overflow-hidden rounded-lg border border-line bg-pit select-none checkerboard"
                style={{ width: box.w, height: box.h }}
                onPointerDown={(event) => {
                  if (!result || view !== "fit") return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  setFocus({
                    x: (event.clientX - rect.left) / rect.width,
                    y: (event.clientY - rect.top) / rect.height,
                  });
                  setView("zoom");
                }}
              >
                <canvas ref={beforeRef} role="img" aria-label="Исходное фото" className="absolute inset-0 h-full w-full" />
                <canvas
                  ref={afterRef}
                  role="img"
                  aria-label="Увеличенное фото"
                  className="absolute inset-0 h-full w-full"
                  style={{ clipPath: result ? `inset(0 0 0 ${split}%)` : undefined }}
                />

                {guide ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute rounded-md border-2 border-dashed border-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.3)]"
                    style={{
                      left: `${guide.left * 100}%`,
                      top: `${guide.top * 100}%`,
                      width: `${guide.width * 100}%`,
                      height: `${guide.height * 100}%`,
                    }}
                  />
                ) : null}

                {result ? (
                  <>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.2)]"
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
                      className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full bg-white text-[15px] text-safe shadow-stage"
                    >
                      ↔
                    </button>
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[12px] font-medium text-white">
                      Было
                    </span>
                    <span className="pointer-events-none absolute right-2 bottom-2 rounded-md bg-safe px-2 py-1 text-[12px] font-medium text-white">
                      ИИ ×{result.factor}
                    </span>
                  </>
                ) : null}

                {working ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm">
                    <span className="text-[15px] font-semibold text-chalk">
                      {working === "loading" ? "Загружаем нейросеть…" : `Увеличиваем… ${percent}%`}
                    </span>
                    <div className="h-2 w-56 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full bg-safe transition-[width] duration-300 ${working === "loading" ? "w-1/3 animate-pulse" : ""}`}
                        style={working === "running" ? { width: `${percent}%` } : undefined}
                      />
                    </div>
                    <span className="text-[13px] text-ash">
                      {working === "loading"
                        ? "Первый раз — около 10 МБ, потом из кэша"
                        : remaining !== null
                          ? `Осталось ≈ ${seconds(remaining)} · ${progress?.backend === "webgpu" ? "видеокарта" : "процессор"}`
                          : "Считаем первый фрагмент…"}
                    </span>
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="text-[13px] font-medium text-ash underline-offset-4 hover:text-chalk hover:underline"
                    >
                      Отменить
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="flex min-h-80 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-pit px-6 text-center transition-colors hover:border-safe/60 hover:bg-safe/5"
              >
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-safe/10 text-safe-soft">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 16V4m-5 5 5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                </span>
                <span className="text-[20px] font-semibold text-chalk">
                  {file ? "Открываем…" : "Перетащите фото сюда"}
                </span>
                <span className="text-[14px] text-dust">или нажмите, чтобы выбрать файл · JPG, PNG, WebP</span>
                <span className="max-w-sm text-[13px] leading-relaxed text-ash">
                  Снимок не уходит ни на какой сервер — нейросеть работает прямо в
                  вашем браузере.
                </span>
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-5 rounded-xl border border-line bg-slab p-5 shadow-card">
          <div className="flex flex-col gap-2">
            <Label>Во сколько раз</Label>
            <Segmented
              ariaLabel="Во сколько раз"
              value={String(factor)}
              options={UPSCALE_FACTORS.map((value) => ({
                value: String(value),
                label: `×${value}`,
                title: `В ${value} раза больше по каждой стороне`,
              }))}
              onChange={(value) => setFactor(Number(value) as UpscaleFactor)}
            />
          </div>

          <div className="space-y-2 border-t border-line pt-4">
            <Stat label="Было" value={source ? `${source.w} × ${source.h}` : "—"} />
            <Stat label="Станет" value={target ? `${target.w} × ${target.h}` : "—"} />
            <Stat label="Печать 300 dpi" value={target ? describeMm(target.w, target.h) : "—"} />
          </div>

          {refused ? <Notice tone="warn">{refused}</Notice> : null}

          {!result || stale ? (
            <Button
              type="button"
              className="w-full py-3 text-[15px]"
              onClick={run}
              disabled={!bitmap || busy || refused !== null}
            >
              {working ? "Работаем…" : stale ? `Увеличить ×${factor}` : "Увеличить"}
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Формат файла</Label>
                <Segmented
                  ariaLabel="Формат файла"
                  value={format}
                  options={[
                    { value: "image/jpeg" as const, label: "JPEG", title: "Небольшой файл" },
                    { value: "image/png" as const, label: "PNG", title: "Без потерь, файл больше" },
                  ]}
                  onChange={setFormat}
                />
              </div>
              <Button type="button" className="w-full py-3 text-[15px]" onClick={onSave} disabled={busy}>
                {saving ? "Готовим файл…" : "Скачать"}
              </Button>
              <p className="text-[13px] text-dust">
                {made
                  ? `Сохранено: ${made}`
                  : entitlement
                    ? `${describeQuota(entitlement)} · один файл — один экспорт`
                    : "Один файл — один экспорт"}
              </p>
            </div>
          )}

          <Notice>
            Нейросеть дорисовывает детали, которых на снимке не было: края,
            текстуру, мелкие черты. Для старых и мелких фото это то, что нужно, а
            для фото на документы — нет: лицо может немного измениться.
          </Notice>
        </aside>
      </div>

      {blocked ? (
        <QuotaWall entitlement={entitlement} onClose={dismiss} stayLabel="Остаться здесь" />
      ) : null}
    </>
  );
}
