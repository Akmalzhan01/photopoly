import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-safe text-white ${className}`}
    >
      {/* A portrait in a frame: the thing this app makes. */}
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="2.5" width="14" height="15" rx="2.5" />
        <circle cx="10" cy="8.5" r="2.6" />
        <path d="M5.5 16c.8-2.4 2.4-3.6 4.5-3.6s3.7 1.2 4.5 3.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** A small step number in a soft circle. */
export function Marker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-safe/10 px-1.5 text-[12px] font-semibold text-safe-soft tabular-nums">
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-semibold text-safe-soft">{children}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-slab shadow-card ${className}`}>{children}</div>
  );
}

type ButtonTone = "primary" | "ghost" | "danger";

const TONES: Record<ButtonTone, string> = {
  primary:
    "border-transparent bg-safe text-white shadow-card hover:bg-safe/90 disabled:hover:bg-safe",
  ghost: "border-line bg-slab text-chalk shadow-card hover:border-line-lit hover:bg-riser",
  danger: "border-ember/40 text-ember hover:bg-ember/10",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[14px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";

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
      <span className="text-[13px] font-medium text-ash">{label}</span>
      <input
        {...props}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-pit px-3 py-2.5 text-sm text-chalk outline-none transition-colors placeholder:text-dust ${
          error ? "border-ember" : "border-line focus:border-safe focus:ring-3 focus:ring-safe/15"
        }`}
      />
      {error ? (
        <span role="alert" className="text-[13px] text-ember">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12px] text-dust">{hint}</span>
      ) : null}
    </label>
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
    warn: "border-ember/30 bg-ember/8 text-ember",
    good: "border-good/30 bg-good/8 text-good",
  };
  return (
    <div className={`border px-4 py-3 text-[13px] leading-relaxed ${tones[tone]} rounded-lg`}>{children}</div>
  );
}
