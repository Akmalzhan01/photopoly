"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeQuota } from "@/lib/entitlement-view";
import { useExports } from "@/lib/use-exports";
import type { AttireAssetView } from "@/lib/attire";
import { useAttireImage } from "@/lib/use-attire-image";
import { adjustSource, isNeutral, type Adjustments } from "@/lib/colour";
import { cacheModel, removeBackground, type Progress } from "@/lib/cutout";
import {
  enhanceSource,
  growthFor,
  idle as idleEnhance,
  type Enhance,
} from "@/lib/enhance";
import { isTypingTarget, useHistory, type Doc } from "@/lib/history";
import {
  alphaBounds,
  compose,
  download,
  exportCanvas,
  extensionFor,
  fileStem,
  fullBounds,
  MAX_EDGE,
  type ComposeSpec,
  type Source,
} from "@/lib/imaging";
import { applyStrokes, type Stroke } from "@/lib/mask";
import { printAtSize } from "@/lib/print";
import { findPreset } from "@/lib/presets";
import { applyProof, shiftedShare } from "@/lib/proof";
import {
  fromPreset,
  fromSheet,
  initialSettings,
  PRESET_KEYS,
  SHEET_KEYS,
  type Settings,
} from "@/lib/settings";
import {
  composeSheet,
  findSheet,
  mmToPx,
  planSheet,
  type SheetSpec,
} from "@/lib/sheet";
import { loadSettings, saveSettings } from "@/lib/storage";
import { toPixels } from "@/lib/units";
import { drawWatermark } from "@/lib/watermark";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./site/ui";
import { MaskEditor } from "./MaskEditor";
import { OfflineBadge } from "./OfflineBadge";
import { OfflineReady } from "./OfflineReady";
import { Panel } from "./Panel";
import { QuotaWall } from "./QuotaWall";
import { Stage } from "./Stage";

/**
 * Rewrites a canvas to its printed appearance, answering with the share of it
 * that ink visibly moves. Preview surfaces only — see the note in `build`.
 */
function proofCanvas(canvas: HTMLCanvasElement): number | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = applyProof(image.data);
  ctx.putImageData(image, 0, 0);
  return shiftedShare(result);
}

export function Studio({ attireAssets }: { attireAssets: AttireAssetView[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * The allowance, which no longer arrives with the page.
   *
   * It used to be rendered into the HTML, and that is exactly what made this
   * page impossible to cache — the finished markup differed per account. It is
   * fetched after load and mirrored in local storage instead, so the editor
   * still knows what it may do when the connection is gone. The hook is shared
   * with the quality page, which spends the same allowance.
   */
  const { entitlement, allowed, blocked, dismiss, claim, problem, clearProblem } = useExports();

  const [settings, setSettings] = useState<Settings>(initialSettings);
  /**
   * Fetch the weights ahead of time so background removal survives an outage.
   *
   * Deliberately not left to the first photo: that is usually the moment a
   * customer is already standing there, and it only lands in the cache if the
   * worker happened to be in charge of the tab. Kept to the model actually
   * selected — pulling both doubles a download measured in tens of megabytes.
   */
  const [warming, setWarming] = useState(false);
  useEffect(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let alive = true;
    // A little after load: the editor should paint first, and a shop that opens
    // the tab only to close it again should not pay for the model.
    const timer = setTimeout(async () => {
      if (!alive) return;
      setWarming(true);
      try {
        await cacheModel(settings.model);
      } catch {
        // Offline, or the CDN is unreachable. The next visit tries again.
      } finally {
        if (alive) setWarming(false);
      }
    }, 2500);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [settings.model]);
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<Source | null>(null);
  const [cutout, setCutout] = useState<{ job: string; source: Source } | null>(null);
  /** The job whose segmentation failed, so we stop reporting it as in progress. */
  const [failed, setFailed] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  // Corrections belong to the image, not to the user's saved preferences.
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  /** Share of the picture ink would visibly change; null while not proofing. */
  const [proofShare, setProofShare] = useState<number | null>(null);
  // Written from inside `build`, which has nowhere to return a second value.
  const proofShareRef = useRef<number | null>(null);

  // Saved settings can only be read after mount — localStorage does not exist on
  // the server, and seeding state with it would make the first client render
  // disagree with the server's. One extra render is the price of correct markup.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    if (stored) setSettings(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveSettings(settings), 400);
    return () => clearTimeout(timer);
  }, [settings, hydrated]);

  const resetSettings = useCallback(() => setSettings(initialSettings()), []);

  const patch = useCallback((next: Partial<Settings>) => {
    setSettings((prev) => {
      if (next.presetId && next.presetId !== "custom") {
        const preset = findPreset(next.presetId);
        if (preset) return { ...prev, ...fromPreset(preset) };
      }
      if (next.sheetId && next.sheetId !== "custom") {
        const sheet = findSheet(next.sheetId);
        if (sheet) return { ...prev, ...fromSheet(sheet) };
      }
      const leavesPreset = PRESET_KEYS.some((key) => key in next);
      const leavesSheet = SHEET_KEYS.some((key) => key in next);
      return {
        ...prev,
        ...next,
        ...(leavesPreset ? { presetId: "custom" } : null),
        ...(leavesSheet ? { sheetId: "custom" } : null),
      };
    });
  }, []);

  const pickerRef = useRef<HTMLInputElement>(null);
  const onPick = useCallback(() => pickerRef.current?.click(), []);

  const onFile = useCallback((next: File) => {
    setError(null);
    setCutout(null);
    setOriginal(null);
    setStrokes([]);
    setFile(next);
  }, []);

  // Decode whatever was dropped so there is something to show immediately.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    createImageBitmap(file)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close();
          return;
        }
        setOriginal({ bitmap, bounds: fullBounds(bitmap) });
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось открыть этот файл. Выберите другое фото.");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  /** Identifies one segmentation job: this image run through this model. */
  const job = file ? `${file.name}:${file.size}:${file.lastModified}:${settings.model}` : null;

  // Segmentation reruns whenever the image or the chosen model changes.
  useEffect(() => {
    if (!file || !settings.removeBg || !job) return;
    let cancelled = false;

    removeBackground(file, settings.model, (next) => {
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
  }, [file, job, settings.removeBg, settings.model]);

  // A cut-out from an earlier job is stale, so "still working" needs no flag.
  const ready = cutout?.job === job ? cutout.source : null;
  const busy = Boolean(job && settings.removeBg && !ready && failed !== job);

  const retouched = useMemo(() => {
    if (!ready || !original || strokes.length === 0) return ready;
    const canvas = applyStrokes(ready.bitmap, original.bitmap, strokes);
    // Restoring hair or shoulders grows the subject, so re-measure it.
    return { bitmap: canvas, bounds: alphaBounds(canvas) };
  }, [ready, original, strokes]);

  // --- Undo / redo over settings and hand corrections together ---
  const doc = useMemo<Doc>(() => ({ settings, strokes }), [settings, strokes]);
  const applyDoc = useCallback((next: Doc) => {
    setSettings(next.settings);
    setStrokes(next.strokes);
  }, []);
  const { undo, redo, canUndo, canRedo } = useHistory(doc, applyDoc, hydrated);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // While the mask editor is open it owns the shortcut for its own stack.
      if (editing || isTypingTarget(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
          event.preventDefault();
          redo();
        }
        return;
      }
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, editing]);

  const plain = settings.removeBg ? (retouched ?? original) : original;

  const repair = useMemo<Enhance>(
    () => ({
      on: settings.enhance,
      tone: settings.enhanceTone,
      denoise: settings.enhanceDenoise,
      sharpen: settings.enhanceSharpen,
    }),
    [settings.enhance, settings.enhanceTone, settings.enhanceDenoise, settings.enhanceSharpen],
  );

  // Baked on a delay for the same reason the colour work below is, only more
  // so: enlarging to print size is seconds of arithmetic, and the preview is
  // composed at full resolution, so doing it inside `compose` would charge that
  // to every drag of every slider.
  const [repaired, setRepaired] = useState<{
    from: Source;
    settings: Enhance;
    want: string;
    result: Source;
  } | null>(null);
  const [repairing, setRepairing] = useState(false);

  const targetW = Math.min(MAX_EDGE, toPixels(settings.width, settings.unit, settings.dpi));
  const targetH = Math.min(MAX_EDGE, toPixels(settings.height, settings.unit, settings.dpi));
  const want = `${targetW}×${targetH}`;

  const source =
    repaired && repaired.from === plain && repaired.settings === repair && repaired.want === want
      ? repaired.result
      : plain;

  useEffect(() => {
    if (!plain || idleEnhance(repair, growthFor(plain.bounds, { w: targetW, h: targetH }))) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the work is running
    setRepairing(true);
    let alive = true;
    const timer = setTimeout(() => {
      const result = enhanceSource(plain, repair, { w: targetW, h: targetH });
      if (!alive) return;
      setRepaired({ from: plain, settings: repair, want, result });
      setRepairing(false);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
      setRepairing(false);
    };
  }, [plain, repair, targetW, targetH, want]);

  const adjustments = useMemo<Adjustments>(
    () => ({
      brightness: settings.brightness,
      contrast: settings.contrast,
      saturation: settings.saturation,
      warmth: settings.warmth,
    }),
    [settings.brightness, settings.contrast, settings.saturation, settings.warmth],
  );

  // Colour work is baked in on a delay, so dragging a slider stays smooth. Until
  // the bake catches up the raw image is shown, which keeps this derived rather
  // than a second copy of state that has to be kept in sync.
  const [baked, setBaked] = useState<{
    from: Source;
    adjustments: Adjustments;
    result: Source;
  } | null>(null);

  const graded =
    baked && baked.from === source && baked.adjustments === adjustments
      ? baked.result
      : source;

  useEffect(() => {
    if (!source || isNeutral(adjustments)) return;
    const timer = setTimeout(
      () => setBaked({ from: source, adjustments, result: adjustSource(source, adjustments) }),
      120,
    );
    return () => clearTimeout(timer);
  }, [source, adjustments]);

  // Resolved against the live list rather than trusting the saved id: a suit an
  // admin has since hidden or deleted must stop appearing, not linger in one
  // browser's localStorage for ever.
  const attireUrl =
    attireAssets.find((asset) => asset.id === settings.attireAssetId)?.url ?? null;
  const attireImage = useAttireImage(attireUrl);

  const spec = useMemo<ComposeSpec>(
    () => ({
      targetW,
      targetH,
      fit: settings.fit,
      padding: settings.padding,
      zoom: settings.zoom,
      rotate: settings.rotate,
      offsetX: settings.offsetX,
      offsetY: settings.offsetY,
      background: settings.background,
      attire: attireImage
        ? {
            scale: settings.attireScale,
            offsetX: settings.attireOffsetX,
            offsetY: settings.attireOffsetY,
            image: attireImage,
          }
        : null,
      borderWidth: settings.borderWidth,
      borderColour: settings.borderColour,
    }),
    [
      targetW,
      targetH,
      settings.fit,
      settings.padding,
      settings.zoom,
      settings.rotate,
      settings.offsetX,
      settings.offsetY,
      settings.background,
      settings.attireScale,
      settings.attireOffsetX,
      settings.attireOffsetY,
      attireImage,
      settings.borderWidth,
      settings.borderColour,
    ],
  );

  // JPEG has no alpha channel; an unfilled canvas would come out black.
  const exportSpec = useMemo<ComposeSpec>(
    () =>
      settings.format === "image/jpeg" && spec.background === "transparent"
        ? { ...spec, background: "#ffffff" }
        : spec,
    [spec, settings.format],
  );

  // The photo's physical size is what decides how many fit on a sheet.
  const photoWmm = (targetW / settings.dpi) * 25.4;
  const photoHmm = (targetH / settings.dpi) * 25.4;

  // A4 at 600 dpi would blow past the raster cap, so the sheet gets its own dpi.
  const sheetDpi = Math.max(
    72,
    Math.min(
      settings.dpi,
      Math.floor((MAX_EDGE * 25.4) / Math.max(settings.sheetW, settings.sheetH)),
    ),
  );

  const layout = useMemo(
    () =>
      planSheet(
        {
          sheetW: settings.sheetW,
          sheetH: settings.sheetH,
          photoW: photoWmm,
          photoH: photoHmm,
          gap: settings.gap,
          margin: settings.margin,
        },
        settings.sheetRotate === "auto",
      ),
    [
      settings.sheetW,
      settings.sheetH,
      photoWmm,
      photoHmm,
      settings.gap,
      settings.margin,
      settings.sheetRotate,
    ],
  );

  const copies = settings.fillSheet
    ? Math.max(1, layout.capacity)
    : Math.max(1, Math.min(settings.copies, layout.capacity));

  const sheetSpec = useMemo<SheetSpec>(
    () => ({
      sheetW: settings.sheetW,
      sheetH: settings.sheetH,
      photoW: photoWmm,
      photoH: photoHmm,
      gap: settings.gap,
      margin: settings.margin,
      dpi: sheetDpi,
      copies,
      cutMarks: settings.cutMarks,
      imprint: {
        name: settings.studioName,
        phone: settings.studioPhone,
        note: settings.studioNote,
        colour: settings.studioColour,
        card: settings.studioCard,
        mark: settings.studioMark,
      },
    }),
    [
      settings.sheetW,
      settings.sheetH,
      photoWmm,
      photoHmm,
      settings.gap,
      settings.margin,
      sheetDpi,
      copies,
      settings.cutMarks,
      settings.studioName,
      settings.studioPhone,
      settings.studioNote,
      settings.studioColour,
      settings.studioCard,
      settings.studioMark,
    ],
  );

  const sheeting = settings.sheet && layout.capacity > 0;
  const sheetPxW = Math.round(mmToPx(settings.sheetW, sheetDpi));
  const sheetPxH = Math.round(mmToPx(settings.sheetH, sheetDpi));

  /** Draws the current result; `forExport` forces a JPEG-safe opaque background. */
  const build = useCallback(
    (forExport: boolean, canvas?: HTMLCanvasElement) => {
      if (!graded) return null;
      // Never on the export path. A file baked to look like ink and then sent to
      // a printer would take the loss a second time, and come back worse than
      // the untouched one.
      const proofing = !forExport && settings.proof;

      if (!sheeting) {
        const photo = compose(graded, forExport ? exportSpec : spec, canvas);
        if (proofing) proofShareRef.current = proofCanvas(photo);
        return photo;
      }

      // Proofed before tiling rather than after: a sheet is one photo repeated,
      // so both routes show the same thing, and this one touches a fortieth of
      // the pixels. Proofing a finished A4 sheet took a second and a quarter.
      const photo = compose(graded, spec);
      if (proofing) proofShareRef.current = proofCanvas(photo);
      // Paper is already white, so the photo keeps its own alpha here.
      return composeSheet(photo, sheetSpec, layout, canvas);
    },
    [graded, sheeting, spec, exportSpec, sheetSpec, layout, settings.proof],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graded) return;
    proofShareRef.current = null;
    build(false, canvas);
    setProofShare(proofShareRef.current);
    // Only ever the visible canvas: `build(true)` composes into its own surface,
    // so an export cannot pick this up. See the note in watermark.ts.
    if (!allowed) {
      const ctx = canvas.getContext("2d");
      if (ctx) drawWatermark(ctx, canvas.width, canvas.height);
    }
  }, [build, graded, allowed]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!graded) {
        setEstimate(null);
        return;
      }
      const canvas = build(true);
      canvas?.toBlob(
        (blob) => {
          if (!cancelled) setEstimate(blob?.size ?? null);
        },
        settings.format,
        settings.quality,
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [graded, build, settings.format, settings.quality]);

  const printWmm = sheeting ? settings.sheetW : photoWmm;
  const printHmm = sheeting ? settings.sheetH : photoHmm;

  const handlePrint = useCallback(async () => {
    if (!graded) return;
    if (!(await claim())) return;
    try {
      const canvas = build(true);
      if (!canvas) return;
      // Goes through `exportCanvas` rather than straight to `toBlob` so the
      // printed file is tagged sRGB like the downloaded one. A bare PNG leaves
      // the printer driver to guess the colour space, and it guesses wrong.
      const blob = await exportCanvas(canvas, "image/png", 1, sheeting ? sheetDpi : settings.dpi);
      await printAtSize(blob, printWmm, printHmm);
    } catch {
      setError("Не удалось открыть печать.");
    }
  }, [graded, build, printWmm, printHmm, claim, sheeting, sheetDpi, settings.dpi]);

  const handleDownload = useCallback(async () => {
    if (!graded) return;
    if (!(await claim())) return;
    try {
      const canvas = build(true);
      if (!canvas) return;
      const blob = await exportCanvas(
        canvas,
        settings.format,
        settings.quality,
        sheeting ? sheetDpi : settings.dpi,
      );
      const stem = file ? fileStem(file.name) : "photopoly";
      // Transliterated rather than Cyrillic: this ends up as a filename, and
      // print shops still hand out USB sticks and kiosks that mangle non-ASCII.
      const tag = sheeting
        ? `list-${copies}sht-${settings.sheetW}x${settings.sheetH}mm`
        : `${targetW}x${targetH}`;
      download(blob, `${stem}-${tag}.${extensionFor(settings.format)}`);
    } catch {
      setError("Не удалось сохранить файл. Попробуйте размер поменьше.");
    }
  }, [
    graded,
    build,
    settings.format,
    settings.quality,
    settings.dpi,
    settings.sheetW,
    settings.sheetH,
    sheeting,
    sheetDpi,
    copies,
    file,
    targetW,
    targetH,
    claim,
  ]);

  return (
    <main className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="shrink-0 border-b border-line bg-pit">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <h1 className="text-[17px] font-semibold tracking-tight text-chalk">photopoly</h1>
          </Link>
          <p className="hidden text-[13px] text-dust md:block">
            Удаление фона · точный размер
          </p>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Отменить (Ctrl+Z)"
                aria-label="Отменить"
                className="rounded-l-lg border border-line bg-slab px-2.5 py-1.5 text-[14px] text-ash transition-colors enabled:hover:bg-riser enabled:hover:text-chalk disabled:opacity-30"
              >
                ↶
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Вернуть (Ctrl+Shift+Z)"
                aria-label="Вернуть"
                className="-ml-px rounded-r-lg border border-line bg-slab px-2.5 py-1.5 text-[14px] text-ash transition-colors enabled:hover:bg-riser enabled:hover:text-chalk disabled:opacity-30"
              >
                ↷
              </button>
            </div>
            <Link
              href="/hisob"
              title="Мой аккаунт"
              className={`rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                allowed
                  ? "border-line bg-slab text-ash hover:border-line-lit hover:text-chalk"
                  : "border-ember/40 bg-ember/10 text-ember"
              }`}
            >
              {entitlement ? describeQuota(entitlement) : "Проверяем…"}
            </Link>
            <OfflineBadge quality={settings.model} warming={warming} />

            <span className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              <span className="text-[12px] text-ash font-medium">
                Работает в браузере
              </span>
            </span>
          </div>
        </div>
        {/* Measurement edge — the strip you'd find along a lightbox. */}
        <div
          aria-hidden
          className="h-1.5 w-full opacity-60"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--color-line-lit) 0 1px, transparent 1px 12px)",
          }}
        />
      </header>

      <OfflineReady />

      {/* The allowance has its own troubles to report — an expired session, a
          connection that went down before the limit was ever known — and they
          belong in the same line as everything else that went wrong. */}
      {error ?? problem ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-ember/50 bg-ember/12 px-5 py-2.5">
          <span className="text-[12px] text-safe font-medium">
            Xato
          </span>
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

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
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
        <Stage
          canvasRef={canvasRef}
          hasImage={Boolean(source)}
          busy={busy}
          progress={busy ? (progress ?? { label: "Подготовка", ratio: 0 }) : null}
          targetW={sheeting ? sheetPxW : targetW}
          targetH={sheeting ? sheetPxH : targetH}
          unit={sheeting ? "mm" : settings.unit}
          dpi={sheeting ? sheetDpi : settings.dpi}
          transparent={!sheeting && settings.background === "transparent"}
          onFile={onFile}
          onPick={onPick}
        />
        <aside className="w-full shrink-0 border-t border-line lg:h-full lg:w-88 lg:border-l lg:border-t-0">
          <Panel
            onNewPhoto={onPick}
            settings={settings}
            patch={patch}
            attireAssets={attireAssets}
            targetW={sheeting ? sheetPxW : targetW}
            targetH={sheeting ? sheetPxH : targetH}
            hasImage={Boolean(source)}
            busy={busy}
            repairing={repairing}
            canExport={allowed}
            estimate={estimate}
            proofShare={proofShare}
            onDownload={handleDownload}
            layout={layout}
            copies={copies}
            sheetDpi={sheetDpi}
            photoWmm={photoWmm}
            photoHmm={photoHmm}
            onPrint={handlePrint}
            printWmm={printWmm}
            printHmm={printHmm}
            onEdit={() => setEditing(true)}
            canEdit={Boolean(ready && original)}
            strokeCount={strokes.length}
            onReset={resetSettings}
          />
        </aside>
      </div>

      {blocked ? (
        <QuotaWall
          entitlement={entitlement}
          onClose={dismiss}
          stayLabel="Остаться в редакторе"
        />
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
    </main>
  );
}
