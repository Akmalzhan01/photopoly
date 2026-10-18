"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decode, looksHeic } from "@/lib/convert";
import { download } from "@/lib/imaging";
import { makePdf } from "@/lib/pdf";
import {
  KNOWN_SIZES,
  MIN_WIDTH,
  SHEET_SIZES,
  clampPlaced,
  fullWidth,
  mm,
  placeNew,
  renderSheet,
  sheetDims,
  widest,
  widthForLongEdge,
  type Orientation,
  type Placed,
  type SheetSize,
} from "@/lib/paper";
import {
  applyFilter,
  detectQuad,
  flatten,
  insetQuad,
  rotate,
  type Quad,
  type ScanFilter,
} from "@/lib/scan";
import { stageBox } from "@/lib/stage";
import { Button, Notice } from "@/components/site/ui";
import { Label, Segmented, Slider, Toggle } from "@/components/ui";
import { PaperStage } from "./PaperStage";

const MAX_STAGE = 600;
const MAX_PAPER_STAGE = 680;
/** Long edge of the copy the sheet view draws from; the full scan is kept for saving. */
const PREVIEW_EDGE = 1400;
/** The photo is worked at this size at most; a phone's 48 MP gains nothing past it. */
const SOURCE_EDGE = 4000;
const MAX_PAGES = 30;
const JPEG_QUALITY = 0.9;

type Page = {
  id: string;
  name: string;
  /** The decoded photo, capped to SOURCE_EDGE. Never mutated. */
  source: HTMLCanvasElement;
  quad: Quad;
  turns: number;
  filter: ScanFilter;
  /** Bumped whenever the result needs drawing again. */
  version: number;
};

const FILTERS: { value: ScanFilter; label: string; title: string }[] = [
  { value: "enhanced", label: "Скан", title: "Белая бумага, без теней" },
  { value: "bw", label: "Ч/Б", title: "Чёрно-белый документ" },
  { value: "gray", label: "Серый", title: "Оттенки серого" },
  { value: "original", label: "Как есть", title: "Без обработки" },
];

type Rendered = { key: string; canvas: HTMLCanvasElement; preview: HTMLCanvasElement; thumb: string };

/** A sheet of paper with scans laid out on it, all sheets the same size. */
type Sheet = { id: string; items: Placed[] };

const keyOf = (p: Page) => `${JSON.stringify(p.quad)}|${p.turns}|${p.filter}`;

/** "2 листа", "5 листов": Russian counts by the last digit. */
function sheetsWord(n: number): string {
  const last = n % 10;
  const teen = n % 100 >= 11 && n % 100 <= 14;
  return `${n} ${!teen && last >= 2 && last <= 4 ? "листа" : "листов"}`;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function shrunk(canvas: HTMLCanvasElement, edge: number): HTMLCanvasElement {
  const s = Math.min(1, edge / Math.max(canvas.width, canvas.height));
  if (s === 1) return canvas;
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(canvas.width * s));
  small.height = Math.max(1, Math.round(canvas.height * s));
  const ctx = small.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small;
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), type, quality),
  );
}

export function ScannerStudio() {
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"frame" | "result" | "paper">("frame");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const [paperSize, setPaperSize] = useState<SheetSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [sheets, setSheets] = useState<Sheet[]>(() => [{ id: "sheet-1", items: [] }]);
  const [sheetId, setSheetId] = useState("sheet-1");
  const [itemId, setItemId] = useState<string | null>(null);
  const [cutLines, setCutLines] = useState(false);

  /** Finished pages, as drawn; what the stage and the strip show. */
  const [rendered, setRendered] = useState<Record<string, Rendered>>({});
  /** Working copies only the processing reads: flattened pages and results. */
  const flats = useRef(new Map<string, { key: string; canvas: HTMLCanvasElement }>());
  const results = useRef(new Map<string, Rendered>());
  const pickerRef = useRef<HTMLInputElement>(null);

  const page = pages.find((p) => p.id === selected) ?? null;
  const patch = useCallback(
    (id: string, next: Partial<Page>) =>
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...next, version: p.version + 1 } : p))),
    [],
  );

  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = pages.length;
  }, [pages.length]);

  const add = useCallback(async (list: FileList | File[]) => {
    const count = countRef.current;
    const files = [...list].filter((file) => file.type.startsWith("image/") || looksHeic(file));
    if (files.length === 0) return;
    setError(null);
    setBusy("Открываем фото…");
    const added: Page[] = [];
    for (const file of files) {
      if (count + added.length >= MAX_PAGES) {
        setError(`В одном документе — не больше ${MAX_PAGES} страниц.`);
        break;
      }
      try {
        const bitmap = await decode(file);
        const ratio = Math.min(1, SOURCE_EDGE / Math.max(bitmap.width, bitmap.height));
        const source = document.createElement("canvas");
        source.width = Math.round(bitmap.width * ratio);
        source.height = Math.round(bitmap.height * ratio);
        const ctx = source.getContext("2d", { willReadFrequently: true })!;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, source.width, source.height);
        bitmap.close();
        added.push({ id: newId(), name: file.name, source, quad: detectQuad(source), turns: 0, filter: "enhanced", version: 0 });
      } catch {
        setError(`Не удалось открыть «${file.name}».`);
      }
    }
    setBusy(null);
    if (added.length > 0) {
      setPages((prev) => [...prev, ...added]);
      setSelected(added[0].id);
      setMode("frame");
    }
  }, []);

  /** Flatten → turn → filter, reusing the flattening when only the look changed. */
  const resultOf = useCallback((p: Page): Rendered => {
    const source = p.source;
    const flatKey = JSON.stringify(p.quad);
    let flat = flats.current.get(p.id);
    if (!flat || flat.key !== flatKey) {
      flat = { key: flatKey, canvas: flatten(source, p.quad) };
      flats.current.set(p.id, flat);
    }
    const key = keyOf(p);
    const cached = results.current.get(p.id);
    if (cached && cached.key === key) return cached;
    let canvas = flat.canvas;
    for (let i = 0; i < p.turns % 4; i++) canvas = rotate(canvas);
    canvas = applyFilter(canvas, p.filter);

    // A screen-sized copy for the sheet view and a small one for the page strip.
    const preview = shrunk(canvas, PREVIEW_EDGE);
    const thumb = shrunk(preview, 120);
    const done = { key, canvas, preview, thumb: thumb.toDataURL("image/jpeg", 0.7) };
    results.current.set(p.id, done);
    return done;
  }, []);

  // Process pages in the background, a beat after the last change, so
  // dragging a corner stays smooth and the strip fills in by itself.
  useEffect(() => {
    if (drag !== null) return;
    const stale = pages.filter((p) => rendered[p.id]?.key !== keyOf(p));
    if (stale.length === 0) return;
    const timer = setTimeout(() => {
      // The visible page first.
      const order = [...stale].sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : 0));
      const fresh: Record<string, Rendered> = {};
      for (const p of order) fresh[p.id] = resultOf(p);
      setRendered((prev) => ({ ...prev, ...fresh }));
    }, 200);
    return () => clearTimeout(timer);
  }, [pages, selected, drag, rendered, resultOf]);

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

  const source = page?.source ?? null;
  const result = page ? rendered[page.id] : undefined;
  const resultFresh = page && result && result.key === keyOf(page) ? result.canvas : null;
  const shown = mode === "frame" ? source : resultFresh;
  const box = stageBox(room || 640, shown ? shown.width / shown.height : 3 / 4, MAX_STAGE);

  const viewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !shown) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.width = Math.round(box.w * dpr);
    view.height = Math.round(box.h * dpr);
    const ctx = view.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(shown, 0, 0, view.width, view.height);
  }, [shown, box.w, box.h]);

  /** Corner positions in stage pixels. */
  const scale = source ? box.w / source.width : 1;
  const onHandleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (drag === null || !page || !source) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(source.width, Math.max(0, (event.clientX - rect.left) / scale));
    const y = Math.min(source.height, Math.max(0, (event.clientY - rect.top) / scale));
    const quad = [...page.quad] as Quad;
    quad[drag] = { x, y };
    setPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, quad } : p)));
  };

  const remove = (id: string) => {
    setSheets((prev) => prev.map((sheet) => ({ ...sheet, items: sheet.items.filter((item) => item.pageId !== id) })));
    results.current.delete(id);
    flats.current.delete(id);
    setRendered((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (selected === id) setSelected(next[0]?.id ?? null);
      return next;
    });
  };

  const move = (id: string, by: number) =>
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const ensureAll = () => pages.map((p) => resultOf(p).canvas);

  const savePdf = async () => {
    setError(null);
    setBusy("Собираем PDF…");
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const canvases = ensureAll();
      const parts = [];
      for (const canvas of canvases) {
        const blob = await blobOf(canvas, "image/jpeg", JPEG_QUALITY);
        parts.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height });
      }
      download(makePdf(parts), "skan.pdf");
    } catch {
      setError("Не удалось собрать PDF.");
    } finally {
      setBusy(null);
    }
  };

  const saveJpg = async () => {
    if (!page) return;
    const { canvas } = resultOf(page);
    const blob = await blobOf(canvas, "image/jpeg", JPEG_QUALITY);
    const index = pages.findIndex((p) => p.id === page.id) + 1;
    download(blob, `skan-${index}.jpg`);
  };

  // --- Sheets: scans laid out on paper ---

  const paper = sheetDims(paperSize, orientation);
  /** Height ÷ width of a scan as it is drawn now. */
  const aspectOf = useCallback(
    (pageId: string) => {
      const canvas = rendered[pageId]?.canvas;
      return canvas ? canvas.height / canvas.width : 1;
    },
    [rendered],
  );
  const pictures = useMemo(
    () => Object.fromEntries(Object.entries(rendered).map(([id, r]) => [id, r.preview])),
    [rendered],
  );
  const sheetIndex = Math.max(0, sheets.findIndex((s) => s.id === sheetId));
  const sheet = sheets[sheetIndex];
  // Pieces are kept inside the paper as they are shown, so a turned scan or a
  // smaller sheet never leaves one hanging off the edge.
  const laidOut = (items: Placed[]) => items.map((item) => clampPlaced(item, aspectOf(item.pageId), paper));
  const laid = laidOut(sheet.items);
  const item = laid.find((i) => i.id === itemId) ?? null;
  const filled = sheets.filter((s) => s.items.length > 0);

  const setItems = (update: (items: Placed[]) => Placed[]) =>
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? { ...s, items: update(s.items) } : s)));
  const changeItem = (next: Placed) => setItems((items) => items.map((i) => (i.id === next.id ? next : i)));
  const dropItem = (id: string) => {
    setItems((items) => items.filter((i) => i.id !== id));
    if (itemId === id) setItemId(null);
  };

  /** Puts a scan on the open sheet, under what is there already. */
  const putOnSheet = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId);
    if (!target) return;
    const done = resultOf(target);
    setRendered((prev) => ({ ...prev, [pageId]: done }));
    const aspect = done.canvas.height / done.canvas.width;
    const aspects = (id: string) => (id === pageId ? aspect : aspectOf(id));
    const placed = placeNew(newId(), pageId, aspect, laid, aspects, paper);
    setItems((items) => [...items, placed]);
    setItemId(placed.id);
    setSelected(pageId);
    setMode("paper");
  };

  const selectItem = (id: string | null) => {
    setItemId(id);
    const chosen = laid.find((i) => i.id === id);
    if (chosen) setSelected(chosen.pageId);
  };

  const resize = (w: number) => {
    if (item) changeItem(clampPlaced({ ...item, w }, aspectOf(item.pageId), paper));
  };

  const addSheet = () => {
    const id = newId();
    setSheets((prev) => [...prev, { id, items: [] }]);
    setSheetId(id);
    setItemId(null);
  };

  const dropSheet = (id: string) => {
    const index = sheets.findIndex((s) => s.id === id);
    const next = sheets.filter((s) => s.id !== id);
    if (next.length === 0) return;
    setSheets(next);
    if (id === sheetId) setSheetId(next[Math.max(0, index - 1)].id);
    setItemId(null);
  };

  const pictureForPrint = (pageId: string) => {
    const target = pages.find((p) => p.id === pageId);
    return target ? resultOf(target).canvas : undefined;
  };

  const savePaperPdf = async () => {
    setError(null);
    setBusy("Собираем листы…");
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const parts = [];
      for (const s of filled) {
        const canvas = renderSheet(laidOut(s.items), paper, pictureForPrint, cutLines);
        const blob = await blobOf(canvas, "image/jpeg", JPEG_QUALITY);
        parts.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, paper });
      }
      download(makePdf(parts), `list-${SHEET_SIZES[paperSize].label.toLowerCase()}.pdf`);
    } catch {
      setError("Не удалось собрать PDF.");
    } finally {
      setBusy(null);
    }
  };

  const savePaperJpg = async () => {
    if (laid.length === 0) return;
    setBusy("Собираем лист…");
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const canvas = renderSheet(laid, paper, pictureForPrint, cutLines);
      download(await blobOf(canvas, "image/jpeg", JPEG_QUALITY), `list-${sheetIndex + 1}.jpg`);
    } catch {
      setError("Не удалось сохранить лист.");
    } finally {
      setBusy(null);
    }
  };

  const paperBox = stageBox(room || 640, paper.w / paper.h, MAX_PAPER_STAGE);

  return (
    <>
      <input
        ref={pickerRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) void add(event.target.files);
          event.target.value = "";
        }}
      />

      {error ? (
        <div className="mb-5">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section
          className="min-w-0 rounded-xl border border-line bg-slab p-4 shadow-card sm:p-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files?.length) void add(event.dataTransfer.files);
          }}
        >
          {page ? (
            <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Segmented
                ariaLabel="Вид"
                value={mode}
                options={[
                  { value: "frame" as const, label: "Рамка", title: "Поправить углы документа" },
                  { value: "result" as const, label: "Результат", title: "Как будет выглядеть скан" },
                  { value: "paper" as const, label: "На листе", title: "Разложить сканы на листе A4 и других" },
                ]}
                onChange={setMode}
              />
              <span className="text-[13px] text-dust">
                {mode === "paper"
                  ? "Двигайте скан по листу, синий угол меняет размер"
                  : mode === "frame"
                    ? "Перетащите углы на края листа"
                    : resultFresh
                      ? "Готово к сохранению"
                      : "Обрабатываем…"}
              </span>
            </header>
          ) : null}

          {page && mode === "paper" ? (
            <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Листы">
              {sheets.map((s, index) => (
                <span
                  key={s.id}
                  className={`inline-flex items-center rounded-lg border text-[13px] font-medium transition-colors ${
                    s.id === sheet.id ? "border-safe bg-safe/10 text-safe-soft" : "border-line text-ash hover:border-line-lit"
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={s.id === sheet.id}
                    onClick={() => {
                      setSheetId(s.id);
                      setItemId(null);
                    }}
                    className="py-1 pr-1 pl-2.5 tabular-nums"
                  >
                    Лист {index + 1}
                    {s.items.length > 0 ? <span className="ml-1 text-dust">· {s.items.length}</span> : null}
                  </button>
                  {sheets.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Убрать лист ${index + 1}`}
                      onClick={() => dropSheet(s.id)}
                      className="px-1.5 py-1 text-dust hover:text-ember"
                    >
                      ×
                    </button>
                  ) : (
                    <span className="w-1.5" />
                  )}
                </span>
              ))}
              <button
                type="button"
                onClick={addSheet}
                className="rounded-lg border border-dashed border-line px-2.5 py-1 text-[13px] font-medium text-dust transition-colors hover:border-safe/60 hover:text-safe-soft"
              >
                + Лист
              </button>
            </div>
          ) : null}

          <div ref={wrapRef} className="flex min-w-0 justify-center">
            {page && mode === "paper" ? (
              <div className="py-2">
                <PaperStage
                  sheet={paper}
                  items={laid}
                  pictures={pictures}
                  aspectOf={aspectOf}
                  cutLines={cutLines}
                  width={paperBox.w}
                  height={paperBox.h}
                  selected={itemId}
                  onSelect={selectItem}
                  onChange={changeItem}
                  onRemove={dropItem}
                />
              </div>
            ) : page ? (
              <div
                className="relative overflow-hidden rounded-lg border border-line bg-pit select-none"
                style={{ width: box.w, height: box.h }}
              >
                <canvas ref={viewRef} className="absolute inset-0 h-full w-full" role="img" aria-label={page.name} />
                {mode === "frame" && source ? (
                  <svg
                    className="absolute inset-0 h-full w-full touch-none"
                    onPointerMove={onHandleMove}
                    onPointerUp={() => setDrag(null)}
                    onPointerLeave={() => setDrag(null)}
                  >
                    <polygon
                      points={page.quad.map((p) => `${p.x * scale},${p.y * scale}`).join(" ")}
                      fill="rgb(37 99 235 / 0.12)"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                    {page.quad.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x * scale}
                        cy={p.y * scale}
                        r={drag === i ? 14 : 11}
                        fill="white"
                        stroke="#2563eb"
                        strokeWidth={3}
                        className="cursor-grab"
                        onPointerDown={(event) => {
                          setDrag(i);
                          try {
                            event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                          } catch {
                            // Capture is a nicety: without it the drag still works inside the stage.
                          }
                        }}
                      />
                    ))}
                  </svg>
                ) : null}
                {mode === "result" && !resultFresh ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/60 text-[14px] font-medium text-chalk">
                    Обрабатываем…
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
                    <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2M7 9h10M7 13h10M7 17h6" />
                  </svg>
                </span>
                <span className="text-[20px] font-semibold text-chalk">
                  {busy ?? "Добавьте фото документа"}
                </span>
                <span className="text-[14px] text-dust">
                  можно сразу несколько страниц · JPG, PNG, HEIC
                </span>
                <span className="max-w-sm text-[13px] leading-relaxed text-ash">
                  Всё обрабатывается в браузере — документ не уходит ни на какой сервер.
                </span>
              </button>
            )}
          </div>

          {pages.length > 0 && mode === "paper" ? (
            <p className="mt-4 text-[13px] text-dust">Нажмите на скан, чтобы положить его на лист. «+ Фото» — добавить ещё документ.</p>
          ) : null}
          {pages.length > 0 ? (
            <div className={`${mode === "paper" ? "mt-2" : "mt-4"} flex gap-3 overflow-x-auto pb-1`}>
              {pages.map((p, index) => (
                <div key={p.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => (mode === "paper" ? putOnSheet(p.id) : setSelected(p.id))}
                    className={`group relative flex h-28 w-22 items-center justify-center overflow-hidden rounded-lg border-2 bg-pit transition-colors ${
                      p.id === selected ? "border-safe" : "border-line hover:border-line-lit"
                    }`}
                    title={mode === "paper" ? "Положить на лист" : p.name}
                  >
                    {rendered[p.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a local data URL
                      <img src={rendered[p.id].thumb} alt="" className="max-h-full max-w-full" />
                    ) : (
                      <span className="text-[12px] text-dust">…</span>
                    )}
                    <span className="absolute top-1 left-1 rounded bg-ink/80 px-1.5 text-[11px] font-semibold text-chalk tabular-nums">
                      {index + 1}
                    </span>
                    {mode === "paper" ? (
                      <span className="absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-safe text-[16px] leading-none text-white shadow-card transition-transform group-hover:scale-110">
                        +
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-1 flex justify-center gap-1 text-[13px] text-dust">
                    <button type="button" aria-label="Левее" onClick={() => move(p.id, -1)} disabled={index === 0} className="px-1 hover:text-chalk disabled:opacity-30">
                      ←
                    </button>
                    <button type="button" aria-label="Убрать страницу" onClick={() => remove(p.id)} className="px-1 hover:text-ember">
                      ×
                    </button>
                    <button type="button" aria-label="Правее" onClick={() => move(p.id, 1)} disabled={index === pages.length - 1} className="px-1 hover:text-chalk disabled:opacity-30">
                      →
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => pickerRef.current?.click()}
                className="flex h-28 w-22 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-[13px] text-dust transition-colors hover:border-safe/60 hover:text-safe-soft"
              >
                <span className="text-[22px] leading-none">+</span>
                {mode === "paper" ? "Фото" : "Страница"}
              </button>
            </div>
          ) : null}
        </section>

        <aside className="space-y-5 rounded-xl border border-line bg-slab p-5 shadow-card">
          <div className="flex flex-col gap-2">
            <Label>Обработка</Label>
            <Segmented
              ariaLabel="Обработка"
              value={page?.filter ?? "enhanced"}
              options={FILTERS}
              onChange={(filter) => {
                if (!page) return;
                patch(page.id, { filter });
                if (mode !== "paper") setMode("result");
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!page}
              onClick={() => {
                if (!page) return;
                patch(page.id, { turns: (page.turns + 1) % 4 });
                if (mode !== "paper") setMode("result");
              }}
              className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
            >
              ↻ Повернуть
            </button>
            <button
              type="button"
              disabled={!page || !source}
              onClick={() => page && source && patch(page.id, { quad: detectQuad(source) })}
              className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
            >
              Найти лист заново
            </button>
            <button
              type="button"
              disabled={!page || !source}
              onClick={() => page && source && patch(page.id, { quad: insetQuad(source.width, source.height, 0) })}
              className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors enabled:hover:bg-riser disabled:opacity-40"
            >
              Весь кадр
            </button>
          </div>

          {mode === "paper" ? (
            <>
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Label>Размер листа</Label>
                <Segmented
                  ariaLabel="Размер листа"
                  value={paperSize}
                  options={(Object.keys(SHEET_SIZES) as SheetSize[]).map((value) => ({
                    value,
                    label: SHEET_SIZES[value].label,
                    title: SHEET_SIZES[value].title,
                  }))}
                  onChange={setPaperSize}
                />
                <Segmented
                  ariaLabel="Ориентация"
                  value={orientation}
                  options={[
                    { value: "portrait" as const, label: "Книжная" },
                    { value: "landscape" as const, label: "Альбомная" },
                  ]}
                  onChange={setOrientation}
                />
                <div className="pt-1">
                  <Toggle label="Тонкий контур — удобно вырезать" checked={cutLines} onChange={setCutLines} />
                </div>
              </div>

              {item ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <Slider
                    label="Размер скана"
                    value={item.w}
                    min={MIN_WIDTH}
                    max={Math.floor(widest(aspectOf(item.pageId), paper))}
                    step={0.5}
                    display={`${mm(item.w)} × ${mm(item.w * aspectOf(item.pageId))} мм`}
                    onChange={resize}
                  />
                  <div className="flex flex-wrap gap-2">
                    {KNOWN_SIZES.map((known) => (
                      <button
                        key={known.label}
                        type="button"
                        title={known.title}
                        onClick={() => resize(widthForLongEdge(aspectOf(item.pageId), known.long))}
                        className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors hover:bg-riser"
                      >
                        {known.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      title="Во всю ширину листа, с полями"
                      onClick={() => resize(fullWidth(aspectOf(item.pageId), paper))}
                      className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors hover:bg-riser"
                    >
                      Во весь лист
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => changeItem({ ...item, x: (paper.w - item.w) / 2 })} className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors hover:bg-riser">
                      По центру
                    </button>
                    <button type="button" onClick={() => putOnSheet(item.pageId)} className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-chalk transition-colors hover:bg-riser">
                      Ещё копия
                    </button>
                    <button
                      type="button"
                      onClick={() => dropItem(item.id)}
                      className="rounded-lg border border-line bg-slab px-3 py-1.5 text-[13px] font-medium text-ember transition-colors hover:bg-riser"
                    >
                      Убрать с листа
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-line pt-4 text-[13px] leading-relaxed text-dust">
                  Нажмите на скан на листе, чтобы поменять его размер, или на миниатюру внизу — чтобы добавить.
                </p>
              )}

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Button type="button" className="w-full py-3 text-[15px]" onClick={savePaperPdf} disabled={filled.length === 0 || busy !== null}>
                  {busy === "Собираем листы…" ? busy : `Скачать PDF${filled.length > 1 ? ` (${sheetsWord(filled.length)})` : ""}`}
                </Button>
                <Button type="button" tone="ghost" className="w-full" onClick={savePaperJpg} disabled={laid.length === 0 || busy !== null}>
                  {busy === "Собираем лист…" ? busy : "Скачать этот лист в JPG"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button type="button" tone="ghost" className="w-full" onClick={() => page && putOnSheet(page.id)} disabled={!page}>
                Положить на лист {SHEET_SIZES[paperSize].label}
              </Button>
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <Button type="button" className="w-full py-3 text-[15px]" onClick={savePdf} disabled={pages.length === 0 || busy !== null}>
                  {busy === "Собираем PDF…" ? busy : `Скачать PDF${pages.length > 1 ? ` (${pages.length} стр.)` : ""}`}
                </Button>
                <Button type="button" tone="ghost" className="w-full" onClick={saveJpg} disabled={!page || busy !== null}>
                  Скачать эту страницу в JPG
                </Button>
              </div>
            </>
          )}

          <Notice>
            Снимайте документ на тёмном фоне при ровном свете — тогда лист
            находится сам и углы почти не приходится двигать.
          </Notice>
        </aside>
      </div>
    </>
  );
}
