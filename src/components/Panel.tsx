"use client";

import type { AttireAssetView } from "@/lib/attire";
import { isNeutral } from "@/lib/colour";
import { formatBytes, type ExportFormat } from "@/lib/imaging";
import { PRESET_GROUPS, PRESETS } from "@/lib/presets";
import type { Settings } from "@/lib/settings";
import { SHEET_PRESETS, type SheetLayout } from "@/lib/sheet";
import { UNITS, type Unit } from "@/lib/units";
import Link from "next/link";
import {
  ColourPicker,
  Label,
  NumberField,
  Section,
  Segmented,
  Slider,
  Swatch,
  Toggle,
} from "./ui";

const BORDER_COLOURS = [
  { colour: "#14161c", title: "Чёрная" },
  { colour: "#ffffff", title: "Белая" },
  { colour: "#8d1f2d", title: "Бордовая" },
  { colour: "#1d3f6e", title: "Синяя" },
  { colour: "#b8a06a", title: "Золотая" },
];

/** Colour sliders read better as -100…+100 with an explicit sign. */
const signed = (value: number) =>
  `${value > 0 ? "+" : ""}${Math.round(value * 100)}`;

const BACKGROUNDS = [
  { color: "transparent", title: "Прозрачный" },
  { color: "#ffffff", title: "Белый" },
  { color: "#f2ede4", title: "Слоновая кость" },
  { color: "#d8dee3", title: "Серый" },
  { color: "#0f0d0c", title: "Чёрный" },
];

type PanelProps = {
  settings: Settings;
  patch: (next: Partial<Settings>) => void;
  /** Suits an admin uploaded, offered alongside the drawn ones. */
  attireAssets: AttireAssetView[];
  targetW: number;
  targetH: number;
  hasImage: boolean;
  busy: boolean;
  /** False once the export allowance is spent — both outputs are refused. */
  canExport: boolean;
  estimate: number | null;
  /** Share of the picture ink would visibly change; null while not proofing. */
  proofShare: number | null;
  onDownload: () => void;
  layout: SheetLayout;
  copies: number;
  sheetDpi: number;
  photoWmm: number;
  photoHmm: number;
  onPrint: () => void;
  printWmm: number;
  printHmm: number;
  onEdit: () => void;
  canEdit: boolean;
  strokeCount: number;
  onReset: () => void;
};

export function Panel({
  settings,
  patch,
  attireAssets,
  targetW,
  targetH,
  hasImage,
  busy,
  canExport,
  estimate,
  proofShare,
  onDownload,
  layout,
  copies,
  sheetDpi,
  photoWmm,
  photoHmm,
  onPrint,
  printWmm,
  printHmm,
  onEdit,
  canEdit,
  strokeCount,
  onReset,
}: PanelProps) {
  const lossy = settings.format !== "image/png";
  const physical = settings.unit !== "px";
  const fits = layout.capacity > 0;
  const tinted = !isNeutral(settings);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slab">
      <Section
        index="01"
        title="Размер"
        aside={
          <span className="font-mono text-[10px] text-dust tabular-nums">
            {targetW}×{targetH}
          </span>
        }
      >
        <div className="space-y-4">
          {PRESET_GROUPS.map((group) => (
            <div key={group}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dust">
                  {group}
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.filter((preset) => preset.group === group).map((preset) => {
                  const active = preset.id === settings.presetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => patch({ presetId: preset.id })}
                      className={`border-l-2 px-2.5 py-2 text-left transition-colors duration-150 ${
                        active
                          ? "border-l-safe bg-safe/10"
                          : "border-l-line bg-riser/50 hover:border-l-line-lit hover:bg-riser"
                      }`}
                    >
                      <span
                        className={`block font-mono text-[11px] ${
                          active ? "text-safe-soft" : "text-chalk"
                        }`}
                      >
                        {preset.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-dust">
                        {preset.note}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <NumberField
              label="Ширина"
              value={settings.width}
              min={physical ? 0.1 : 16}
              step={physical ? 0.5 : 10}
              suffix={settings.unit}
              onChange={(width) => patch({ width })}
            />
            <NumberField
              label="Высота"
              value={settings.height}
              min={physical ? 0.1 : 16}
              step={physical ? 0.5 : 10}
              suffix={settings.unit}
              onChange={(height) => patch({ height })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Единица</Label>
            <Segmented<Unit>
              ariaLabel="Единица измерения"
              value={settings.unit}
              options={UNITS.map((unit) => ({ value: unit, label: unit }))}
              onChange={(unit) => patch({ unit })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Плотность (DPI)</Label>
            <Segmented<string>
              ariaLabel="Плотность точек"
              value={String(settings.dpi)}
              options={[
                { value: "72", label: "72", title: "Экран" },
                { value: "150", label: "150", title: "Обычная печать" },
                { value: "300", label: "300", title: "Печать документов" },
                { value: "600", label: "600", title: "Высокое качество" },
              ]}
              onChange={(dpi) => patch({ dpi: Number(dpi) })}
            />
            <p className="text-[10px] leading-snug text-dust">
              {physical
                ? "Физический размер переводится в пиксели по этой плотности."
                : "В пиксельном режиме записывается только в метаданные файла."}
            </p>
          </div>
        </div>
      </Section>

      <Section index="02" title="Фон">
        <div className="space-y-4">
          <Toggle
            label="Убирать фон с помощью ИИ"
            checked={settings.removeBg}
            onChange={(removeBg) => patch({ removeBg })}
          />

          {settings.removeBg ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Модель</Label>
                <Segmented
                  ariaLabel="Качество модели"
                  value={settings.model}
                  options={[
                    { value: "fast" as const, label: "Быстро", title: "Меньше загрузка" },
                    { value: "fine" as const, label: "Точно", title: "Чистые края" },
                  ]}
                  onChange={(model) => patch({ model })}
                />
              </div>

              <button
                type="button"
                disabled={!canEdit}
                onClick={onEdit}
                className="flex w-full items-center justify-between border border-line bg-riser/60 px-3 py-2.5 transition-colors enabled:hover:border-line-lit enabled:hover:bg-riser disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                    canEdit ? "text-chalk" : "text-dust"
                  }`}
                >
                  Поправить края
                </span>
                <span className="font-mono text-[10px] text-safe-soft tabular-nums">
                  {strokeCount > 0 ? `${strokeCount} шт.` : ""}
                </span>
              </button>
              <p className="-mt-2 text-[10px] leading-snug text-dust">
                Если волосы или очки обрезаны неверно, поправьте кистью вручную.
              </p>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label>Цвет</Label>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUNDS.map((option) => (
                <Swatch
                  key={option.color}
                  color={option.color}
                  title={`Цвет фона: ${option.title}`}
                  active={settings.background === option.color}
                  onClick={() => patch({ background: option.color })}
                />
              ))}
              <ColourPicker
                value={settings.background}
                onChange={(background) => patch({ background })}
              />
            </div>
            {settings.background === "transparent" && settings.format === "image/jpeg" ? (
              <p className="text-[10px] leading-snug text-safe-soft">
                JPEG не хранит прозрачность — при скачивании фон станет белым.
              </p>
            ) : null}
          </div>
        </div>
      </Section>

      <Section
        index="03"
        title="Цвет"
        aside={
          tinted ? (
            <button
              type="button"
              onClick={() =>
                patch({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 })
              }
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-safe-soft transition-colors hover:text-safe"
            >
              Сбросить
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <Slider
            label="Яркость"
            value={settings.brightness}
            min={-1}
            max={1}
            step={0.02}
            display={signed(settings.brightness)}
            onChange={(brightness) => patch({ brightness })}
            onReset={() => patch({ brightness: 0 })}
          />
          <Slider
            label="Контраст"
            value={settings.contrast}
            min={-1}
            max={1}
            step={0.02}
            display={signed(settings.contrast)}
            onChange={(contrast) => patch({ contrast })}
            onReset={() => patch({ contrast: 0 })}
          />
          <Slider
            label="Насыщенность"
            value={settings.saturation}
            min={-1}
            max={1}
            step={0.02}
            display={signed(settings.saturation)}
            onChange={(saturation) => patch({ saturation })}
            onReset={() => patch({ saturation: 0 })}
          />
          <Slider
            label="Теплота"
            value={settings.warmth}
            min={-1}
            max={1}
            step={0.02}
            display={signed(settings.warmth)}
            onChange={(warmth) => patch({ warmth })}
            onReset={() => patch({ warmth: 0 })}
          />
          <p className="text-[10px] leading-snug text-dust">
            Снимок, сделанный под жёлтой лампой, поправляется сдвигом
            Теплоты в минус.
          </p>
        </div>
      </Section>

      <Section index="04" title="Одежда и рамка">
        <div className="space-y-4">
          {attireAssets.length === 0 ? (
            <p className="text-[10px] leading-snug text-dust">
              Одежда пока не загружена. PNG с прозрачным фоном добавляется в разделе
              &laquo;Костюмы&raquo; админ-панели.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label>Одежда</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => patch({ attireAssetId: null })}
                  className={`flex flex-col items-center justify-center gap-1 border p-1.5 transition-colors duration-150 ${
                    settings.attireAssetId === null
                      ? "border-safe bg-safe/10"
                      : "border-line bg-riser/50 hover:border-line-lit hover:bg-riser"
                  }`}
                >
                  <span className="flex h-10 items-center font-mono text-[16px] text-dust">
                    &times;
                  </span>
                  <span
                    className={`w-full truncate text-center text-[9px] leading-tight ${
                      settings.attireAssetId === null ? "text-safe-soft" : "text-dust"
                    }`}
                  >
                    Нет
                  </span>
                </button>

                {attireAssets.map((asset) => {
                  const active = settings.attireAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      title={asset.name}
                      onClick={() => patch({ attireAssetId: asset.id })}
                      className={`flex flex-col items-center gap-1 border p-1.5 transition-colors duration-150 ${
                        active
                          ? "border-safe bg-safe/10"
                          : "border-line bg-riser/50 hover:border-line-lit hover:bg-riser"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a
                          Storage CDN URL; routing it through the Image loader
                          would add a server hop to a purely visual thumbnail. */}
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="h-10 w-full object-contain"
                      />
                      <span
                        className={`w-full truncate text-center text-[9px] leading-tight ${
                          active ? "text-safe-soft" : "text-dust"
                        }`}
                      >
                        {asset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {settings.attireAssetId ? (
            <>
              <Slider
                label="Ширина одежды"
                value={settings.attireScale}
                min={0.4}
                max={3}
                step={0.02}
                display={`${settings.attireScale.toFixed(2)}×`}
                onChange={(attireScale) => patch({ attireScale })}
                onReset={() => patch({ attireScale: 1.2 })}
              />
              <Slider
                label="Одежда: по горизонтали"
                value={settings.attireOffsetX}
                min={-0.5}
                max={0.5}
                step={0.005}
                display={signed(settings.attireOffsetX)}
                onChange={(attireOffsetX) => patch({ attireOffsetX })}
                onReset={() => patch({ attireOffsetX: 0 })}
              />
              <Slider
                label="Одежда: по вертикали"
                value={settings.attireOffsetY}
                min={-0.5}
                max={0.5}
                step={0.005}
                display={signed(settings.attireOffsetY)}
                onChange={(attireOffsetY) => patch({ attireOffsetY })}
                onReset={() => patch({ attireOffsetY: 0 })}
              />
              <p className="text-[10px] leading-snug text-dust">
                Одежда располагается относительно кадра — независимо от масштаба и
                сдвига фотографии, поэтому настраиваются они по отдельности.
              </p>
            </>
          ) : null}


          <div className="space-y-3 border-t border-line pt-4">
            <NumberField
              label="Толщина рамки"
              value={settings.borderWidth}
              min={0}
              max={400}
              step={1}
              suffix="px"
              onChange={(borderWidth) => patch({ borderWidth })}
            />
            <div className="flex flex-col gap-2">
              <Label>Цвет рамки</Label>
              <div className="flex flex-wrap items-center gap-2">
                {BORDER_COLOURS.map((option) => (
                  <Swatch
                    key={option.colour}
                    color={option.colour}
                    title={`Цвет рамки: ${option.title}`}
                    active={settings.borderColour === option.colour}
                    onClick={() => patch({ borderColour: option.colour })}
                  />
                ))}
                <ColourPicker
                  value={settings.borderColour}
                  onChange={(borderColour) => patch({ borderColour })}
                />
              </div>
            </div>
            <p className="text-[10px] leading-snug text-dust">
              {settings.borderWidth > 0
                ? `Рамка рисуется внутри кадра — размер на выходе остаётся ${targetW}×${targetH} px. Примерно ${((settings.borderWidth / settings.dpi) * 25.4).toFixed(2)} мм.`
                : "0 — без рамки."}
            </p>
          </div>
        </div>
      </Section>

      <Section index="05" title="Расположение">
        <div className="space-y-4">
          <Segmented
            ariaLabel="Способ вписывания"
            value={settings.fit}
            options={[
              { value: "contain" as const, label: "Целиком", title: "Виден весь объект" },
              { value: "cover" as const, label: "По кадру", title: "Заполняет кадр, края обрезаются" },
            ]}
            onChange={(fit) => patch({ fit })}
          />
          <Slider
            label="Отступ от краёв"
            value={settings.padding}
            min={0}
            max={0.35}
            step={0.01}
            display={`${Math.round(settings.padding * 100)}%`}
            onChange={(padding) => patch({ padding })}
            onReset={() => patch({ padding: 0.08 })}
          />
          <Slider
            label="Масштаб"
            value={settings.zoom}
            min={0.4}
            max={2.5}
            step={0.01}
            display={`${settings.zoom.toFixed(2)}×`}
            onChange={(zoom) => patch({ zoom })}
            onReset={() => patch({ zoom: 1 })}
          />
          <Slider
            label="Поворот"
            value={settings.rotate}
            min={-180}
            max={180}
            step={0.5}
            display={`${settings.rotate > 0 ? "+" : ""}${settings.rotate.toFixed(1)}°`}
            onChange={(rotate) => patch({ rotate })}
            onReset={() => patch({ rotate: 0 })}
          />
          {settings.rotate !== 0 ? (
            <p className="text-[10px] leading-snug text-dust">
              Размер лица не меняется при повороте — это важно для документов.
              Если по углам появился фон, добавьте масштаб.
            </p>
          ) : null}
          <Slider
            label="Сдвиг по горизонтали"
            value={settings.offsetX}
            min={-0.5}
            max={0.5}
            step={0.005}
            display={`${settings.offsetX > 0 ? "+" : ""}${Math.round(settings.offsetX * 100)}%`}
            onChange={(offsetX) => patch({ offsetX })}
            onReset={() => patch({ offsetX: 0 })}
          />
          <Slider
            label="Сдвиг по вертикали"
            value={settings.offsetY}
            min={-0.5}
            max={0.5}
            step={0.005}
            display={`${settings.offsetY > 0 ? "+" : ""}${Math.round(settings.offsetY * 100)}%`}
            onChange={(offsetY) => patch({ offsetY })}
            onReset={() => patch({ offsetY: 0 })}
          />
        </div>
      </Section>

      <Section
        index="06"
        title="Лист для печати"
        aside={
          settings.sheet && fits ? (
            <span className="font-mono text-[10px] text-safe-soft tabular-nums">
              {copies} шт.
            </span>
          ) : null
        }
      >
        <div className="space-y-4">
          <Toggle
            label="Разместить несколько копий на одном листе"
            checked={settings.sheet}
            onChange={(sheet) => patch({ sheet })}
          />

          {settings.sheet ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {SHEET_PRESETS.map((sheet) => {
                  const active = sheet.id === settings.sheetId;
                  return (
                    <button
                      key={sheet.id}
                      type="button"
                      onClick={() => patch({ sheetId: sheet.id })}
                      className={`border-l-2 px-2.5 py-2 text-left transition-colors duration-150 ${
                        active
                          ? "border-l-safe bg-safe/10"
                          : "border-l-line bg-riser/50 hover:border-l-line-lit hover:bg-riser"
                      }`}
                    >
                      <span
                        className={`block font-mono text-[11px] ${
                          active ? "text-safe-soft" : "text-chalk"
                        }`}
                      >
                        {sheet.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-tight text-dust">
                        {sheet.note}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  label="Ширина листа"
                  value={settings.sheetW}
                  min={20}
                  max={1000}
                  step={5}
                  suffix="mm"
                  onChange={(sheetW) => patch({ sheetW })}
                />
                <NumberField
                  label="Высота листа"
                  value={settings.sheetH}
                  min={20}
                  max={1000}
                  step={5}
                  suffix="mm"
                  onChange={(sheetH) => patch({ sheetH })}
                />
              </div>

              {fits ? (
                <>
                  <div className="border border-line bg-pit px-3 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-dust">
                        Вмещается
                      </span>
                      <span className="font-mono text-[11px] text-chalk tabular-nums">
                        {layout.cols} × {layout.rows} = {layout.capacity} шт.
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-dust">
                      Каждое {photoWmm.toFixed(1)} × {photoHmm.toFixed(1)} мм
                      {layout.rotated ? " · с поворотом на 90° влезло больше" : ""}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Ориентация</Label>
                    <Segmented
                      ariaLabel="Ориентация фото"
                      value={settings.sheetRotate}
                      options={[
                        { value: "auto" as const, label: "Авто", title: "Повернёт набок, если так влезет больше" },
                        { value: "upright" as const, label: "Вертикально", title: "Всегда стоячо" },
                      ]}
                      onChange={(sheetRotate) => patch({ sheetRotate })}
                    />
                  </div>

                  <Toggle
                    label="Заполнить лист — столько копий, сколько влезет"
                    checked={settings.fillSheet}
                    onChange={(fillSheet) => patch({ fillSheet })}
                  />
                  <Slider
                    label="Число копий"
                    value={copies}
                    min={1}
                    max={Math.max(1, layout.capacity)}
                    step={1}
                    disabled={settings.fillSheet}
                    display={`${copies} / ${layout.capacity}`}
                    onChange={(value) => patch({ copies: value })}
                    onReset={settings.fillSheet ? undefined : () => patch({ copies: 1 })}
                  />
                  <Slider
                    label="Зазор между копиями"
                    value={settings.gap}
                    min={0}
                    max={10}
                    step={0.5}
                    display={`${settings.gap} mm`}
                    onChange={(gap) => patch({ gap })}
                    onReset={() => patch({ gap: 2 })}
                  />
                  <Slider
                    label="Поля листа"
                    value={settings.margin}
                    min={0}
                    max={20}
                    step={0.5}
                    display={`${settings.margin} mm`}
                    onChange={(margin) => patch({ margin })}
                    onReset={() => patch({ margin: 4 })}
                  />
                  <Toggle
                    label="Рисовать метки реза"
                    checked={settings.cutMarks}
                    onChange={(cutMarks) => patch({ cutMarks })}
                  />
                  {sheetDpi < settings.dpi ? (
                    <p className="text-[10px] leading-snug text-safe-soft">
                      Для такого большого листа плотность снижена до {sheetDpi} dpi —
                      иначе файл получился бы огромным.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="border border-ember/50 bg-ember/10 px-3 py-2.5 text-[11px] leading-snug text-chalk">
                  Фото не помещается на этот лист. Возьмите лист побольше или
                  уменьшите поля.
                </p>
              )}
            </>
          ) : null}
        </div>
      </Section>

      <Section index="07" title="Экспорт">
        <div className="space-y-4">
          <Segmented<ExportFormat>
            ariaLabel="Формат файла"
            value={settings.format}
            options={[
              { value: "image/png", label: "PNG", title: "Сохраняет прозрачность" },
              { value: "image/jpeg", label: "JPG", title: "Самый маленький размер" },
              { value: "image/webp", label: "WEBP", title: "Современный, компактный" },
            ]}
            onChange={(format) => patch({ format })}
          />
          {lossy ? (
            <Slider
              label="Качество сжатия"
              value={settings.quality}
              min={0.4}
              max={1}
              step={0.01}
              display={`${Math.round(settings.quality * 100)}`}
              onChange={(quality) => patch({ quality })}
              onReset={() => patch({ quality: 0.92 })}
            />
          ) : null}

          <div className="border-t border-line pt-4">
            <Toggle
              label="Проба CMYK"
              checked={settings.proof}
              onChange={(proof) => patch({ proof })}
            />
            {settings.proof ? (
              <p className="mt-2 text-[10px] leading-snug text-dust">
                Так цвета лягут на бумагу. Краска не достаёт до экранных синих,
                зелёных и красных — нейтральные тона и кожа меняются мало.
                {proofShare !== null ? (
                  <>
                    {" "}
                    Заметно изменится{" "}
                    <span className="text-safe-soft tabular-nums">
                      {Math.round(proofShare * 100)}%
                    </span>{" "}
                    снимка.
                  </>
                ) : null}{" "}
                Это прикидка, а не профиль конкретной типографии. Файл
                сохраняется в sRGB без изменений.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!hasImage || busy || !canExport}
            onClick={onDownload}
            title={canExport ? undefined : "Лимит экспортов исчерпан"}
            className="group relative w-full overflow-hidden border border-safe/70 bg-safe/12 px-4 py-3.5 transition-all duration-200 enabled:hover:bg-safe/22 enabled:hover:shadow-[0_0_28px_-6px] enabled:hover:shadow-safe/50 disabled:cursor-not-allowed disabled:border-line disabled:bg-transparent"
          >
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
                hasImage && !busy && canExport ? "text-safe-soft" : "text-dust"
              }`}
            >
              {canExport ? "Скачать" : "Лимит исчерпан"}
            </span>
          </button>

          {!canExport ? (
            <div className="border border-ember/40 bg-ember/8 px-3.5 py-3">
              <p className="text-[11px] leading-snug text-ash">
                Лимит экспортов исчерпан, поэтому скачивание и печать недоступны.
                Фотография и настройки останутся на месте.
              </p>
              <Link
                href="/narxlar"
                className="mt-2.5 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-ember transition-colors hover:text-chalk"
              >
                Выбрать тариф →
              </Link>
            </div>
          ) : null}

          <div className="flex items-center justify-between font-mono text-[10px] text-dust">
            <span>
              {targetW}×{targetH} px · {settings.dpi} dpi
            </span>
            <span className="tabular-nums">
              {estimate === null ? "—" : `≈ ${formatBytes(estimate)}`}
            </span>
          </div>

          <div className="border-t border-line pt-4">
            <button
              type="button"
              disabled={!hasImage || busy || !canExport}
              onClick={onPrint}
              title={canExport ? undefined : "Лимит экспортов исчерпан"}
              className="w-full border border-line bg-riser/60 px-4 py-3 transition-colors duration-200 enabled:hover:border-line-lit enabled:hover:bg-riser disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span
                className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
                  hasImage && !busy && canExport ? "text-chalk" : "text-dust"
                }`}
              >
                Печать
              </span>
            </button>
            <p className="mt-2 text-[10px] leading-snug text-dust">
              На бумаге получится ровно{" "}
              <span className="text-ash tabular-nums">
                {printWmm.toFixed(0)} × {printHmm.toFixed(0)} мм
              </span>{" "}
              . В окне печати масштаб должен быть{" "}
              <span className="text-ash">100%</span> — &laquo;fit to page&raquo;
              ломает размер.
              {!settings.sheet
                ? " Если нужно несколько копий, сначала включите Лист для печати."
                : ""}
            </p>
          </div>
        </div>
      </Section>

      <div className="mt-auto border-t border-line px-5 py-4">
        <p className="text-[10px] leading-relaxed text-dust">
          Фото не покидает ваше устройство — и удаление фона, и подгонка
          размера делаются в этом браузере.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-dust transition-colors hover:text-safe"
        >
          Сбросить настройки
        </button>
      </div>
    </div>
  );
}
