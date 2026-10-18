"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { removeBackground, type ModelQuality, type Progress } from "@/lib/cutout";
import {
  alphaBounds,
  download,
  exportCanvas,
  extensionFor,
  fileStem,
  formatBytes,
  fullBounds,
  type Source,
} from "@/lib/imaging";
import { applyStrokes, type Stroke } from "@/lib/mask";
import { backdropFormat, composeBackdrop, type Backdrop } from "@/lib/backdrop";
import { stageBox } from "@/lib/stage";
import { useExports } from "@/lib/use-exports";
import { drawWatermark } from "@/lib/watermark";
import { describeQuota } from "@/lib/entitlement-view";
import { Button, Notice } from "@/components/site/ui";
import { ColourPicker, Label, Segmented, Swatch } from "@/components/ui";
import { QuotaWall } from "@/components/QuotaWall";
import { MaskEditor } from "@/components/MaskEditor";

const MAX_STAGE = 560;
const JPEG_QUALITY = 0.95;
const PRINT_DPI = 300;

const COLOURS = [
  { color: "#ffffff", title: "Белый" },
  { color: "#f1f2f4", title: "Светло-серый" },
  { color: "#dbe7f7", title: "Голубой" },
  { color: "#1f2a44", title: "Тёмно-синий" },
  { color: "#000000", title: "Чёрный" },
];

export function BackgroundStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<Source | null>(null);
  const [cutout, setCutout] = useState<{ job: string; source: Source } | null>(null);
  const [model, setModel] = useState<ModelQuality>("fine");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [editing, setEditing] = useState(false);
  const [backdrop, setBackdrop] = useState<Backdrop>({ kind: "transparent" });
  const [custom, setCustom] = useState("#3b82f6");
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const { entitlement, allowed, blocked, dismiss, claim, problem, clearProblem } = useExports();

  const pickerRef = useRef<HTMLInputElement>(null);
  const onFile = useCallback((next: File) => {
    setError(null);
    setMade(null);
    setStrokes([]);
    setSplit(50);
    setFile(next);
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let opened: ImageBitmap | null = null;
    createImageBitmap(file)
      .then((bitmap) => {
        opened = bitmap;
        if (!cancelled) setOriginal({ bitmap, bounds: fullBounds(bitmap) });
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть этот файл. Выберите другое фото.");
      });
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [file]);

  /** One segmentation job: this photo through this model. */
  const job = file ? `${file.name}:${file.size}:${file.lastModified}:${model}` : null;

  useEffect(() => {
    if (!file || !job) return;
    let cancelled = false;
    removeBackground(file, model, (next) => {
      if (!cancelled) setProgress(next);
    })
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        setCutout({ job, source: { bitmap, bounds: alphaBounds(bitmap) } });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(job);
        setError("Не удалось отделить фон. Проверьте интернет и попробуйте снова.");
      })
      .finally(() => {
        if (!cancelled) setProgress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file, job, model]);

  // A cut-out from an earlier job is stale, so "still working" needs no flag.
  const ready = cutout?.job === job ? cutout.source : null;
  const working = Boolean(job && !ready && failed !== job);

  const retouched = useMemo(() => {
    if (!ready || !original) return null;
    return strokes.length === 0
      ? ready.bitmap
      : applyStrokes(ready.bitmap, original.bitmap, strokes);
  }, [ready, original, strokes]);

  const result = useMemo(
    () => (retouched && original ? composeBackdrop(retouched, original.bitmap, backdrop) : null),
    [retouched, original, backdrop],
  );

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

  const size = original ? { w: original.bitmap.width, h: original.bitmap.height } : null;
  const box = stageBox(room || 640, size ? size.w / size.h : 4 / 3, MAX_STAGE);

  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!original || room === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(box.w * dpr);
    const bh = Math.round(box.h * dpr);
    for (const [element, from] of [
      [beforeRef.current, original.bitmap],
      [afterRef.current, result],
    ] as const) {
      if (!element) continue;
      element.width = bw;
      element.height = bh;
      const ctx = element.getContext("2d");
      if (!ctx || !from) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(from, 0, 0, bw, bh);
    }
    const after = afterRef.current;
    if (result && !allowed && after) {
      const ctx = after.getContext("2d");
      if (ctx) drawWatermark(ctx, after.width, after.height);
    }
  }, [original, result, room, box.w, box.h, allowed]);

  const stageRef = useRef<HTMLDivElement>(null);
  const moveSplit = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const format = backdropFormat(backdrop);

  const onSave = useCallback(async () => {
    if (!result) return;
    setError(null);
    if (!(await claim())) return;
    setSaving(true);
    try {
      const blob = await exportCanvas(result, format, JPEG_QUALITY, PRINT_DPI);
      const stem = file ? fileStem(file.name) : "photopoly";
      download(blob, `${stem}-bez-fona.${extensionFor(format)}`);
      setMade(`${result.width} × ${result.height} · ${formatBytes(blob.size)}`);
    } catch {
      setError("Не удалось сохранить файл.");
    } finally {
      setSaving(false);
    }
  }, [result, claim, format, file]);

  const percent = progress ? Math.round(progress.ratio * 100) : 0;
  const isColour = (colour: string) => backdrop.kind === "colour" && backdrop.colour === colour;

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
          {failed === job ? (
            <button
              type="button"
              onClick={() => {
                setFailed(null);
                setError(null);
                // A new File object is a new job key, which reruns the model.
                if (file) setFile(new File([file], file.name, { type: file.type, lastModified: Date.now() }));
              }}
              className="text-[13px] font-medium text-safe-soft hover:underline"
            >
              Повторить
            </button>
          ) : null}
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
          {original ? (
            <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[13px] text-dust">
                {result ? "Потяните ползунок, чтобы сравнить" : "Отделяем человека от фона…"}
              </span>
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="ml-auto text-[13px] font-medium text-safe-soft transition-colors hover:underline"
              >
                Другое фото
              </button>
            </header>
          ) : null}

          <div ref={wrapRef} className="flex min-w-0 justify-center">
            {original ? (
              <div
                ref={stageRef}
                className="checkerboard relative overflow-hidden rounded-lg border border-line select-none"
                style={{ width: box.w, height: box.h }}
              >
                <canvas ref={beforeRef} role="img" aria-label="Исходное фото" className="absolute inset-0 h-full w-full" />
                <canvas
                  ref={afterRef}
                  role="img"
                  aria-label="Фото без фона"
                  className="absolute inset-0 h-full w-full"
                  style={{ clipPath: `inset(0 0 0 ${split}%)`, visibility: result ? "visible" : "hidden" }}
                />

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
                      Без фона
                    </span>
                  </>
                ) : null}

                {working ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm">
                    <span className="text-[15px] font-semibold text-chalk">
                      {progress?.label ?? "Подготовка"}
                      {progress && progress.ratio > 0 ? `… ${percent}%` : "…"}
                    </span>
                    <div className="h-2 w-56 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full bg-safe transition-[width] duration-300 ${progress && progress.ratio > 0 ? "" : "w-1/3 animate-pulse"}`}
                        style={progress && progress.ratio > 0 ? { width: `${percent}%` } : undefined}
                      />
                    </div>
                    <span className="text-[13px] text-ash">
                      В первый раз загружается нейросеть, потом — из кэша
                    </span>
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
                  Фон убирается автоматически, прямо в вашем браузере — фото не
                  уходит ни на какой сервер.
                </span>
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-5 rounded-xl border border-line bg-slab p-5 shadow-card">
          <div className="flex flex-col gap-2">
            <Label>Новый фон</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Swatch
                color="transparent"
                title="Прозрачный"
                active={backdrop.kind === "transparent"}
                onClick={() => setBackdrop({ kind: "transparent" })}
              />
              {COLOURS.map((swatch) => (
                <Swatch
                  key={swatch.color}
                  color={swatch.color}
                  title={swatch.title}
                  active={isColour(swatch.color)}
                  onClick={() => setBackdrop({ kind: "colour", colour: swatch.color })}
                />
              ))}
              <ColourPicker
                value={custom}
                onChange={(colour) => {
                  setCustom(colour);
                  setBackdrop({ kind: "colour", colour });
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setBackdrop({ kind: "blur" })}
              aria-pressed={backdrop.kind === "blur"}
              className={`mt-1 rounded-lg border px-3 py-2 text-left text-[14px] font-medium transition-colors ${
                backdrop.kind === "blur"
                  ? "border-safe bg-safe/10 text-safe-soft"
                  : "border-line text-ash hover:border-line-lit hover:text-chalk"
              }`}
            >
              Размыть исходный фон
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Label>Точность</Label>
            <Segmented
              ariaLabel="Точность"
              value={model}
              options={[
                { value: "fast" as const, label: "Быстро", title: "Меньше загрузка" },
                { value: "fine" as const, label: "Точно", title: "Чистые края" },
              ]}
              onChange={setModel}
            />
            <button
              type="button"
              disabled={!ready || !original}
              onClick={() => setEditing(true)}
              className="mt-1 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[14px] font-medium text-chalk transition-colors enabled:hover:border-line-lit enabled:hover:bg-riser disabled:cursor-not-allowed disabled:opacity-40"
            >
              Поправить края кистью
              <span className="text-[13px] font-normal text-dust tabular-nums">
                {strokes.length > 0 ? `${strokes.length} правок` : ""}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button
              type="button"
              className="w-full py-3 text-[15px]"
              onClick={onSave}
              disabled={!result || saving}
            >
              {saving ? "Готовим файл…" : `Скачать ${format === "image/png" ? "PNG" : "JPG"}`}
            </Button>
            <p className="text-[13px] text-dust">
              {made
                ? `Сохранено: ${made}`
                : entitlement
                  ? `${describeQuota(entitlement)} · один файл — один экспорт`
                  : "Один файл — один экспорт"}
            </p>
          </div>

          <Notice>
            Прозрачный фон сохраняется в PNG, цветной и размытый — в JPG. Для фото
            на документы с точным размером есть{" "}
            <Link href="/studio" className="font-medium text-safe-soft hover:underline">
              редактор
            </Link>
            .
          </Notice>
        </aside>
      </div>

      {blocked ? (
        <QuotaWall entitlement={entitlement} onClose={dismiss} stayLabel="Остаться здесь" />
      ) : null}

      {editing && original && ready ? (
        <MaskEditor
          original={original}
          cutout={ready}
          strokes={strokes}
          onCommit={(next) => {
            setStrokes(next);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
