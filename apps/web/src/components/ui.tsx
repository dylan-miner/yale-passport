import { type ComponentProps, type ReactNode } from "react";

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "affirm";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" && "bg-yale text-white hover:bg-yale-deep",
        variant === "affirm" && "bg-affirm text-white hover:bg-affirm/90",
        variant === "secondary" &&
          "bg-white text-yale border border-line hover:border-yale/40",
        variant === "ghost" && "text-ink-soft hover:text-ink hover:bg-line/50",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink",
        "placeholder:text-ink-soft/60 focus:border-yale/50 focus:outline-none focus:ring-2 focus:ring-yale/15",
        className,
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(21,34,56,0.05)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-affirm" : "bg-line",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-full border-2 font-display text-lg font-semibold",
          dark ? "border-white/70 text-white" : "border-yale text-yale",
        )}
      >
        P
      </span>
      <span
        className={cx(
          "font-display text-xl font-semibold tracking-tight",
          dark ? "text-white" : "text-yale",
        )}
      >
        Passport
      </span>
    </div>
  );
}
