"use client";

import type { ReactNode } from "react";

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
      <header className="mb-4 flex items-baseline gap-2.5">
        <span className="font-mono text-[10px] text-ember">{index}</span>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash">
          {title}
        </h2>
        {aside ? <div className="ml-auto">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">
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
      className="grid grid-flow-col auto-cols-fr border border-line"
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
            className={`px-2 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-150 not-first:border-l not-first:border-line ${
              active
                ? "bg-safe/12 text-safe-soft"
                : "text-dust hover:bg-riser hover:text-ash"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 100000,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="group flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center border border-line bg-pit transition-colors focus-within:border-safe/50">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-full bg-transparent px-2.5 py-2 font-mono text-sm text-chalk outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix ? (
          <span className="pr-2.5 font-mono text-[10px] text-dust">{suffix}</span>
        ) : null}
      </div>
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
          className="font-mono text-[11px] text-ash tabular-nums transition-colors enabled:hover:text-safe disabled:cursor-default"
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
        className={`relative h-5 w-9 shrink-0 border transition-colors duration-200 ${
          checked ? "border-safe bg-safe/20" : "border-line bg-pit"
        }`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 transition-transform duration-200 ${
            checked ? "translate-x-4.5 bg-safe" : "translate-x-0.5 bg-dust"
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
      className="relative h-8 w-8 cursor-pointer border border-line transition-colors hover:border-line-lit"
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
      } ${color === "transparent" ? "checkerboard" : ""}`}
      style={color === "transparent" ? undefined : { backgroundColor: color }}
    />
  );
}
