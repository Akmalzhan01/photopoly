"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOARDS,
  KINDS,
  SIDE_LABELS,
  buildBlank,
  initialSpec,
  knobsFor,
  mm,
  type BoxKind,
  type BoxSpec,
  type Knob,
} from "@/lib/box";
import { fileName, renderDxf, renderPreview, renderSheet } from "@/lib/box-drawing";
import { printAtSize } from "@/lib/print";
import { loadBox, saveBox } from "@/lib/storage";
import { Button, Notice, Panel } from "@/components/site/ui";
import { Label, NumberField, Segmented } from "@/components/ui";
import { BoxFold } from "./BoxFold";

/** Hands the browser a file without a round trip to anything. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function BoardPicker({
  thickness,
  onChange,
}: {
  thickness: number;
  onChange: (value: number) => void;
}) {
  const match = BOARDS.find((board) => board.thickness === thickness);
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <Label>Материал</Label>
      {/* Just the name in the list: a native select truncates whatever does not
          fit, and "Микрогофра — Л…" is worse than no note at all. */}
      <select
        value={match ? String(match.thickness) : "custom"}
        onChange={(event) => {
          if (event.target.value === "custom") return;
          onChange(Number(event.target.value));
        }}
        className="w-full border border-line bg-pit px-2.5 py-2 text-sm text-chalk outline-none transition-colors focus:border-safe/50"
      >
        {BOARDS.map((board) => (
          <option key={board.label} value={board.thickness}>
            {board.label}
          </option>
        ))}
        {match ? null : <option value="custom">Своя толщина</option>}
      </select>
    </label>
  );
}

export function BoxStudio() {
  const [spec, setSpec] = useState<BoxSpec>(initialSpec);
  const [job, setJob] = useState("");
  const [run, setRun] = useState(0);
  const [printing, setPrinting] = useState(false);
  const [problem, setProblem] = useState("");
  const [tuning, setTuning] = useState(false);

  // Same reason as the editor: localStorage is not there on the server, and
  // seeding from it would make the first client render disagree with the markup
  // the server sent.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = loadBox();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    if (stored) setSpec(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveBox(spec), 400);
    return () => clearTimeout(timer);
  }, [spec, hydrated]);

  const patch = useCallback((next: Partial<BoxSpec>) => {
    setSpec((prev) => ({ ...prev, ...next }));
  }, []);

  const tweak = useCallback((key: Knob, value: number | null) => {
    setSpec((prev) => {
      const tweaks = { ...prev.tweaks };
      if (value === null) delete tweaks[key];
      else tweaks[key] = value;
      return { ...prev, tweaks };
    });
  }, []);

  const blank = useMemo(() => buildBlank(spec), [spec]);
  const knobs = useMemo(() => knobsFor(spec), [spec]);
  const [sideA, sideB, sideC] = SIDE_LABELS[spec.kind];
  const overridden = knobs.some((knob) => knob.set);

  /**
   * The date is read when a file is made, not while rendering.
   *
   * A clock in the render output is a hydration mismatch waiting to happen —
   * the server's second and the browser's are not the same second.
   */
  const jobLine = () => [job.trim(), run > 0 ? `${run} шт` : ""].filter(Boolean).join(", ");
  const today = () => new Date().toLocaleDateString("ru-RU");

  const onPrint = async () => {
    setProblem("");
    setPrinting(true);
    try {
      const sheet = renderSheet(blank, { job: jobLine(), today: today() });
      const blob = new Blob([sheet.svg], { type: "image/svg+xml" });
      const w = sheet.landscape ? sheet.paper.height : sheet.paper.width;
      const h = sheet.landscape ? sheet.paper.width : sheet.paper.height;
      await printAtSize(blob, w, h);
    } catch {
      setProblem("Не удалось открыть печать. Скачайте чертёж файлом.");
    } finally {
      setPrinting(false);
    }
  };

  const onSvg = () => {
    const sheet = renderSheet(blank, { job: jobLine(), today: today() });
    download(new Blob([sheet.svg], { type: "image/svg+xml" }), fileName(blank, "svg"));
  };

  const onDxf = () => {
    download(new Blob([renderDxf(blank)], { type: "application/dxf" }), fileName(blank, "dxf"));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Тип коробки</Label>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((kind) => {
              const active = kind.value === spec.kind;
              return (
                <button
                  key={kind.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ kind: kind.value as BoxKind })}
                  className={`border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-safe bg-safe/12"
                      : "border-line hover:border-line-lit hover:bg-riser"
                  }`}
                >
                  <span className={`block text-[13px] ${active ? "text-safe-soft" : "text-chalk"}`}>
                    {kind.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] leading-tight text-dust">
                    {kind.note}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Segmented
            ariaLabel="Какие размеры вы вводите"
            value={spec.measure}
            onChange={(measure) => patch({ measure })}
            options={[
              { value: "inner", label: "Внутренние", title: "Сколько места внутри коробки" },
              { value: "outer", label: "Наружные", title: "Габариты готовой коробки снаружи" },
            ]}
          />
          {/* The one question that ruins a batch if it is assumed rather than
              asked, so it is answered in words under the switch. */}
          <p className="font-mono text-[10px] leading-relaxed text-dust">
            {spec.measure === "inner"
              ? "Столько места остаётся внутри. Снаружи коробка будет больше на толщину материала."
              : "Габариты готовой коробки. Внутри места будет меньше на толщину материала."}
          </p>
        </div>

        {/* No ceiling on any of these. The numbers are the shop's business; an
            unusual one gets said out loud below and drawn anyway. */}
        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label={sideA}
            suffix="мм"
            clamp={false}
            value={spec.length}
            onChange={(length) => patch({ length })}
          />
          <NumberField
            label={sideB}
            suffix="мм"
            clamp={false}
            value={spec.width}
            onChange={(width) => patch({ width })}
          />
          <NumberField
            label={sideC}
            suffix="мм"
            clamp={false}
            value={spec.height}
            onChange={(height) => patch({ height })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2">
            <BoardPicker thickness={spec.thickness} onChange={(thickness) => patch({ thickness })} />
            <NumberField
              label="Толщина"
              suffix="мм"
              clamp={false}
              value={spec.thickness}
              onChange={(thickness) => patch({ thickness })}
            />
          </div>
          <p className="font-mono text-[10px] leading-relaxed text-dust">
            {BOARDS.find((board) => board.thickness === spec.thickness)?.note ??
              "Своя толщина — возьмите её у поставщика картона."}
          </p>
        </div>

        {spec.kind === "tray" ? (
          <NumberField
            label="Высота крышки"
            suffix="мм"
            clamp={false}
            value={spec.lidDrop}
            onChange={(lidDrop) => patch({ lidDrop })}
          />
        ) : null}

        <div className="border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setTuning((open) => !open)}
            aria-expanded={tuning}
            className="flex w-full items-baseline gap-2 text-left"
          >
            <span className="font-mono text-[10px] text-ember">{tuning ? "▾" : "▸"}</span>
            <Label>Тонкая настройка</Label>
            {overridden ? (
              <span className="ml-auto font-mono text-[10px] text-safe-soft">изменено</span>
            ) : null}
          </button>

          {tuning ? (
            <div className="mt-4 flex flex-col gap-4">
              <p className="font-mono text-[10px] leading-relaxed text-dust">
                Это пропорции, а не расчёт — типовые значения, с которых удобно
                начать. Меняйте как нужно, они попадут и в чертёж, и в DXF.
              </p>
              {knobs.map((knob) => (
                <div key={knob.key} className="flex flex-col gap-1">
                  <NumberField
                    label={knob.label}
                    suffix="мм"
                    clamp={false}
                    value={knob.value}
                    onChange={(value) => tweak(knob.key, value)}
                  />
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] leading-relaxed text-dust">
                      {knob.note}
                    </span>
                    {knob.set ? (
                      <button
                        type="button"
                        onClick={() => tweak(knob.key, null)}
                        className="ml-auto shrink-0 font-mono text-[10px] text-ash underline-offset-2 transition-colors hover:text-safe"
                      >
                        ↺ {mm(knob.auto)}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {overridden ? (
                <button
                  type="button"
                  onClick={() => patch({ tweaks: {} })}
                  className="self-start font-mono text-[10px] uppercase tracking-[0.14em] text-ash transition-colors hover:text-safe"
                >
                  ↺ Вернуть все
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <label className="flex flex-col gap-1.5">
            <Label>Заказ</Label>
            <input
              value={job}
              maxLength={60}
              placeholder="Кто заказал"
              onChange={(event) => setJob(event.target.value)}
              className="border border-line bg-pit px-2.5 py-2 text-sm text-chalk outline-none transition-colors placeholder:text-dust focus:border-safe/50"
            />
          </label>
          <NumberField label="Тираж" suffix="шт" value={run} min={0} max={9_999_999} onChange={setRun} />
          <p className="font-mono text-[10px] leading-relaxed text-dust">
            Попадёт в штамп чертежа — чтобы типография знала, что это за работа.
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-3">
            <Panel className="flex min-h-[300px] items-center justify-center bg-pit p-6">
              <div
                className="w-full max-w-full text-chalk [&>svg]:max-h-[38vh] [&>svg]:w-full"
                /* Ours, start to finish: the only text in it comes from the
                   constants in `box.ts`, escaped on the way in regardless. */
                dangerouslySetInnerHTML={{ __html: renderPreview(blank.pieces[0]) }}
              />
            </Panel>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {blank.pieces.map((piece) => (
                <span key={piece.label} className="font-mono text-[11px] text-ash tabular-nums">
                  <span className="text-dust">{piece.label}: </span>
                  {mm(piece.width)} × {mm(piece.height)} мм
                </span>
              ))}
              <span className="font-mono text-[11px] text-dust">развёрнутый лист</span>
            </div>
          </div>

          {blank.pieces[0].faces ? (
            <BoxFold
              root={blank.pieces[0].faces}
              note={
                spec.kind === "pillow"
                  ? "Торцы показаны приблизительно: в жизни они скругляются, а не складываются по прямой."
                  : undefined
              }
            />
          ) : null}
        </div>

        {blank.pieces.length > 1 ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
            <Panel className="flex items-center justify-center bg-pit p-6">
              <div
                className="w-full max-w-full text-chalk [&>svg]:max-h-[30vh] [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: renderPreview(blank.pieces[1]) }}
              />
            </Panel>
            {blank.pieces[1].faces ? (
              <BoxFold
                root={blank.pieces[1].faces}
                note="Крышка"
              />
            ) : null}
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-line pt-4 sm:grid-cols-4">
          {blank.facts.map((fact) => (
            <div key={fact.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
                {fact.label}
              </dt>
              <dd className="mt-0.5 text-[13px] text-chalk">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {blank.warnings.map((warning) => (
          <Notice key={warning} tone="warn">
            {warning}
          </Notice>
        ))}

        {problem ? <Notice tone="warn">{problem}</Notice> : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button onClick={onPrint} disabled={printing}>
            {printing ? "Готовим…" : "Печать / PDF"}
          </Button>
          <Button tone="ghost" onClick={onDxf}>
            DXF для штампа
          </Button>
          <Button tone="ghost" onClick={onSvg}>
            SVG
          </Button>
        </div>

        <p className="text-[12px] leading-relaxed text-dust">
          DXF — рабочий файл: один к одному, в миллиметрах, рез и биговка на
          отдельных слоях. Его и отдавайте в типографию. Чертёж в PDF — тот же
          размер, но в масштабе и с размерными линиями: он для человека, который
          будет читать.
        </p>
      </div>
    </div>
  );
}
