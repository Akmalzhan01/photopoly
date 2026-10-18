"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { download, exportCanvas, extensionFor, fileStem, formatBytes } from "@/lib/imaging";
import { erase, loadEraser, MAX_EDGE } from "@/lib/inpaint";
import { stageBox } from "@/lib/stage";
import { useExports } from "@/lib/use-exports";
import { guestCopy } from "@/lib/guest";
import { describeQuota } from "@/lib/entitlement-view";
import { Button, Notice } from "@/components/site/ui";
import { Label, Slider } from "@/components/ui";
import { QuotaWall } from "@/components/QuotaWall";
import { GuestHint } from "@/components/GuestHint";

const MAX_STAGE = 620;
const JPEG_QUALITY = 0.95;
const PRINT_DPI = 300;
/** Undo steps kept. Each is a full-size bitmap, so this is a memory budget. */
const HISTORY = 15;

export function EraserStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [shrunk, setShrunk] = useState(false);
  /** Brush diameter in screen pixels, so it feels the same on any photo. */
  const [brush, setBrush] = useState(40);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [working, setWorking] = useState<"loading" | "erasing" | null>(null);
  const [comparing, setComparing] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const { entitlement, blocked, dismiss, claim, guest, problem, clearProblem } = useExports();

  const imageRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const undoRef = useRef<ImageBitmap[]>([]);
  const redoRef = useRef<ImageBitmap[]>([]);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const clearHistory = () => {
    for (const bitmap of [...undoRef.current, ...redoRef.current]) bitmap.close();
    undoRef.current = [];
    redoRef.current = [];
    setUndoCount(0);
    setRedoCount(0);
  };

  const onFile = useCallback((next: File) => {
    setError(null);
    setMade(null);
    setFile(next);
  }, []);

  // Decode, cap the size, and lay the photo onto the working and original canvases.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    createImageBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        const ratio = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
        const w = Math.max(1, Math.round(bitmap.width * ratio));
        const h = Math.max(1, Math.round(bitmap.height * ratio));
        for (const canvas of [imageRef.current, originalRef.current, maskRef.current]) {
          if (!canvas) continue;
          canvas.width = w;
          canvas.height = h;
        }
        for (const canvas of [imageRef.current, originalRef.current]) {
          const ctx = canvas?.getContext("2d", { willReadFrequently: true });
          if (!ctx) continue;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, 0, 0, w, h);
        }
        bitmap.close();
        clearHistory();
        setShrunk(ratio < 1);
        setSize({ w, h });
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть этот файл. Выберите другое фото.");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Fetch the model while the person is still deciding where to paint.
  useEffect(() => {
    if (size) loadEraser().catch(() => undefined);
  }, [size]);

  useEffect(() => () => clearHistory(), []);

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

  const box = stageBox(room || 640, size ? size.w / size.h : 4 / 3, MAX_STAGE);
  /** Image pixels per screen pixel. */
  const scale = size ? size.w / box.w : 1;

  const toImage = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * (size?.w ?? 1),
      y: ((event.clientY - rect.top) / rect.height) * (size?.h ?? 1),
    };
  };

  const paint = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = maskRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#2563eb";
    ctx.fillStyle = "#2563eb";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brush * scale;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const clearMask = () => {
    const mask = maskRef.current;
    mask?.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
  };

  const pushUndo = async () => {
    const image = imageRef.current;
    if (!image) return;
    undoRef.current.push(await createImageBitmap(image));
    while (undoRef.current.length > HISTORY) undoRef.current.shift()?.close();
    for (const bitmap of redoRef.current) bitmap.close();
    redoRef.current = [];
    setUndoCount(undoRef.current.length);
    setRedoCount(0);
  };

  const run = useCallback(async () => {
    const image = imageRef.current;
    const mask = maskRef.current;
    if (!image || !mask) return;
    setError(null);
    setMade(null);
    try {
      setWorking("loading");
      await loadEraser();
      setWorking("erasing");
      // A beat so the overlay paints before the main thread is busy.
      await new Promise((resolve) => setTimeout(resolve, 30));
      const filled = await erase(image, mask);
      await pushUndo();
      image.getContext("2d")!.putImageData(filled, 0, 0);
    } catch {
      setError("Не удалось стереть. Проверьте подключение и попробуйте снова.");
    } finally {
      clearMask();
      setWorking(null);
    }
  }, []);

  const step = async (from: React.RefObject<ImageBitmap[]>, to: React.RefObject<ImageBitmap[]>) => {
    const image = imageRef.current;
    const bitmap = from.current.pop();
    if (!image || !bitmap) return;
    to.current.push(await createImageBitmap(image));
    const ctx = image.getContext("2d")!;
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    setUndoCount(undoRef.current.length);
    setRedoCount(redoRef.current.length);
    setMade(null);
  };

  const undo = () => step(undoRef, redoRef);
  const redo = () => step(redoRef, undoRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || working) return;
      event.preventDefault();
      if (event.shiftKey) void redo();
      else void undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const format = file?.type === "image/png" || file?.type === "image/webp" ? "image/png" : "image/jpeg";

  const onSave = useCallback(async () => {
    const image = imageRef.current;
    if (!image) return;
    setError(null);
    if (!guest && !(await claim())) return;
    setSaving(true);
    try {
      const output = guest ? guestCopy(image) : image;
      const blob = await exportCanvas(output, format, JPEG_QUALITY, PRINT_DPI);
      const stem = file ? fileStem(file.name) : "photopoly";
      download(blob, `${stem}-ochishcheno.${extensionFor(format)}`);
      setMade(`${output.width} × ${output.height} · ${formatBytes(blob.size)}`);
    } catch {
      setError("Не удалось сохранить файл.");
    } finally {
      setSaving(false);
    }
  }, [claim, guest, file, format]);

  const reset = async () => {
    const image = imageRef.current;
    const original = originalRef.current;
    if (!image || !original || undoCount === 0) return;
    await pushUndo();
    const ctx = image.getContext("2d")!;
    ctx.clearRect(0, 0, image.width, image.height);
    ctx.drawImage(original, 0, 0);
  };

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section
          className="min-w-0 rounded-xl border border-line bg-slab p-4 shadow-card sm:p-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) onFile(dropped);
          }}
        >
          {size ? (
            <header className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={undoCount === 0 || working !== null}
                title="Отменить (Ctrl+Z)"
                className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
              >
                ↶ Отменить
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={redoCount === 0 || working !== null}
                title="Вернуть (Ctrl+Shift+Z)"
                className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
              >
                ↷ Вернуть
              </button>
              <button
                type="button"
                onPointerDown={() => setComparing(true)}
                onPointerUp={() => setComparing(false)}
                onPointerLeave={() => setComparing(false)}
                disabled={undoCount === 0}
                className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
              >
                Сравнить (удерживать)
              </button>
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                disabled={working !== null}
                className="ml-auto text-[13px] font-medium text-safe-soft hover:underline disabled:opacity-40"
              >
                Другое фото
              </button>
            </header>
          ) : null}

          <div ref={wrapRef} className="flex min-w-0 justify-center">
            <div
              className={`checkerboard relative overflow-hidden rounded-lg border border-line select-none ${size ? "" : "hidden"}`}
              style={{ width: box.w, height: box.h, cursor: working ? "progress" : "none" }}
            >
              <canvas ref={imageRef} className="absolute inset-0 h-full w-full" role="img" aria-label="Фото" />
              <canvas
                ref={originalRef}
                aria-hidden
                className="absolute inset-0 h-full w-full"
                style={{ visibility: comparing ? "visible" : "hidden" }}
              />
              <canvas
                ref={maskRef}
                aria-label="Закрасьте то, что нужно убрать"
                className="absolute inset-0 h-full w-full touch-none opacity-50"
                onPointerDown={(event) => {
                  if (working || !size) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const at = toImage(event);
                  drawingRef.current = at;
                  paint(at, at);
                }}
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  // A finger hides what it touches and never "leaves", so the
                  // ring would stay behind after every stroke.
                  if (event.pointerType !== "touch") {
                    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                  }
                  if (!drawingRef.current) return;
                  const at = toImage(event);
                  paint(drawingRef.current, at);
                  drawingRef.current = at;
                }}
                onPointerUp={(event) => {
                  if (!drawingRef.current) return;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  drawingRef.current = null;
                  void run();
                }}
                onPointerLeave={() => setCursor(null)}
              />
              {cursor && !working ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
                  style={{
                    width: brush,
                    height: brush,
                    left: cursor.x - brush / 2,
                    top: cursor.y - brush / 2,
                  }}
                />
              ) : null}
              {working ? (
                <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                  <span className="flex items-center gap-2 rounded-full bg-ink/85 px-3.5 py-1.5 text-[13px] font-medium text-chalk shadow-card">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-safe" />
                    {working === "loading" ? "Загружаем нейросеть (~30 МБ, один раз)…" : "Стираем…"}
                  </span>
                </div>
              ) : null}
            </div>

            {size ? null : (
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
                  Нейросеть работает прямо в браузере — фото не уходит ни на какой
                  сервер.
                </span>
              </button>
            )}
          </div>

          {size ? (
            <p className="mt-3 text-[13px] text-dust">
              Закрасьте кистью то, что нужно убрать, — стирается, как только вы
              отпустите кнопку. Можно повторять, пока не станет чисто.
              {shrunk ? ` Фото уменьшено до ${size.w} × ${size.h}, чтобы работать быстро.` : ""}
            </p>
          ) : null}
        </section>

        <aside className="space-y-5 rounded-xl border border-line bg-slab p-5 shadow-card">
          <Slider
            label="Размер кисти"
            value={brush}
            min={8}
            max={160}
            step={2}
            display={`${brush} px`}
            onChange={setBrush}
          />

          <div className="space-y-2 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <Label>Правок</Label>
              <span className="text-[14px] text-chalk tabular-nums">{undoCount}</span>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={undoCount === 0 || working !== null}
              className="text-[13px] font-medium text-dust transition-colors enabled:hover:text-chalk disabled:opacity-40"
            >
              Вернуть исходное фото
            </button>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button
              type="button"
              className="w-full py-3 text-[15px]"
              onClick={onSave}
              disabled={!size || undoCount === 0 || saving || working !== null}
            >
              {saving ? "Готовим файл…" : `Скачать ${format === "image/png" ? "PNG" : "JPG"}`}
            </Button>
            {guest ? (
              <GuestHint saved={made} />
            ) : (
              <p className="text-[13px] text-dust">
                {made
                  ? `Сохранено: ${made}`
                  : entitlement
                    ? `${describeQuota(entitlement)} · один файл — один экспорт`
                    : "Один файл — один экспорт"}
              </p>
            )}
          </div>

          <Notice>
            Лучше всего убирает мелкие и средние предметы на однородном фоне:
            провода, прохожих, мусор, надписи, пятна. Крупные объекты на сложном
            фоне иногда требуют пары повторов.
          </Notice>
        </aside>
      </div>

      {blocked ? (
        <QuotaWall entitlement={entitlement} onClose={dismiss} stayLabel="Остаться здесь" />
      ) : null}
    </>
  );
}
