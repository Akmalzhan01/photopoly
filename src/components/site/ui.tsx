import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** The ruled index number that runs through the whole interface. */
export function Marker({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[10px] text-ember">{children}</span>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ash">{children}</span>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`border border-line bg-slab ${className}`}>{children}</div>
  );
}

type ButtonTone = "primary" | "ghost" | "danger";

const TONES: Record<ButtonTone, string> = {
  primary:
    "border-safe bg-safe/12 text-safe-soft hover:bg-safe/20 disabled:hover:bg-safe/12",
  ghost: "border-line text-ash hover:border-line-lit hover:text-chalk",
  danger: "border-ember/60 text-ember hover:bg-ember/12 hover:text-safe-soft",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

export function Button({
  tone = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { tone?: ButtonTone }) {
  return <button className={`${BUTTON_BASE} ${TONES[tone]} ${className}`} {...props} />;
}

export function LinkButton({
  tone = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone }) {
  return <Link className={`${BUTTON_BASE} ${TONES[tone]} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dust">{label}</span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={`border bg-pit px-3 py-2.5 text-sm text-chalk outline-none transition-colors placeholder:text-dust ${
          error ? "border-ember" : "border-line focus:border-safe/50"
        }`}
      />
      {error ? (
        <span role="alert" className="font-mono text-[11px] text-ember">
          {error}
        </span>
      ) : hint ? (
        <span className="font-mono text-[10px] text-dust">{hint}</span>
      ) : null}
    </label>
  );
}

/** Measurement ruler: the recurring divider used across the interface. */
export function Ruler({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-2 w-full border-t border-line ${className}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, var(--color-line) 0 1px, transparent 1px 12px)",
        backgroundSize: "12px 5px",
        backgroundRepeat: "repeat-x",
      }}
    />
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "good";
  children: ReactNode;
}) {
  const tones = {
    info: "border-line bg-riser text-ash",
    warn: "border-ember/50 bg-ember/8 text-safe-soft",
    good: "border-safe/40 bg-safe/8 text-safe-soft",
  };
  return (
    <div className={`border px-4 py-3 text-[13px] leading-relaxed ${tones[tone]}`}>{children}</div>
  );
}
