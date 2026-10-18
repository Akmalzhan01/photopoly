"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { download, formatBytes } from "@/lib/imaging";
import {
  decode,
  encode,
  fittedSize,
  looksHeic,
  MAX_EDGES,
  outputName,
  zipFiles,
  type ConvertOptions,
  type OutputFormat,
} from "@/lib/convert";
import { Button, Notice } from "@/components/site/ui";
import { Label, Segmented, Slider } from "@/components/ui";

/** Enough for a shop's batch, few enough that a phone's memory survives it. */
const MAX_FILES = 50;

type Item = {
  id: string;
  file: File;
  status: "waiting" | "working" | "done" | "error";
  /** The options the result was made with, to know when it is stale. */
  madeWith?: string;
  result?: { blob: Blob; url: string; w: number; h: number; name: string };
  error?: string;
};

const FORMAT_LABEL: Record<OutputFormat, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

function key(options: ConvertOptions): string {
  return `${options.format}|${options.format === "image/png" ? "-" : options.quality}|${options.maxEdge ?? "orig"}`;
}

function saving(before: number, after: number): string {
  const change = Math.round((1 - after / Math.max(1, before)) * 100);
  return change > 0 ? `−${change}%` : change < 0 ? `+${-change}%` : "0%";
}

export function ConvertStudio() {
  const [items, setItems] = useState<Item[]>([]);
  const [options, setOptions] = useState<ConvertOptions>({
    format: "image/jpeg",
    quality: 0.85,
    maxEdge: null,
  });
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Object URLs hold the converted files in memory until they are revoked.
  useEffect(
    () => () => {
      for (const item of itemsRef.current) if (item.result) URL.revokeObjectURL(item.result.url);
    },
    [],
  );

  const add = useCallback((list: FileList | File[]) => {
    const incoming = [...list].filter((file) => file.type.startsWith("image/") || looksHeic(file));
    const room = Math.max(0, MAX_FILES - itemsRef.current.length);
    setNotice(
      incoming.length > room ? `За один раз — не больше ${MAX_FILES} файлов. Лишние не добавлены.` : null,
    );
    const fresh = incoming.slice(0, room).map((file) => ({
      id: `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2)}`,
      file,
      status: "waiting" as const,
    }));
    itemsRef.current = [...itemsRef.current, ...fresh];
    setItems(itemsRef.current);
  }, []);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const wanted = key(options);
  const pending = items.filter((item) => item.status !== "working" && item.madeWith !== wanted);
  const done = items.filter((item) => item.status === "done" && item.madeWith === wanted);

  /** One file at a time: decoding several 12 MP photos at once is how a phone tab dies. */
  const run = useCallback(async () => {
    setRunning(true);
    const snapshot = { ...options };
    const made = key(snapshot);
    for (const item of itemsRef.current) {
      if (item.madeWith === made) continue;
      update(item.id, { status: "working", error: undefined });
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await decode(item.file);
        const blob = await encode(bitmap, snapshot);
        const size = fittedSize(bitmap.width, bitmap.height, snapshot.maxEdge);
        if (item.result) URL.revokeObjectURL(item.result.url);
        update(item.id, {
          status: "done",
          madeWith: made,
          result: {
            blob,
            url: URL.createObjectURL(blob),
            w: size.w,
            h: size.h,
            name: outputName(item.file, snapshot.format),
          },
        });
      } catch (caught) {
        const message = (caught as Error)?.message;
        update(item.id, {
          status: "error",
          madeWith: made,
          error: message?.startsWith("Формат")
            ? message
            : "Не удалось открыть этот файл.",
        });
      } finally {
        bitmap?.close();
      }
    }
    setRunning(false);
  }, [options]);

  const remove = (id: string) =>
    setItems((prev) => {
      const gone = prev.find((item) => item.id === id);
      if (gone?.result) URL.revokeObjectURL(gone.result.url);
      return prev.filter((item) => item.id !== id);
    });

  const clear = () =>
    setItems((prev) => {
      for (const item of prev) if (item.result) URL.revokeObjectURL(item.result.url);
      return [];
    });

  const downloadAll = useCallback(async () => {
    const ready = itemsRef.current.filter((item) => item.status === "done" && item.madeWith === wanted && item.result);
    if (ready.length === 1) {
      const only = ready[0].result!;
      download(only.blob, only.name);
      return;
    }
    setZipping(true);
    try {
      const zip = await zipFiles(ready.map((item) => ({ name: item.result!.name, blob: item.result!.blob })));
      download(zip, "photopoly-converted.zip");
    } finally {
      setZipping(false);
    }
  }, [wanted]);

  const totalBefore = done.reduce((sum, item) => sum + item.file.size, 0);
  const totalAfter = done.reduce((sum, item) => sum + (item.result?.blob.size ?? 0), 0);

  return (
    <>
      <input
        ref={pickerRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) add(event.target.files);
          event.target.value = "";
        }}
      />

      {notice ? (
        <div className="mb-5">
          <Notice tone="warn">{notice}</Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section
          className="min-w-0 rounded-xl border border-line bg-slab p-4 shadow-card sm:p-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files?.length) add(event.dataTransfer.files);
          }}
        >
          {items.length === 0 ? (
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
              <span className="text-[20px] font-semibold text-chalk">Перетащите фото сюда</span>
              <span className="text-[14px] text-dust">
                можно сразу несколько · HEIC, JPG, PNG, WebP · до {MAX_FILES} файлов
              </span>
              <span className="max-w-sm text-[13px] leading-relaxed text-ash">
                Всё происходит в браузере — фото не уходят ни на какой сервер.
              </span>
            </button>
          ) : (
            <>
              <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-[14px] font-medium text-chalk">
                  {items.length} {items.length === 1 ? "файл" : items.length < 5 ? "файла" : "файлов"}
                </span>
                <button
                  type="button"
                  onClick={() => pickerRef.current?.click()}
                  disabled={running}
                  className="text-[13px] font-medium text-safe-soft hover:underline disabled:opacity-40"
                >
                  Добавить ещё
                </button>
                <button
                  type="button"
                  onClick={clear}
                  disabled={running}
                  className="ml-auto text-[13px] font-medium text-dust hover:text-chalk disabled:opacity-40"
                >
                  Очистить
                </button>
              </header>

              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                {items.map((item) => {
                  const fresh = item.madeWith === wanted;
                  return (
                    <li key={item.id} className="flex items-center gap-3 bg-pit px-3 py-2.5">
                      <div className="checkerboard flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md">
                        {item.result ? (
                          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing for the optimiser to do
                          <img src={item.result.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[11px] font-semibold text-dust">
                            {looksHeic(item.file) ? "HEIC" : item.file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium text-chalk">{item.file.name}</p>
                        <p className="text-[13px] text-dust tabular-nums">
                          {formatBytes(item.file.size)}
                          {item.status === "done" && item.result && fresh ? (
                            <>
                              {" → "}
                              <span className="text-chalk">{formatBytes(item.result.blob.size)}</span>{" "}
                              <span className={item.result.blob.size < item.file.size ? "text-good" : "text-dust"}>
                                {saving(item.file.size, item.result.blob.size)}
                              </span>
                              {` · ${item.result.w} × ${item.result.h}`}
                            </>
                          ) : item.status === "working" ? (
                            " · обрабатываем…"
                          ) : item.status === "error" && fresh ? (
                            <span className="text-ember"> · {item.error}</span>
                          ) : null}
                        </p>
                      </div>
                      {item.status === "done" && item.result && fresh ? (
                        <button
                          type="button"
                          onClick={() => download(item.result!.blob, item.result!.name)}
                          className="shrink-0 rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors hover:border-line-lit hover:bg-riser"
                        >
                          Скачать
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        disabled={item.status === "working"}
                        aria-label={`Убрать ${item.file.name}`}
                        className="shrink-0 px-1 text-[18px] leading-none text-dust transition-colors hover:text-ember disabled:opacity-30"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <aside className="space-y-5 rounded-xl border border-line bg-slab p-5 shadow-card">
          <div className="flex flex-col gap-2">
            <Label>Формат</Label>
            <Segmented
              ariaLabel="Формат"
              value={options.format}
              options={(Object.keys(FORMAT_LABEL) as OutputFormat[]).map((format) => ({
                value: format,
                label: FORMAT_LABEL[format],
              }))}
              onChange={(format) => setOptions((prev) => ({ ...prev, format }))}
            />
            <p className="text-[12px] leading-snug text-dust">
              JPG открывается везде. WebP — меньше файл. PNG — без потерь, но тяжёлый.
            </p>
          </div>

          <Slider
            label="Качество"
            value={options.quality}
            min={0.4}
            max={1}
            step={0.05}
            display={options.format === "image/png" ? "—" : `${Math.round(options.quality * 100)}%`}
            disabled={options.format === "image/png"}
            onChange={(quality) => setOptions((prev) => ({ ...prev, quality }))}
          />

          <div className="flex flex-col gap-2">
            <Label>Размер по длинной стороне</Label>
            <Segmented
              ariaLabel="Размер"
              value={String(options.maxEdge ?? "orig")}
              options={MAX_EDGES.map((edge) => ({
                value: String(edge ?? "orig"),
                label: edge ? `${edge}` : "Как есть",
                title: edge ? `Не больше ${edge} px` : "Не уменьшать",
              }))}
              onChange={(value) =>
                setOptions((prev) => ({ ...prev, maxEdge: value === "orig" ? null : Number(value) }))
              }
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Button
              type="button"
              className="w-full py-3 text-[15px]"
              onClick={run}
              disabled={running || pending.length === 0}
            >
              {running
                ? "Обрабатываем…"
                : pending.length > 0
                  ? `Конвертировать (${pending.length})`
                  : "Готово"}
            </Button>
            <Button
              type="button"
              tone="ghost"
              className="w-full"
              onClick={downloadAll}
              disabled={running || zipping || done.length === 0}
            >
              {zipping
                ? "Собираем архив…"
                : done.length > 1
                  ? `Скачать всё (ZIP, ${done.length})`
                  : "Скачать"}
            </Button>
            {done.length > 0 ? (
              <p className="text-[13px] text-dust tabular-nums">
                {formatBytes(totalBefore)} → {formatBytes(totalAfter)}{" "}
                <span className={totalAfter < totalBefore ? "text-good" : ""}>
                  {saving(totalBefore, totalAfter)}
                </span>
              </p>
            ) : null}
          </div>

          <Notice>
            Данные камеры и геолокация из файлов удаляются, а поворот снимка
            сохраняется.
          </Notice>
        </aside>
      </div>
    </>
  );
}
