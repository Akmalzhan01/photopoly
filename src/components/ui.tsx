"use client";

import { useState, type ReactNode } from "react";

export function Section({
  index,
  title,
  aside,
  children,
}: {
  index: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line px-5 py-5">
      <header className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-riser px-1.5 text-[11px] font-semibold text-ash tabular-nums">
          {index.replace(/^0(?=d)/, "")}
        </span>
        <h2 className="text-[13px] font-semibold text-chalk">{title}</h2>
        {aside ? <div className="ml-auto">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[12px] text-dust font-medium">
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-flow-col auto-cols-fr gap-0.5 rounded-lg bg-riser p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
              active
                ? "bg-slab text-chalk shadow-card"
                : "text-dust hover:text-chalk"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Reads a number the way a person types one: one character at a time.
 *
 * The old version parsed and clamped on every keystroke, which made it
 * impossible to use. Typing into a field holding 200 gave 2006 for an instant,
 * that clamped to the maximum, and from then on every further keypress
 * re-clamped to the maximum — the field stuck there and could not be brought
 * back down. Emptying it did not help either: an empty string does not parse,
 * so the old value was restored under the cursor. Decimals were unreachable for
 * the same reason — "62." parses as 62, and the dot was eaten as it was typed.
 *
 * So the field holds the text while it is being edited and only reports numbers
 * it can actually read. Checking happens when the field is left, not between
 * keystrokes, because half-typed input is not wrong — it is half-typed.
 *
 * `type="text"` rather than `type="number"`: a number input refuses to hold
 * "62," at all, and a comma is how half of this interface's readers write a
 * decimal point.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 100000,
  step,
  suffix,
  hint,
  clamp = true,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  /** When false the range is advice, not a fence — the caller warns instead. */
  clamp?: boolean;
  placeholder?: string;
}) {
  // `null` means "whatever the value is"; a string means the person is typing.
  // Held as state rather than synced from the prop in an effect, so there is
  // never a render where the field disagrees with itself.
  const [draft, setDraft] = useState<string | null>(null);

  const show = (n: number) =>
    Number.isFinite(n) ? String(Math.round(n * 1000) / 1000).replace(".", ",") : "";

  const read = (text: string): number | null => {
    const cleaned = text.replace(/\s/g, "").replace(",", ".");
    if (cleaned === "") return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <label className="group flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center border border-line bg-pit transition-colors focus-within:border-safe/50 rounded-lg">
        <input
          type="text"
          inputMode="decimal"
          step={step}
          placeholder={placeholder}
          value={draft ?? show(value)}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = read(event.target.value);
            // Report it as soon as it reads as a number so the drawing keeps up,
            // but leave the text exactly as typed.
            if (next !== null) onChange(clamp ? Math.min(max, Math.max(min, next)) : next);
          }}
          onBlur={(event) => {
            const next = read(event.target.value);
            // Nothing readable in there — put back the last number that was.
            if (next !== null && clamp) onChange(Math.min(max, Math.max(min, next)));
            setDraft(null);
          }}
          className="w-full min-w-0 bg-transparent px-2.5 py-2 text-sm text-chalk outline-none placeholder:text-dust tabular-nums"
        />
        {suffix ? (
          <span className="shrink-0 pr-2.5 text-[12px] text-dust tabular-nums">{suffix}</span>
        ) : null}
      </div>
      {hint ? <span className="text-[12px] text-dust tabular-nums">{hint}</span> : null}
    </label>
  );
}

/**
 * A plain line of text. Unlike `NumberField` there is nothing to parse, so the
 * value is reported as typed and trimmed only where it is used — trimming here
 * would eat the space between two words as it is being typed.
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 48,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="group flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center border border-line bg-pit transition-colors focus-within:border-safe/50 rounded-lg">
        <input
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, " "))}
          className="w-full min-w-0 bg-transparent px-2.5 py-2 text-sm text-chalk outline-none placeholder:text-dust"
        />
      </div>
      {hint ? <span className="text-[12px] leading-snug text-dust">{hint}</span> : null}
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  onReset,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
  onReset?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col ${disabled ? "opacity-40" : ""}`}>
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={onReset}
          disabled={!onReset || disabled}
          title={onReset ? "Вернуть исходное значение" : undefined}
          className="text-[13px] text-ash tabular-nums transition-colors enabled:hover:text-safe disabled:cursor-default"
        >
          {display}
        </button>
      </div>
      <input
        type="range"
        className="rail"
        aria-label={label}
        aria-valuetext={display}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-[12px] leading-snug text-chalk">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-safe" : "bg-line-lit"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

export function ColourPicker({
  value,
  onChange,
  title = "Свой цвет",
}: {
  value: string;
  onChange: (value: string) => void;
  title?: string;
}) {
  return (
    <label
      className="relative h-8 w-8 cursor-pointer border border-line transition-colors hover:border-line-lit rounded-lg"
      title={title}
      style={{
        background: "conic-gradient(#ff5c26, #ffd166, #06d6a0, #118ab2, #ef476f, #ff5c26)",
      }}
    >
      <input
        type="color"
        aria-label={title}
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value === "transparent" ? "#ffffff" : value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Swatch({
  color,
  active,
  title,
  onClick,
}: {
  color: string;
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`relative h-8 w-8 border transition-all duration-150 ${
        active
          ? "border-safe shadow-[0_0_0_3px] shadow-safe/15"
          : "border-line hover:border-line-lit"
      } ${color === "transparent" ? "checkerboard" : ""} rounded-lg`}
      style={color === "transparent" ? undefined : { backgroundColor: color }}
    />
  );
}
